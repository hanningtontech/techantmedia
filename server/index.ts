import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import axios from "axios";
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function initAdmin() {
  if (getApps().length) return;
  // Uses GOOGLE_APPLICATION_CREDENTIALS (recommended) or other ADC sources in production.
  initializeApp({ credential: applicationDefault() });
}

async function requireAdmin(req: express.Request): Promise<{ uid: string }> {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Missing auth token");

  initAdmin();
  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;

  const snap = await getFirestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as any)?.role ?? "") : "").toLowerCase().trim();
  if (role !== "admin") throw new Error("Forbidden");
  return { uid };
}

async function requireTutorOrAdmin(req: express.Request): Promise<{ uid: string }> {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Missing auth token");

  initAdmin();
  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;

  const snap = await getFirestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as any)?.role ?? "") : "").toLowerCase().trim();
  if (!(role === "admin" || role === "tutor")) throw new Error("Forbidden");
  return { uid };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing ${name}`);
  return v.trim();
}

async function b2Authorize() {
  const keyId = requireEnv("B2_KEY_ID");
  const appKey = requireEnv("B2_APP_KEY");
  const basic = Buffer.from(`${keyId}:${appKey}`).toString("base64");

  const res = await axios.get("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${basic}` },
  });
  const d = res.data as any;
  return {
    apiUrl: String(d.apiUrl),
    authorizationToken: String(d.authorizationToken),
    downloadUrl: String(d.downloadUrl),
  };
}

async function b2GetUploadUrl(auth: { apiUrl: string; authorizationToken: string }) {
  const bucketId = requireEnv("B2_BUCKET_ID");
  const res = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_get_upload_url`,
    { bucketId },
    { headers: { Authorization: auth.authorizationToken } },
  );
  const d = res.data as any;
  return { uploadUrl: String(d.uploadUrl), uploadAuthToken: String(d.authorizationToken) };
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // JSON for API routes
  app.use(express.json({ limit: "2mb" }));

  // Upload endpoint: raw binary body (pptx)
  app.post(
    "/api/b2/presentations/:docId",
    express.raw({ type: "*/*", limit: "60mb" }),
    async (req, res) => {
      try {
        await requireAdmin(req);
        const docId = String(req.params.docId ?? "").trim();
        if (!docId) return res.status(400).json({ error: "Missing docId" });

        const fileNameHeader = String(req.headers["x-file-name"] ?? "").trim();
        const originalName = fileNameHeader || "presentation.pptx";
        if (!originalName.toLowerCase().endsWith(".pptx")) {
          return res.status(400).json({ error: "Only .pptx files are supported" });
        }

        const body = req.body as Buffer;
        if (!body || !Buffer.isBuffer(body) || body.length === 0) {
          return res.status(400).json({ error: "Missing file bytes" });
        }

        const contentType =
          String(req.headers["content-type"] ?? "").trim() ||
          "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        const sha1 = crypto.createHash("sha1").update(body).digest("hex");

        const b2 = await b2Authorize();
        const up = await b2GetUploadUrl(b2);
        const bucketName = requireEnv("B2_BUCKET_NAME");

        const b2FileName = `class-presentations/${docId}/${originalName}`; // B2 uses fileName as path
        const uploadRes = await axios.post(up.uploadUrl, body, {
          headers: {
            Authorization: up.uploadAuthToken,
            "X-Bz-File-Name": encodeURIComponent(b2FileName).replace(/%2F/g, "/"),
            "Content-Type": contentType,
            "X-Bz-Content-Sha1": sha1,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        const out = uploadRes.data as any;
        const fileId = String(out.fileId ?? "");
        const fileName = String(out.fileName ?? b2FileName);
        const downloadUrl = `${b2.downloadUrl}/file/${encodeURIComponent(bucketName)}/${fileName
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;

        return res.json({ fileId, fileName, downloadUrl, sizeBytes: body.length, contentType });
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : "Upload failed";
        const status = msg === "Forbidden" ? 403 : msg.startsWith("Missing ") ? 500 : 400;
        return res.status(status).json({ error: msg });
      }
    },
  );

  app.post(
    "/api/b2/quiz-images/:uploadId",
    express.raw({ type: "*/*", limit: "15mb" }),
    async (req, res) => {
      try {
        await requireTutorOrAdmin(req);
        const uploadId = String(req.params.uploadId ?? "").trim();
        if (!uploadId) return res.status(400).json({ error: "Missing uploadId" });

        const fileNameHeader = String(req.headers["x-file-name"] ?? "").trim();
        const originalName = fileNameHeader || "image.png";
        const lower = originalName.toLowerCase();
        if (
          !(
            lower.endsWith(".png") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".gif") ||
            lower.endsWith(".webp")
          )
        ) {
          return res.status(400).json({ error: "Only .png, .jpg, .jpeg, .gif, or .webp images are supported" });
        }

        const body = req.body as Buffer;
        if (!body || !Buffer.isBuffer(body) || body.length === 0) {
          return res.status(400).json({ error: "Missing file bytes" });
        }

        const contentType = String(req.headers["content-type"] ?? "").trim() || "application/octet-stream";
        const sha1 = crypto.createHash("sha1").update(body).digest("hex");

        const b2 = await b2Authorize();
        const up = await b2GetUploadUrl(b2);
        const bucketName = requireEnv("B2_BUCKET_NAME");

        const b2FileName = `quiz-question-images/${uploadId}/${originalName}`;
        const uploadRes = await axios.post(up.uploadUrl, body, {
          headers: {
            Authorization: up.uploadAuthToken,
            "X-Bz-File-Name": encodeURIComponent(b2FileName).replace(/%2F/g, "/"),
            "Content-Type": contentType,
            "X-Bz-Content-Sha1": sha1,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        const out = uploadRes.data as any;
        const fileId = String(out.fileId ?? "");
        const fileName = String(out.fileName ?? b2FileName);
        const downloadUrl = `${b2.downloadUrl}/file/${encodeURIComponent(bucketName)}/${fileName
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;

        return res.json({ fileId, fileName, downloadUrl, sizeBytes: body.length, contentType });
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : "Upload failed";
        const status = msg === "Forbidden" ? 403 : msg.startsWith("Missing ") ? 500 : 400;
        return res.status(status).json({ error: msg });
      }
    },
  );

  app.delete("/api/b2/presentations", async (req, res) => {
    try {
      await requireAdmin(req);
      const fileId = String((req.body as any)?.fileId ?? "").trim();
      const fileName = String((req.body as any)?.fileName ?? "").trim();
      if (!fileId || !fileName) return res.status(400).json({ error: "Missing fileId/fileName" });

      const b2 = await b2Authorize();
      await axios.post(
        `${b2.apiUrl}/b2api/v2/b2_delete_file_version`,
        { fileId, fileName },
        { headers: { Authorization: b2.authorizationToken } },
      );
      return res.json({ ok: true });
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Delete failed";
      const status = msg === "Forbidden" ? 403 : msg.startsWith("Missing ") ? 500 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port =
    process.env.PORT ||
    (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

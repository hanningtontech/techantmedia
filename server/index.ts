import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
import crypto from "crypto";
import axios from "axios";
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

// Load repo-root .env (B2 keys, optional Firebase admin service account).
loadEnv({ path: path.resolve(REPO_ROOT, ".env") });

const EXPECTED_FIREBASE_PROJECT =
  process.env.FIREBASE_PROJECT_ID?.trim() ||
  process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
  "hanningtonkutria-portfolio";

type ServiceAccountFields = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function parseServiceAccountJson(raw: string): ServiceAccountFields {
  const j = JSON.parse(raw) as Record<string, unknown>;
  return {
    projectId: String(j.project_id ?? j.projectId ?? "").trim(),
    clientEmail: String(j.client_email ?? j.clientEmail ?? "").trim(),
    privateKey: String(j.private_key ?? j.privateKey ?? "")
      .replace(/\\n/g, "\n")
      .trim(),
  };
}

function serviceAccountFromFile(filePath: string): ServiceAccountFields {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(REPO_ROOT, filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Service account file not found: ${resolved}`);
  }
  return parseServiceAccountJson(readFileSync(resolved, "utf8"));
}

function resolveServiceAccount(): ServiceAccountFields {
  const fromEnv: ServiceAccountFields = {
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || EXPECTED_FIREBASE_PROJECT,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim() || "",
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() || "",
  };
  if (fromEnv.clientEmail && fromEnv.privateKey) return fromEnv;

  const credPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    "";
  if (credPath) return serviceAccountFromFile(credPath);

  throw new Error(
    `Firebase Admin needs credentials for project "${EXPECTED_FIREBASE_PROJECT}". ` +
      `In Firebase Console → ${EXPECTED_FIREBASE_PROJECT} → Project settings → Service accounts → Generate new private key, ` +
      `save the JSON in this repo (e.g. service-account.json), then add to .env:\n` +
      `FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json\n` +
      `(Your PC may have gcloud credentials for a different project — do not rely on those for this app.)`,
  );
}

function initAdmin() {
  if (getApps().length) return;

  const sa = resolveServiceAccount();
  if (!sa.projectId || !sa.clientEmail || !sa.privateKey) {
    throw new Error("Service account JSON is missing project_id, client_email, or private_key");
  }
  if (sa.projectId !== EXPECTED_FIREBASE_PROJECT) {
    throw new Error(
      `Service account is for Firebase project "${sa.projectId}" but this app uses "${EXPECTED_FIREBASE_PROJECT}". ` +
        `Download a key from the ${EXPECTED_FIREBASE_PROJECT} project (not xiaomigadgetskenya or another app).`,
    );
  }

  initializeApp({
    credential: cert({
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      privateKey: sa.privateKey,
    }),
  });
}

function apiErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data;
    if (data && typeof data === "object") {
      const msg = (data as { message?: string; code?: string }).message;
      if (msg) return msg;
    }
    if (typeof data === "string" && data.trim()) return data.trim();
    const status = e.response?.status;
    if (status) return `Upstream request failed (${status})`;
  }
  if (e instanceof Error && e.message) return e.message;
  return "Upload failed";
}

function sendApiError(res: express.Response, e: unknown, fallbackStatus = 500) {
  const msg = apiErrorMessage(e);
  const status =
    msg === "Forbidden"
      ? 403
      : msg === "Missing auth token"
        ? 401
        : msg.startsWith("Missing ")
          ? 500
          : fallbackStatus;
  console.error("[api]", msg, e);
  return res.status(status).json({ error: msg });
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

/** Express app with /api routes only (used by Vite dev on :5000 and by production server). */
export function createApiApp() {
  const app = express();

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
      } catch (e: unknown) {
        return sendApiError(res, e, 400);
      }
    },
  );

  app.post(
    "/api/b2/portfolio-images/:uploadId",
    express.raw({ type: "*/*", limit: "15mb" }),
    async (req, res) => {
      try {
        await requireAdmin(req);
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

        const b2FileName = `portfolio-images/${uploadId}/${originalName}`;
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
      } catch (e: unknown) {
        return sendApiError(res, e, 400);
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

  return app;
}

async function startServer() {
  const app = createApiApp();
  const server = createServer(app);

  // Production only: serve built SPA. In dev, Vite on port 5000 serves the UI + mounts createApiApp.
  if (process.env.NODE_ENV === "production") {
    const staticPath = path.resolve(__dirname, "public");
    app.use(express.static(staticPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }

  const port =
    process.env.API_PORT ||
    process.env.PORT ||
    (process.env.NODE_ENV === "production" ? 3000 : 5001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirectRun) {
  void startServer().catch(console.error);
}

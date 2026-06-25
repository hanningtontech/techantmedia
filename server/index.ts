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
import { requireAdminWithAnyScope, requireSuperAdmin } from "./adminAuth.js";
import { registerContentRoutes } from "./contentRoutes.js";

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

async function requireClientOwnUpload(req: express.Request, clientUserId: string): Promise<{ uid: string }> {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Missing auth token");

  initAdmin();
  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;
  if (uid !== clientUserId) throw new Error("Forbidden");

  const snap = await getFirestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as any)?.role ?? "") : "").toLowerCase().trim();
  if (role !== "client") throw new Error("Forbidden");
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

/** Match Firebase Functions Gen2 HTTP request body cap (~32 MiB). */
const IMAGE_UPLOAD_LIMIT = "32mb";
const PRESENTATION_UPLOAD_LIMIT = "60mb";
const XAI_PORTFOLIO_UPLOAD_LIMIT = "200mb";
const JSON_BODY_LIMIT = "8mb";

function isB2UploadPost(req: express.Request) {
  const p = req.path || (req.url ?? "").split("?")[0] || "";
  return req.method === "POST" && p.startsWith("/api/b2/");
}

/** Express app with /api routes only (used by Vite dev on :5000 and by production server). */
export function createApiApp() {
  const app = express();

  // JSON for API routes — skip B2 binary uploads (handled by route-level express.raw).
  app.use((req, res, next) => {
    if (isB2UploadPost(req)) return next();
    return express.json({ limit: JSON_BODY_LIMIT })(req, res, next);
  });

  // Upload endpoint: raw binary body (pptx)
  registerContentRoutes(app);
  app.post(
    "/api/b2/presentations/:docId",
    express.raw({ type: "*/*", limit: PRESENTATION_UPLOAD_LIMIT }),
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
    express.raw({ type: "*/*", limit: IMAGE_UPLOAD_LIMIT }),
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
    "/api/b2/client-gallery-images/:clientUserId/:uploadId",
    express.raw({ type: "*/*", limit: IMAGE_UPLOAD_LIMIT }),
    async (req, res) => {
      try {
        await requireAdminWithAnyScope(req, ["photography"]);
        const clientUserId = String(req.params.clientUserId ?? "").trim();
        const uploadId = String(req.params.uploadId ?? "").trim();
        if (!clientUserId || !uploadId) return res.status(400).json({ error: "Missing clientUserId or uploadId" });

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

        const b2FileName = `client-gallery-images/${clientUserId}/${uploadId}/${originalName}`;
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

  const SIGNED_CONTRACT_LIMIT = "20mb";
  const CONTRACT_PDF_LIMIT = "25mb";

  app.post(
    "/api/b2/contract-pdfs/:slug/:uploadId",
    express.raw({ type: "*/*", limit: CONTRACT_PDF_LIMIT }),
    async (req, res) => {
      try {
        await requireAdminWithAnyScope(req, ["photography"]);
        const slug = String(req.params.slug ?? "").trim();
        const uploadId = String(req.params.uploadId ?? "").trim();
        if (!slug || !uploadId) return res.status(400).json({ error: "Missing slug or uploadId" });

        const fileNameHeader = String(req.headers["x-file-name"] ?? "").trim();
        const originalName = fileNameHeader || "contract.pdf";
        if (!originalName.toLowerCase().endsWith(".pdf")) {
          return res.status(400).json({ error: "Only .pdf files are supported" });
        }

        const body = req.body as Buffer;
        if (!body || !Buffer.isBuffer(body) || body.length === 0) {
          return res.status(400).json({ error: "Missing file bytes" });
        }

        const contentType = String(req.headers["content-type"] ?? "").trim() || "application/pdf";
        const sha1 = crypto.createHash("sha1").update(body).digest("hex");

        const b2 = await b2Authorize();
        const up = await b2GetUploadUrl(b2);
        const bucketName = requireEnv("B2_BUCKET_NAME");

        const b2FileName = `contract-pdfs/${slug}/${uploadId}/${originalName}`;
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
    "/api/b2/signed-contracts/:clientUserId/:uploadId",
    express.raw({ type: "*/*", limit: SIGNED_CONTRACT_LIMIT }),
    async (req, res) => {
      try {
        const clientUserId = String(req.params.clientUserId ?? "").trim();
        const uploadId = String(req.params.uploadId ?? "").trim();
        if (!clientUserId || !uploadId) return res.status(400).json({ error: "Missing clientUserId or uploadId" });
        await requireClientOwnUpload(req, clientUserId);

        const fileNameHeader = String(req.headers["x-file-name"] ?? "").trim();
        const originalName = fileNameHeader || "signed-contract.pdf";
        const lower = originalName.toLowerCase();
        if (
          !(
            lower.endsWith(".pdf") ||
            lower.endsWith(".png") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg")
          )
        ) {
          return res.status(400).json({ error: "Only .pdf, .png, .jpg, or .jpeg files are supported" });
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

        const b2FileName = `signed-contracts/${clientUserId}/${uploadId}/${originalName}`;
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

  const AUDIO_UPLOAD_LIMIT = "48mb";

  app.post(
    "/api/b2/livestream-audio/:uploadId",
    express.raw({ type: "*/*", limit: AUDIO_UPLOAD_LIMIT }),
    async (req, res) => {
      try {
        await requireSuperAdmin(req);
        const uploadId = String(req.params.uploadId ?? "").trim();
        if (!uploadId) return res.status(400).json({ error: "Missing uploadId" });

        const fileNameHeader = String(req.headers["x-file-name"] ?? "").trim();
        const originalName = fileNameHeader || "track.mp3";
        const lower = originalName.toLowerCase();
        if (
          !(
            lower.endsWith(".mp3") ||
            lower.endsWith(".m4a") ||
            lower.endsWith(".wav") ||
            lower.endsWith(".ogg") ||
            lower.endsWith(".aac")
          )
        ) {
          return res.status(400).json({ error: "Supported audio: .mp3, .m4a, .wav, .ogg, .aac" });
        }

        const body = req.body as Buffer;
        if (!body || !Buffer.isBuffer(body) || body.length === 0) {
          return res.status(400).json({ error: "Missing file bytes" });
        }
        if (body.length > 48 * 1024 * 1024) {
          return res.status(413).json({ error: "Audio too large. Maximum size is 48 MB." });
        }

        const contentType = String(req.headers["content-type"] ?? "").trim() || "audio/mpeg";
        const sha1 = crypto.createHash("sha1").update(body).digest("hex");

        const b2 = await b2Authorize();
        const up = await b2GetUploadUrl(b2);
        const bucketName = requireEnv("B2_BUCKET_NAME");

        const b2FileName = `livestream-audio/${uploadId}/${originalName}`;
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

        const out = uploadRes.data as { fileId?: string; fileName?: string };
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
    express.raw({ type: "*/*", limit: IMAGE_UPLOAD_LIMIT }),
    async (req, res) => {
      try {
        await requireAdminWithAnyScope(req, ["development", "photography", "xai"]);
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

  app.post(
    "/api/b2/xai-portfolio-files/:uploadId",
    express.raw({ type: "*/*", limit: XAI_PORTFOLIO_UPLOAD_LIMIT }),
    async (req, res) => {
      try {
        await requireAdminWithAnyScope(req, ["xai"]);
        const uploadId = String(req.params.uploadId ?? "").trim();
        if (!uploadId) return res.status(400).json({ error: "Missing uploadId" });

        const fileNameHeader = String(req.headers["x-file-name"] ?? "").trim();
        const originalName = fileNameHeader || "file.bin";
        const lower = originalName.toLowerCase();
        const allowed =
          lower.endsWith(".png") ||
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".gif") ||
          lower.endsWith(".webp") ||
          lower.endsWith(".pdf") ||
          lower.endsWith(".mp4") ||
          lower.endsWith(".webm") ||
          lower.endsWith(".mov") ||
          lower.endsWith(".m4v");
        if (!allowed) {
          return res.status(400).json({
            error: "Supported: .png, .jpg, .jpeg, .gif, .webp, .pdf, .mp4, .webm, .mov, .m4v",
          });
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

        const b2FileName = `xai-portfolio/${uploadId}/${originalName}`;
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

        const out = uploadRes.data as { fileId?: string; fileName?: string };
        const fileName = String(out.fileName ?? b2FileName);
        const downloadUrl = `${b2.downloadUrl}/file/${encodeURIComponent(bucketName)}/${fileName
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;

        return res.json({ fileId: String(out.fileId ?? ""), fileName, downloadUrl, sizeBytes: body.length, contentType });
      } catch (e: unknown) {
        return sendApiError(res, e, 400);
      }
    },
  );

  const SUPER_ADMIN_EMAIL = "hanningtonkuria5@gmail.com";
  const VALID_ADMIN_SCOPES = ["development", "xai", "photography", "tutoring", "settings"] as const;

  function parseAdminScopes(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((s): s is string => typeof s === "string" && (VALID_ADMIN_SCOPES as readonly string[]).includes(s));
  }

  function isSuperAdminDoc(data: Record<string, unknown> | null | undefined, email?: string | null): boolean {
    if (data?.isSuperAdmin === true) return true;
    const e = (email ?? String(data?.email ?? "")).trim().toLowerCase();
    return e === SUPER_ADMIN_EMAIL.toLowerCase();
  }

  async function requireSuperAdmin(req: express.Request): Promise<{ uid: string }> {
    const { uid } = await requireAdmin(req);
    const snap = await getFirestore().doc(`users/${uid}`).get();
    const header = String(req.headers.authorization ?? "");
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    const decoded = token ? await getAuth().verifyIdToken(token) : null;
    const data = (snap.exists ? (snap.data() as Record<string, unknown>) : null) ?? null;
    if (!isSuperAdminDoc(data, decoded?.email ?? null)) throw new Error("Forbidden");
    return { uid };
  }

  app.post("/api/admin/bootstrap", async (req, res) => {
    try {
      initAdmin();
      const header = String(req.headers.authorization ?? "");
      const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
      if (!token) return res.status(401).json({ error: "Missing auth token" });

      const decoded = await getAuth().verifyIdToken(token);
      const email = (decoded.email ?? "").trim().toLowerCase();
      if (email !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: "This account cannot use bootstrap" });
      }

      await getFirestore()
        .doc(`users/${decoded.uid}`)
        .set(
          {
            email: decoded.email ?? email,
            name: decoded.name ?? "",
            role: "admin",
            isSuperAdmin: true,
            adminScopes: [...VALID_ADMIN_SCOPES],
            approvalStatus: "approved",
            authMethod: "passwordless",
            updatedAt: new Date(),
          },
          { merge: true },
        );

      return res.json({ ok: true, role: "admin" });
    } catch (e: unknown) {
      return sendApiError(res, e);
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      await requireSuperAdmin(req);
      const snap = await getFirestore().collection("users").where("role", "==", "admin").get();
      const admins = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: d.id,
          email: String(data.email ?? ""),
          name: String(data.name ?? ""),
          role: String(data.role ?? ""),
          isSuperAdmin: isSuperAdminDoc(data, String(data.email ?? "")),
          adminScopes: parseAdminScopes(data.adminScopes),
        };
      });
      return res.json({ admins });
    } catch (e: unknown) {
      return sendApiError(res, e);
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      await requireSuperAdmin(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();
      const adminScopes = parseAdminScopes(body.adminScopes);
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      if (!adminScopes.length) return res.status(400).json({ error: "Select at least one feature area" });
      if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return res.status(400).json({ error: "Owner account is managed via Google sign-in" });
      }

      const userRecord = await getAuth().createUser({
        email,
        password,
        displayName: name || undefined,
      });

      await getFirestore()
        .doc(`users/${userRecord.uid}`)
        .set(
          {
            email,
            name: name || email.split("@")[0],
            role: "admin",
            isSuperAdmin: false,
            adminScopes,
            approvalStatus: "approved",
            authMethod: "password",
            createdAt: new Date(),
          },
          { merge: true },
        );

      return res.json({ uid: userRecord.uid, email });
    } catch (e: unknown) {
      return sendApiError(res, e);
    }
  });

  app.patch("/api/admin/users/:uid", async (req, res) => {
    try {
      await requireSuperAdmin(req);
      const targetUid = String(req.params.uid ?? "").trim();
      if (!targetUid) return res.status(400).json({ error: "Missing user id" });
      const targetSnap = await getFirestore().doc(`users/${targetUid}`).get();
      if (!targetSnap.exists) return res.status(404).json({ error: "Not found" });
      const targetData = targetSnap.data() as Record<string, unknown>;
      if (isSuperAdminDoc(targetData, String(targetData.email ?? ""))) {
        return res.status(400).json({ error: "Cannot change owner permissions" });
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const adminScopes = parseAdminScopes(body.adminScopes);
      if (!adminScopes.length) return res.status(400).json({ error: "Select at least one feature area" });
      await getFirestore()
        .doc(`users/${targetUid}`)
        .set({ adminScopes, updatedAt: new Date() }, { merge: true });
      return res.json({ ok: true, adminScopes });
    } catch (e: unknown) {
      return sendApiError(res, e);
    }
  });

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

  app.post(
    "/api/b2/portfolio-cv/:uploadId",
    express.raw({ type: "*/*", limit: CONTRACT_PDF_LIMIT }),
    async (req, res) => {
      try {
        await requireAdminWithAnyScope(req, ["development", "photography"]);
        const uploadId = String(req.params.uploadId ?? "").trim();
        if (!uploadId) return res.status(400).json({ error: "Missing uploadId" });

        const fileNameHeader = String(req.headers["x-file-name"] ?? "").trim();
        const originalName = fileNameHeader || "Hannington_Kuria_Njuguna_Developer_CV.pdf";
        if (!originalName.toLowerCase().endsWith(".pdf")) {
          return res.status(400).json({ error: "Only .pdf files are supported" });
        }

        const body = req.body as Buffer;
        if (!body || !Buffer.isBuffer(body) || body.length === 0) {
          return res.status(400).json({ error: "Missing file bytes" });
        }

        const contentType = String(req.headers["content-type"] ?? "").trim() || "application/pdf";
        const sha1 = crypto.createHash("sha1").update(body).digest("hex");

        const b2 = await b2Authorize();
        const up = await b2GetUploadUrl(b2);
        const bucketName = requireEnv("B2_BUCKET_NAME");

        const b2FileName = `portfolio-cv/${uploadId}/${originalName}`;
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

        const out = uploadRes.data as { fileId?: string; fileName?: string };
        const fileName = String(out.fileName ?? b2FileName);
        const downloadUrl = `${b2.downloadUrl}/file/${encodeURIComponent(bucketName)}/${fileName
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;

        return res.json({ fileId: String(out.fileId ?? ""), fileName, downloadUrl, sizeBytes: body.length, contentType });
      } catch (e: unknown) {
        return sendApiError(res, e, 400);
      }
    },
  );

  app.get("/api/download-dev-cv", async (req, res) => {
    try {
      initAdmin();
      const snap = await getFirestore().doc("portfolio/site").get();
      const dev = (snap.data()?.developmentSettings ?? {}) as {
        cvDownloadUrl?: string;
        cvFileName?: string;
      };
      const url = String(dev.cvDownloadUrl ?? "").trim();
      const fileName =
        String(dev.cvFileName ?? "Hannington_Kuria_Njuguna_Developer_CV.pdf").trim() ||
        "Hannington_Kuria_Njuguna_Developer_CV.pdf";
      if (!url) return res.status(404).json({ error: "CV not uploaded" });
      const forceDownload = String(req.query.download ?? "") === "1";
      const upstream = await fetch(url);
      if (!upstream.ok) {
        return res.status(502).json({ error: "Could not fetch CV file" });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${forceDownload ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
      );
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(buf);
    } catch (e) {
      return sendApiError(res, e);
    }
  });

  app.get("/api/download-cv", async (req, res) => {
    try {
      initAdmin();
      const snap = await getFirestore().doc("portfolio/xai").get();
      const data = snap.data() as { cvDownloadUrl?: string; cvFileName?: string; publicEnabled?: boolean } | undefined;
      if (data?.publicEnabled === false) return res.status(404).json({ error: "Not available" });
      const url = String(data?.cvDownloadUrl ?? "").trim();
      const fileName =
        String(data?.cvFileName ?? "hannington_kuria_njuguna_cv.pdf").trim() || "hannington_kuria_njuguna_cv.pdf";
      if (!url) return res.status(404).json({ error: "CV not uploaded" });
      const forceDownload = String(req.query.download ?? "") === "1";
      const upstream = await fetch(url);
      if (!upstream.ok) {
        return res.status(502).json({ error: "Could not fetch CV file" });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${forceDownload ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
      );
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(buf);
    } catch (e) {
      return sendApiError(res, e);
    }
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    const e = err as { type?: string; status?: number; message?: string };
    if (e?.type === "entity.too.large" || e?.status === 413) {
      return res.status(413).json({
        error: "File too large. Photos must be under 32 MB each (try exporting a smaller JPEG).",
      });
    }
    next(err);
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

import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as crypto from "crypto";

function ensureAdmin() {
  if (!admin.apps.length) admin.initializeApp();
}

const B2_KEY_ID = defineSecret("B2_KEY_ID");
const B2_APP_KEY = defineSecret("B2_APP_KEY");
const B2_BUCKET_ID = defineSecret("B2_BUCKET_ID");
const B2_BUCKET_NAME = defineSecret("B2_BUCKET_NAME");

type QuizSession = {
  studentId?: string;
  studentName?: string;
  quizTitle?: string | null;
  status?: "in_progress" | "submitted" | "reviewed";
  startedAt?: admin.firestore.Timestamp | null;
  submittedAt?: admin.firestore.Timestamp | null;
  resultsReleasedToStudent?: boolean;
  percentageScore?: number;
  totalQuestions?: number;
  sectionScoreRequestedUpTo?: number;
  sectionScoreReleasedUpTo?: number;
};

type QuizAssignment = {
  studentId?: string;
  isActive?: boolean;
};

function num(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}

function bool(x: unknown): boolean | undefined {
  return typeof x === "boolean" ? x : undefined;
}

async function upsertAdminNotification(args: {
  id: string;
  type: "final_results" | "section_results";
  sessionId: string;
  studentId: string;
  studentName: string;
  quizTitle: string | null;
  requestedUpTo?: number;
  createdAt: admin.firestore.FieldValue;
}) {
  ensureAdmin();
  const db = admin.firestore();
  await db
    .doc(`adminNotifications/${args.id}`)
    .set(
      {
        type: args.type,
        status: "open",
        read: false,
        readAt: null,
        sessionId: args.sessionId,
        studentId: args.studentId,
        studentName: args.studentName,
        quizTitle: args.quizTitle,
        requestedUpTo: args.requestedUpTo ?? null,
        createdAt: args.createdAt,
        resolvedAt: null,
      },
      { merge: true },
    );
}

async function resolveAdminNotification(id: string) {
  ensureAdmin();
  const db = admin.firestore();
  await db
    .doc(`adminNotifications/${id}`)
    .set({ status: "resolved", resolvedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    .catch(() => {});
}

export const onQuizSessionWrite = onDocumentWritten("quizSessions/{sessionId}", async (event: any) => {
  ensureAdmin();
  const before = (event.data?.before.exists ? (event.data.before.data() as QuizSession) : null) ?? null;
  const after = (event.data?.after.exists ? (event.data.after.data() as QuizSession) : null) ?? null;
  const sessionId = event.params.sessionId as string;
  if (!after) return;

  const studentId = str(after.studentId);
  if (!studentId) return;
  const studentName = str(after.studentName);
  const quizTitle = (after.quizTitle ?? null) as string | null;

  const beforeStatus = before?.status;
  const afterStatus = after.status;

  const beforeReleased = bool(before?.resultsReleasedToStudent);
  const afterReleased = bool(after.resultsReleasedToStudent);

  // Notification: final results pending release (submitted/reviewed + resultsReleasedToStudent === false)
  const becameSubmitted =
    (beforeStatus !== "submitted" && afterStatus === "submitted") ||
    (beforeStatus !== "reviewed" && afterStatus === "reviewed");
  const nowFinalPending = (afterStatus === "submitted" || afterStatus === "reviewed") && afterReleased === false;
  if (becameSubmitted && nowFinalPending) {
    await upsertAdminNotification({
      id: `${sessionId}_final`,
      type: "final_results",
      sessionId,
      studentId,
      studentName,
      quizTitle,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  if (afterReleased === true && beforeReleased === false) {
    await resolveAdminNotification(`${sessionId}_final`);
  }

  // Notification: section results requested (in_progress + requestedUpTo > releasedUpTo)
  const req = Math.max(0, Math.floor(num(after.sectionScoreRequestedUpTo)));
  const rel = Math.max(0, Math.floor(num(after.sectionScoreReleasedUpTo)));
  const prevReq = Math.max(0, Math.floor(num(before?.sectionScoreRequestedUpTo)));
  const sectionBecamePending =
    afterStatus === "in_progress" && req > 0 && req > rel && (prevReq <= 0 || req > prevReq);
  if (sectionBecamePending) {
    await upsertAdminNotification({
      id: `${sessionId}_section`,
      type: "section_results",
      sessionId,
      studentId,
      studentName,
      quizTitle,
      requestedUpTo: req,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  if (req > 0 && rel >= req) {
    await resolveAdminNotification(`${sessionId}_section`);
  }

  // Admin stats: increment released score aggregates when results are released
  // Assumption: once released, percentageScore won't be edited to a different value.
  if (afterReleased === true && beforeReleased === false) {
    const score = Math.max(0, Math.min(100, Math.round(num(after.percentageScore))));
    const tq = Math.max(0, Math.floor(num(after.totalQuestions)));
    if (tq > 0) {
      const db = admin.firestore();
      const userRef = db.doc(`users/${studentId}`);
      await db.runTransaction(async (tx: admin.firestore.Transaction) => {
        const snap = await tx.get(userRef);
        const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
        const stats = (data.adminStats as Record<string, unknown> | undefined) ?? {};
        const prevCount = Math.max(0, Math.floor(num(stats.releasedScoreCount)));
        const prevSum = Math.max(0, Math.floor(num(stats.releasedScoreSum)));
        const nextCount = prevCount + 1;
        const nextSum = prevSum + score;
        const avg = nextCount ? Math.round(nextSum / nextCount) : 0;
        tx.set(
          userRef,
          {
            adminStats: {
              releasedScoreCount: nextCount,
              releasedScoreSum: nextSum,
              averageScoreReleased: avg,
              lastSubmittedAt: after.submittedAt ?? admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      });
    }
  }
});

export const onQuizAssignmentWrite = onDocumentWritten("quizAssignments/{assignmentId}", async (event: any) => {
  ensureAdmin();
  const before = (event.data?.before.exists ? (event.data.before.data() as QuizAssignment) : null) ?? null;
  const after = (event.data?.after.exists ? (event.data.after.data() as QuizAssignment) : null) ?? null;
  if (!after) return;

  const studentId = str(after.studentId);
  if (!studentId) return;

  const prevActive = Boolean(before?.isActive);
  const nextActive = Boolean(after.isActive);
  if (prevActive === nextActive) return;

  const delta = nextActive ? 1 : -1;
  const db = admin.firestore();
  await db
    .doc(`users/${studentId}`)
    .set(
      {
        adminStats: {
          activeAssignments: admin.firestore.FieldValue.increment(delta),
          assignmentsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    )
    .catch(() => {});
});

function json(res: any, status: number, body: any) {
  res.status(status);
  res.set("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

async function requireTutorOrAdminFromBearer(req: any): Promise<{ uid: string }> {
  ensureAdmin();
  const header = String(req.headers?.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Missing auth token");
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as any)?.role ?? "") : "").toLowerCase().trim();
  if (!(role === "admin" || role === "tutor")) throw new Error("Forbidden");
  return { uid };
}

async function requireAdminFromBearer(req: any): Promise<{ uid: string }> {
  ensureAdmin();
  const header = String(req.headers?.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Missing auth token");
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as any)?.role ?? "") : "").toLowerCase().trim();
  if (role !== "admin") throw new Error("Forbidden");
  return { uid };
}

async function b2Authorize() {
  const keyId = B2_KEY_ID.value();
  const appKey = B2_APP_KEY.value();
  const basic = Buffer.from(`${keyId}:${appKey}`).toString("base64");
  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`B2 authorize failed (${res.status})`);
  const d: any = await res.json();
  return {
    apiUrl: String(d.apiUrl),
    authorizationToken: String(d.authorizationToken),
    downloadUrl: String(d.downloadUrl),
  };
}

async function b2GetUploadUrl(auth: { apiUrl: string; authorizationToken: string }) {
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID.value() }),
  });
  if (!res.ok) throw new Error(`B2 get upload url failed (${res.status})`);
  const d: any = await res.json();
  return { uploadUrl: String(d.uploadUrl), uploadAuthToken: String(d.authorizationToken) };
}

function b2PublicDownloadUrl(downloadUrl: string, bucketName: string, fileName: string) {
  return `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${fileName
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export const api = onRequest(
  {
    secrets: [B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME],
    cors: true,
    // Required so Firebase Hosting rewrite can reach it (we still enforce admin via ID token inside).
    invoker: "public",
    // Keep memory a bit higher for PPTX buffers.
    memory: "512MiB",
  },
  async (req, res) => {
    try {
      ensureAdmin();
      const rawPath = String(req.path ?? req.url ?? "");
      // Normalize path from various Firebase/Express shapes:
      // - "/api/..." (hosting rewrite prefix)
      // - "/public/..." or "/b2/..." (direct)
      // - sometimes includes full URL or query string
      const norm = (() => {
        const p = rawPath.split("?")[0] || "";
        const idxPublic = p.indexOf("/public/");
        if (idxPublic >= 0) return p.slice(idxPublic);
        const idxB2 = p.indexOf("/b2/");
        if (idxB2 >= 0) return p.slice(idxB2);
        if (p.startsWith("/api/")) return p.slice("/api".length);
        return p;
      })();
      const path = norm;

      type ResourceKind = "presentations" | "study-guides" | "quiz-images" | "portfolio-images";
      const kindFromPath = (): ResourceKind | null => {
        if (path.startsWith("/b2/presentations/")) return "presentations";
        if (path.startsWith("/b2/study-guides/")) return "study-guides";
        if (path.startsWith("/b2/quiz-images/")) return "quiz-images";
        if (path.startsWith("/b2/portfolio-images/")) return "portfolio-images";
        return null;
      };
      const isAllowedExt = (k: ResourceKind, filename: string) => {
        const n = filename.toLowerCase();
        if (k === "presentations") return n.endsWith(".pptx");
        if (k === "quiz-images" || k === "portfolio-images") {
          return (
            n.endsWith(".png") ||
            n.endsWith(".jpg") ||
            n.endsWith(".jpeg") ||
            n.endsWith(".gif") ||
            n.endsWith(".webp")
          );
        }
        return n.endsWith(".pdf") || n.endsWith(".docx") || n.endsWith(".doc");
      };
      const defaultName = (k: ResourceKind) =>
        k === "presentations"
          ? "presentation.pptx"
          : k === "quiz-images" || k === "portfolio-images"
            ? "image.png"
            : "study-guide.pdf";

      // Public file proxy (published only). This makes Office viewer + downloads reliable.
      if (req.method === "GET" && (path.startsWith("/public/presentations/") || path.startsWith("/public/study-guides/"))) {
        const isPptx = path.startsWith("/public/presentations/");
        const id = decodeURIComponent(path.replace(isPptx ? "/public/presentations/" : "/public/study-guides/", "").split("?")[0] || "").trim();
        if (!id) return json(res, 400, { error: "Missing id" });

        const col = isPptx ? "classPresentations" : "classStudyGuides";
        const snap = await admin.firestore().doc(`${col}/${id}`).get();
        if (!snap.exists) return json(res, 404, { error: "Not found" });
        const data = snap.data() as any;
        if (data?.published !== true) return json(res, 403, { error: "Not published" });

        const bucketName = B2_BUCKET_NAME.value();
        let fileName = String(data?.b2FileName ?? "").trim();
        const fileId = String(data?.b2FileId ?? "").trim();
        // Backfill for older docs that only have downloadUrl.
        if (!fileName) {
          const du = String(data?.downloadUrl ?? "").trim();
          const m = `/file/${bucketName}/`;
          const idx = du.indexOf(m);
          if (idx >= 0) {
            const tail = du.slice(idx + m.length);
            fileName = tail
              .split("/")
              .map((seg: string) => {
                try {
                  return decodeURIComponent(seg);
                } catch {
                  return seg;
                }
              })
              .join("/");
          }
        }

        const auth = await b2Authorize();
        // Prefer download by fileName (fast path), else fall back to download by fileId (legacy/broken docs).
        const srcUrl = fileName
          ? b2PublicDownloadUrl(auth.downloadUrl, bucketName, fileName)
          : fileId
            ? `${auth.downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${encodeURIComponent(fileId)}`
            : "";
        if (!srcUrl) return json(res, 404, { error: "Missing file reference" });

        const upstream = await fetch(srcUrl, fileName ? undefined : { headers: { Authorization: auth.authorizationToken } });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          return json(res, 502, { error: t || `Upstream download failed (${upstream.status})` });
        }

        const filenameForClient = String(data?.filename ?? (isPptx ? "presentation.pptx" : "study-guide")).trim() || (isPptx ? "presentation.pptx" : "study-guide");
        const contentType =
          String(data?.contentType ?? "").trim() ||
          (isPptx
            ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : "application/octet-stream");
        const forceDownload = String((req.query as any)?.download ?? "") === "1";

        res.status(200);
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "public, max-age=300");
        res.set(
          "Content-Disposition",
          `${forceDownload ? "attachment" : "inline"}; filename="${filenameForClient.replace(/"/g, "")}"`,
        );

        // Stream through.
        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
        return;
      }

      // Upload bytes (admin only)
      const kind = kindFromPath();
      if (req.method === "POST" && kind) {
        if (kind === "portfolio-images") {
          await requireAdminFromBearer(req);
        } else {
          await requireTutorOrAdminFromBearer(req);
        }

        const basePrefix =
          kind === "presentations"
            ? "/b2/presentations/"
            : kind === "study-guides"
              ? "/b2/study-guides/"
              : kind === "portfolio-images"
                ? "/b2/portfolio-images/"
                : "/b2/quiz-images/";
        const docId = decodeURIComponent(path.replace(basePrefix, "").split("?")[0] || "").trim();
        if (!docId) return json(res, 400, { error: "Missing docId" });

        const originalName = String(req.headers["x-file-name"] ?? defaultName(kind)).trim() || defaultName(kind);
        if (!isAllowedExt(kind, originalName)) {
          return json(res, 400, {
            error:
              kind === "presentations"
                ? "Only .pptx files are supported"
                : kind === "quiz-images" || kind === "portfolio-images"
                  ? "Only .png, .jpg, .jpeg, .gif, or .webp images are supported"
                  : "Only .pdf, .doc, or .docx files are supported",
          });
        }

        const buf: Buffer = (req as any).rawBody;
        if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) return json(res, 400, { error: "Missing file bytes" });

        const contentTypeRaw = String(req.headers["content-type"] ?? "").trim();
        const contentType =
          contentTypeRaw ||
          (kind === "presentations"
            ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : kind === "quiz-images" || kind === "portfolio-images"
              ? "application/octet-stream"
              : "application/octet-stream");
        const sha1 = crypto.createHash("sha1").update(buf).digest("hex");

        const auth = await b2Authorize();
        const up = await b2GetUploadUrl(auth);
        const bucketName = B2_BUCKET_NAME.value();
        const prefix =
          kind === "presentations"
            ? "class-presentations"
            : kind === "study-guides"
              ? "class-study-guides"
              : kind === "portfolio-images"
                ? "portfolio-images"
                : "quiz-question-images";
        const b2FileName = `${prefix}/${docId}/${originalName}`;

        const uploadRes = await fetch(up.uploadUrl, {
          method: "POST",
          headers: {
            Authorization: up.uploadAuthToken,
            "X-Bz-File-Name": encodeURIComponent(b2FileName).replace(/%2F/g, "/"),
            "Content-Type": contentType,
            "X-Bz-Content-Sha1": sha1,
          } as any,
          body: buf,
        });
        if (!uploadRes.ok) {
          const t = await uploadRes.text().catch(() => "");
          return json(res, 400, { error: t || `B2 upload failed (${uploadRes.status})` });
        }
        const out: any = await uploadRes.json();
        const fileId = String(out.fileId ?? "");
        const fileName = String(out.fileName ?? b2FileName);
        const downloadUrl = b2PublicDownloadUrl(auth.downloadUrl, bucketName, fileName);
        return json(res, 200, { fileId, fileName, downloadUrl, sizeBytes: buf.length, contentType });
      }

      // Delete (admin only)
      if (req.method === "DELETE" && (path === "/b2/presentations" || path === "/b2/study-guides")) {
        await requireTutorOrAdminFromBearer(req);
        const body = (req.body ?? {}) as any;
        const fileId = String(body.fileId ?? "").trim();
        const fileName = String(body.fileName ?? "").trim();
        // Allow deleting Firestore rows that never finished uploading (no B2 reference).
        if (!fileId || !fileName) return json(res, 200, { ok: true, skippedB2: true });

        const auth = await b2Authorize();
        const delRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
          method: "POST",
          headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, fileName }),
        });
        if (!delRes.ok) {
          const t = await delRes.text().catch(() => "");
          return json(res, 400, { error: t || `B2 delete failed (${delRes.status})` });
        }
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: "Not found" });
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Request failed";
      const status = msg === "Forbidden" ? 403 : msg === "Missing auth token" ? 401 : 400;
      return json(res, status, { error: msg });
    }
  },
);


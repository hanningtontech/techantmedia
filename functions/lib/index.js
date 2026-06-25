"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.pumpBlockGameLiveChart = exports.onQuizAssignmentWrite = exports.onQuizSessionWrite = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const crypto = __importStar(require("crypto"));
const contentApi = __importStar(require("./contentApi"));
const livestreamSecrets = __importStar(require("./livestreamSecrets"));
const livestreamUrls_1 = require("./livestreamUrls");
const quotaGuard = __importStar(require("./quotaGuard"));
const blockGameApi = __importStar(require("./blockGameApi"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const liveChartPump = __importStar(require("./liveChartPump"));
function ensureAdmin() {
    if (!admin.apps.length)
        admin.initializeApp();
}
const B2_KEY_ID = (0, params_1.defineSecret)("B2_KEY_ID");
const B2_APP_KEY = (0, params_1.defineSecret)("B2_APP_KEY");
const B2_BUCKET_ID = (0, params_1.defineSecret)("B2_BUCKET_ID");
const B2_BUCKET_NAME = (0, params_1.defineSecret)("B2_BUCKET_NAME");
/** Primary owner — must match client/src/lib/admin/constants.ts */
const SUPER_ADMIN_EMAIL = "hanningtonkuria5@gmail.com";
function num(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
}
function str(x) {
    return typeof x === "string" ? x : "";
}
function bool(x) {
    return typeof x === "boolean" ? x : undefined;
}
async function upsertAdminNotification(args) {
    ensureAdmin();
    const db = admin.firestore();
    await db
        .doc(`adminNotifications/${args.id}`)
        .set({
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
    }, { merge: true });
}
async function resolveAdminNotification(id) {
    ensureAdmin();
    const db = admin.firestore();
    await db
        .doc(`adminNotifications/${id}`)
        .set({ status: "resolved", resolvedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .catch(() => { });
}
exports.onQuizSessionWrite = (0, firestore_1.onDocumentWritten)("quizSessions/{sessionId}", async (event) => {
    ensureAdmin();
    const before = (event.data?.before.exists ? event.data.before.data() : null) ?? null;
    const after = (event.data?.after.exists ? event.data.after.data() : null) ?? null;
    const sessionId = event.params.sessionId;
    if (!after)
        return;
    const studentId = str(after.studentId);
    if (!studentId)
        return;
    const studentName = str(after.studentName);
    const quizTitle = (after.quizTitle ?? null);
    const beforeStatus = before?.status;
    const afterStatus = after.status;
    const beforeReleased = bool(before?.resultsReleasedToStudent);
    const afterReleased = bool(after.resultsReleasedToStudent);
    // Notification: final results pending release (submitted/reviewed + resultsReleasedToStudent === false)
    const becameSubmitted = (beforeStatus !== "submitted" && afterStatus === "submitted") ||
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
    const sectionBecamePending = afterStatus === "in_progress" && req > 0 && req > rel && (prevReq <= 0 || req > prevReq);
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
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(userRef);
                const data = snap.exists ? snap.data() : {};
                const stats = data.adminStats ?? {};
                const prevCount = Math.max(0, Math.floor(num(stats.releasedScoreCount)));
                const prevSum = Math.max(0, Math.floor(num(stats.releasedScoreSum)));
                const nextCount = prevCount + 1;
                const nextSum = prevSum + score;
                const avg = nextCount ? Math.round(nextSum / nextCount) : 0;
                tx.set(userRef, {
                    adminStats: {
                        releasedScoreCount: nextCount,
                        releasedScoreSum: nextSum,
                        averageScoreReleased: avg,
                        lastSubmittedAt: after.submittedAt ?? admin.firestore.FieldValue.serverTimestamp(),
                    },
                }, { merge: true });
            });
        }
    }
});
exports.onQuizAssignmentWrite = (0, firestore_1.onDocumentWritten)("quizAssignments/{assignmentId}", async (event) => {
    ensureAdmin();
    const before = (event.data?.before.exists ? event.data.before.data() : null) ?? null;
    const after = (event.data?.after.exists ? event.data.after.data() : null) ?? null;
    if (!after)
        return;
    const studentId = str(after.studentId);
    if (!studentId)
        return;
    const prevActive = Boolean(before?.isActive);
    const nextActive = Boolean(after.isActive);
    if (prevActive === nextActive)
        return;
    const delta = nextActive ? 1 : -1;
    const db = admin.firestore();
    await db
        .doc(`users/${studentId}`)
        .set({
        adminStats: {
            activeAssignments: admin.firestore.FieldValue.increment(delta),
            assignmentsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
    }, { merge: true })
        .catch(() => { });
});
function json(res, status, body) {
    res.status(status);
    res.set("Content-Type", "application/json");
    res.send(JSON.stringify(body));
}
async function requireTutorOrAdminFromBearer(req) {
    ensureAdmin();
    const header = String(req.headers?.authorization ?? "");
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token)
        throw new Error("Missing auth token");
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    const role = (snap.exists ? String(snap.data()?.role ?? "") : "").toLowerCase().trim();
    if (!(role === "admin" || role === "tutor"))
        throw new Error("Forbidden");
    return { uid };
}
const VALID_ADMIN_SCOPES = ["development", "xai", "photography", "tutoring", "settings"];
function parseAdminScopes(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.filter((s) => typeof s === "string" && VALID_ADMIN_SCOPES.includes(s));
}
function isSuperAdminDoc(data, email) {
    if (data?.isSuperAdmin === true)
        return true;
    const e = (email ?? String(data?.email ?? "")).trim().toLowerCase();
    return e === SUPER_ADMIN_EMAIL.toLowerCase();
}
async function requireAdminFromBearer(req) {
    ensureAdmin();
    const header = String(req.headers?.authorization ?? "");
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token)
        throw new Error("Missing auth token");
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    const role = (snap.exists ? String(snap.data()?.role ?? "") : "").toLowerCase().trim();
    if (role !== "admin")
        throw new Error("Forbidden");
    return { uid, email: decoded.email ?? null };
}
async function requireSuperAdminFromBearer(req) {
    const { uid, email } = await requireAdminFromBearer(req);
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    const data = (snap.exists ? snap.data() : null) ?? null;
    if (!isSuperAdminDoc(data, email))
        throw new Error("Forbidden");
    return { uid };
}
async function requireClientOwnUploadFromBearer(req, clientUserId) {
    ensureAdmin();
    const header = String(req.headers?.authorization ?? "");
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token)
        throw new Error("Missing auth token");
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    if (uid !== clientUserId)
        throw new Error("Forbidden");
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    const role = (snap.exists ? String(snap.data()?.role ?? "") : "").toLowerCase().trim();
    if (role !== "client")
        throw new Error("Forbidden");
    return { uid };
}
async function requireAdminWithAnyScope(req, scopes) {
    const { uid, email } = await requireAdminFromBearer(req);
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    const data = (snap.exists ? snap.data() : null) ?? null;
    if (isSuperAdminDoc(data, email))
        return { uid };
    const granted = parseAdminScopes(data?.adminScopes);
    const legacy = data != null && !Object.prototype.hasOwnProperty.call(data, "adminScopes");
    if (legacy && granted.length === 0)
        return { uid };
    if (scopes.some((s) => granted.includes(s)))
        return { uid };
    throw new Error("Forbidden");
}
async function b2Authorize() {
    const keyId = B2_KEY_ID.value();
    const appKey = B2_APP_KEY.value();
    const basic = Buffer.from(`${keyId}:${appKey}`).toString("base64");
    const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
        headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok)
        throw new Error(`B2 authorize failed (${res.status})`);
    const d = await res.json();
    return {
        apiUrl: String(d.apiUrl),
        authorizationToken: String(d.authorizationToken),
        downloadUrl: String(d.downloadUrl),
    };
}
async function b2GetUploadUrl(auth) {
    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: "POST",
        headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ bucketId: B2_BUCKET_ID.value() }),
    });
    if (!res.ok)
        throw new Error(`B2 get upload url failed (${res.status})`);
    const d = await res.json();
    return { uploadUrl: String(d.uploadUrl), uploadAuthToken: String(d.authorizationToken) };
}
function b2PublicDownloadUrl(downloadUrl, bucketName, fileName) {
    return `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${fileName
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
}
async function resolvePublicFileUrl(data, bucketName) {
    const direct = String(data.downloadUrl ?? "").trim();
    let fileName = String(data.b2FileName ?? "").trim();
    const fileId = String(data.b2FileId ?? "").trim();
    if (!fileName && direct) {
        const marker = `/file/${bucketName}/`;
        const idx = direct.indexOf(marker);
        if (idx >= 0) {
            fileName = direct
                .slice(idx + marker.length)
                .split("/")
                .map((seg) => {
                try {
                    return decodeURIComponent(seg);
                }
                catch {
                    return seg;
                }
            })
                .join("/");
        }
    }
    if (fileName) {
        const auth = await b2Authorize();
        return b2PublicDownloadUrl(auth.downloadUrl, bucketName, fileName);
    }
    if (direct)
        return direct;
    if (fileId) {
        const auth = await b2Authorize();
        return `${auth.downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${encodeURIComponent(fileId)}`;
    }
    return "";
}
exports.pumpBlockGameLiveChart = (0, scheduler_1.onSchedule)({ schedule: "every 1 minutes", timeZone: "UTC", timeoutSeconds: 120 }, async () => {
    ensureAdmin();
    await liveChartPump.pumpLiveChartOnce();
});
exports.api = (0, https_1.onRequest)({
    secrets: [B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME],
    cors: true,
    // Required so Firebase Hosting rewrite can reach it (we still enforce admin via ID token inside).
    invoker: "public",
    // Keep memory a bit higher for PPTX buffers.
    memory: "512MiB",
}, async (req, res) => {
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
            if (idxPublic >= 0)
                return p.slice(idxPublic);
            const idxB2 = p.indexOf("/b2/");
            if (idxB2 >= 0)
                return p.slice(idxB2);
            const idxAdmin = p.indexOf("/admin/");
            if (idxAdmin >= 0)
                return p.slice(idxAdmin);
            if (p.startsWith("/api/"))
                return p.slice("/api".length);
            return p;
        })();
        const path = norm;
        const isPublicEgressPath = (req.method === "GET" && path === "/download-dev-cv") ||
            (req.method === "GET" && path === "/download-cv") ||
            (req.method === "GET" && path.startsWith("/public/presentations/")) ||
            (req.method === "GET" && path.startsWith("/public/study-guides/"));
        const quota = await quotaGuard.checkApiQuota(req, {
            isWrite: req.method !== "GET" && req.method !== "HEAD",
            blockCrawlers: isPublicEgressPath,
        });
        if (!quota.ok) {
            json(res, quota.status, { error: quota.message });
            return;
        }
        // Admin accounts (bootstrap owner, list/create password admins)
        if (req.method === "POST" && path === "/admin/bootstrap") {
            const header = String(req.headers?.authorization ?? "");
            const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
            if (!token) {
                json(res, 401, { error: "Missing auth token" });
                return;
            }
            const decoded = await admin.auth().verifyIdToken(token);
            const email = (decoded.email ?? "").trim().toLowerCase();
            if (email !== SUPER_ADMIN_EMAIL.toLowerCase()) {
                json(res, 403, { error: "This account cannot use bootstrap" });
                return;
            }
            await admin
                .firestore()
                .doc(`users/${decoded.uid}`)
                .set({
                email: decoded.email ?? email,
                name: decoded.name ?? "",
                role: "admin",
                isSuperAdmin: true,
                adminScopes: [...VALID_ADMIN_SCOPES],
                approvalStatus: "approved",
                authMethod: "passwordless",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            json(res, 200, { ok: true, role: "admin" });
            return;
        }
        if (req.method === "GET" && path === "/admin/users") {
            await requireSuperAdminFromBearer(req);
            const snap = await admin.firestore().collection("users").where("role", "==", "admin").get();
            const admins = snap.docs.map((d) => {
                const data = d.data();
                return {
                    uid: d.id,
                    email: String(data.email ?? ""),
                    name: String(data.name ?? ""),
                    role: String(data.role ?? ""),
                    isSuperAdmin: isSuperAdminDoc(data, String(data.email ?? "")),
                    adminScopes: parseAdminScopes(data.adminScopes),
                };
            });
            json(res, 200, { admins });
            return;
        }
        if (req.method === "POST" && path === "/admin/users") {
            await requireSuperAdminFromBearer(req);
            const body = (req.body ?? {});
            const email = String(body.email ?? "").trim().toLowerCase();
            const password = String(body.password ?? "");
            const name = String(body.name ?? "").trim();
            const adminScopes = parseAdminScopes(body.adminScopes);
            if (!email || !password) {
                json(res, 400, { error: "Email and password are required" });
                return;
            }
            if (password.length < 8) {
                json(res, 400, { error: "Password must be at least 8 characters" });
                return;
            }
            if (!adminScopes.length) {
                json(res, 400, { error: "Select at least one feature area" });
                return;
            }
            if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
                json(res, 400, { error: "Owner account is managed via Google sign-in" });
                return;
            }
            const userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: name || undefined,
            });
            await admin
                .firestore()
                .doc(`users/${userRecord.uid}`)
                .set({
                email,
                name: name || email.split("@")[0],
                role: "admin",
                isSuperAdmin: false,
                adminScopes,
                approvalStatus: "approved",
                authMethod: "password",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            json(res, 200, { uid: userRecord.uid, email });
            return;
        }
        if (req.method === "PATCH" && path.startsWith("/admin/users/")) {
            await requireSuperAdminFromBearer(req);
            const targetUid = decodeURIComponent(path.replace("/admin/users/", "").split("?")[0] || "").trim();
            if (!targetUid) {
                json(res, 400, { error: "Missing user id" });
                return;
            }
            const targetSnap = await admin.firestore().doc(`users/${targetUid}`).get();
            if (!targetSnap.exists) {
                json(res, 404, { error: "Not found" });
                return;
            }
            const targetData = targetSnap.data();
            if (isSuperAdminDoc(targetData, String(targetData.email ?? ""))) {
                json(res, 400, { error: "Cannot change owner permissions" });
                return;
            }
            const body = (req.body ?? {});
            const adminScopes = parseAdminScopes(body.adminScopes);
            if (!adminScopes.length) {
                json(res, 400, { error: "Select at least one feature area" });
                return;
            }
            await admin.firestore().doc(`users/${targetUid}`).set({
                adminScopes,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            json(res, 200, { ok: true, adminScopes });
            return;
        }
        // Portfolio & photography CMS writes (Admin SDK only — client Firestore writes disabled in rules)
        const body = (req.body ?? {});
        if (req.method === "PUT" && path === "/livestream/settings") {
            await requireSuperAdminFromBearer(req);
            await contentApi.putLivestreamSettings(body);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "GET" && path === "/livestream/ingest") {
            await requireSuperAdminFromBearer(req);
            const streamKey = await livestreamSecrets.getOrCreateStreamKey();
            const snap = await admin.firestore().doc("portfolio/livestream").get();
            const urls = (0, livestreamUrls_1.withLivestreamUrlDefaults)(snap.data() ?? {});
            const obs = livestreamSecrets.formatObsCredentials(urls.rtmpIngestUrl, streamKey);
            json(res, 200, {
                streamKey,
                rtmpIngestUrl: urls.rtmpIngestUrl,
                hlsPlaybackUrl: urls.hlsPlaybackUrl,
                obsServer: obs.obsServer,
                obsStreamKey: obs.obsStreamKey,
            });
            return;
        }
        if (req.method === "POST" && path === "/livestream/regenerate-key") {
            await requireSuperAdminFromBearer(req);
            const streamKey = await livestreamSecrets.regenerateStreamKey();
            const snap = await admin.firestore().doc("portfolio/livestream").get();
            const urls = (0, livestreamUrls_1.withLivestreamUrlDefaults)(snap.data() ?? {});
            const obs = livestreamSecrets.formatObsCredentials(urls.rtmpIngestUrl, streamKey);
            json(res, 200, {
                streamKey,
                rtmpIngestUrl: urls.rtmpIngestUrl,
                hlsPlaybackUrl: urls.hlsPlaybackUrl,
                obsServer: obs.obsServer,
                obsStreamKey: obs.obsStreamKey,
            });
            return;
        }
        if (req.method === "POST" && path === "/livestream/probe") {
            await requireSuperAdminFromBearer(req);
            const snap = await admin.firestore().doc("portfolio/livestream").get();
            const hlsPlaybackUrl = (0, livestreamUrls_1.withLivestreamUrlDefaults)(snap.data() ?? {}).hlsPlaybackUrl;
            if (!hlsPlaybackUrl) {
                await livestreamSecrets.updateLivestreamStreamStatus("offline");
                json(res, 200, { ok: false, streamStatus: "offline" });
                return;
            }
            await livestreamSecrets.updateLivestreamStreamStatus("connecting");
            const ok = await livestreamSecrets.probeHlsManifest(hlsPlaybackUrl);
            const streamStatus = ok ? "live" : "offline";
            await livestreamSecrets.updateLivestreamStreamStatus(streamStatus);
            json(res, 200, { ok, streamStatus });
            return;
        }
        if (req.method === "PUT" && path === "/portfolio/site") {
            await requireAdminWithAnyScope(req, ["development", "photography"]);
            await contentApi.putPortfolioSite(body);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "PUT" && path === "/portfolio/xai") {
            await requireAdminWithAnyScope(req, ["xai"]);
            await contentApi.putPortfolioXai(body);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "POST" && path.match(/^\/client-galleries\/[^/]+\/ensure$/)) {
            await requireAdminWithAnyScope(req, ["photography"]);
            const userId = decodeURIComponent(path.split("/")[2] ?? "").trim();
            if (!userId)
                return json(res, 400, { error: "Missing userId" });
            await contentApi.ensureClientGallery(userId);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "PATCH" && path.match(/^\/client-galleries\/[^/]+\/meta$/)) {
            await requireAdminWithAnyScope(req, ["photography"]);
            const userId = decodeURIComponent(path.split("/")[2] ?? "").trim();
            if (!userId)
                return json(res, 400, { error: "Missing userId" });
            await contentApi.setClientGalleryPayment(userId, body.paymentConfirmed === true);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "POST" && path.match(/^\/client-galleries\/[^/]+\/photos$/)) {
            await requireAdminWithAnyScope(req, ["photography"]);
            const userId = decodeURIComponent(path.split("/")[2] ?? "").trim();
            if (!userId)
                return json(res, 400, { error: "Missing userId" });
            const id = await contentApi.addClientGalleryPhoto(userId, body);
            json(res, 200, { ok: true, id });
            return;
        }
        if (req.method === "PATCH" && path.match(/^\/client-galleries\/[^/]+\/photos\/[^/]+$/)) {
            await requireAdminWithAnyScope(req, ["photography"]);
            const parts = path.split("/").filter(Boolean);
            const userId = decodeURIComponent(parts[1] ?? "").trim();
            const photoId = decodeURIComponent(parts[3] ?? "").trim();
            if (!userId || !photoId)
                return json(res, 400, { error: "Missing ids" });
            await contentApi.patchClientGalleryPhoto(userId, photoId, body);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "DELETE" && path.match(/^\/client-galleries\/[^/]+\/photos\/[^/]+$/)) {
            await requireAdminWithAnyScope(req, ["photography"]);
            const parts = path.split("/").filter(Boolean);
            const userId = decodeURIComponent(parts[1] ?? "").trim();
            const photoId = decodeURIComponent(parts[3] ?? "").trim();
            if (!userId || !photoId)
                return json(res, 400, { error: "Missing ids" });
            await contentApi.deleteClientGalleryPhoto(userId, photoId);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "POST" && path === "/signed-contracts") {
            const clientId = String(body.clientId ?? "").trim();
            if (!clientId)
                return json(res, 400, { error: "Missing clientId" });
            await requireClientOwnUploadFromBearer(req, clientId);
            const id = await contentApi.createSignedContractSubmission(body);
            json(res, 200, { ok: true, id });
            return;
        }
        if (req.method === "PATCH" && path.match(/^\/signed-contracts\/[^/]+\/status$/)) {
            await requireAdminWithAnyScope(req, ["photography"]);
            const id = decodeURIComponent(path.split("/")[2] ?? "").trim();
            if (!id)
                return json(res, 400, { error: "Missing id" });
            await contentApi.updateSignedContractStatus(id, String(body.status ?? ""));
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "POST" && path === "/inspo-boards") {
            const id = await contentApi.createInspoBoard(body);
            json(res, 200, { ok: true, id });
            return;
        }
        if (req.method === "DELETE" && path.match(/^\/inspo-boards\/[^/]+$/)) {
            await requireAdminWithAnyScope(req, ["photography"]);
            const boardId = decodeURIComponent(path.replace("/inspo-boards/", "").split("?")[0] || "").trim();
            if (!boardId)
                return json(res, 400, { error: "Missing boardId" });
            await contentApi.deleteInspoBoard(boardId);
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === "GET" && path === "/download-dev-cv") {
            const snap = await admin.firestore().doc("portfolio/site").get();
            const dev = (snap.data()?.developmentSettings ?? {});
            const url = String(dev.cvDownloadUrl ?? "").trim();
            if (!url)
                return json(res, 404, { error: "CV not uploaded" });
            quotaGuard.redirectToExternal(res, url);
            return;
        }
        if (req.method === "GET" && path === "/download-cv") {
            const snap = await admin.firestore().doc("portfolio/xai").get();
            const data = snap.data();
            if (data?.publicEnabled === false)
                return json(res, 404, { error: "Not available" });
            const url = String(data?.cvDownloadUrl ?? "").trim();
            if (!url)
                return json(res, 404, { error: "CV not uploaded" });
            quotaGuard.redirectToExternal(res, url);
            return;
        }
        // xAI portfolio uploads (admin): videos, images, CV, thumbnails — up to 200 MB
        if (req.method === "POST" && path.startsWith("/b2/xai-portfolio-files/")) {
            await requireAdminWithAnyScope(req, ["xai"]);
            const uploadId = decodeURIComponent(path.replace("/b2/xai-portfolio-files/", "").split("?")[0] || "").trim();
            if (!uploadId) {
                json(res, 400, { error: "Missing uploadId" });
                return;
            }
            const originalName = String(req.headers["x-file-name"] ?? "file.bin").trim() || "file.bin";
            const lower = originalName.toLowerCase();
            const allowed = lower.endsWith(".png") ||
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
                json(res, 400, {
                    error: "Supported: .png, .jpg, .jpeg, .gif, .webp, .pdf, .mp4, .webm, .mov, .m4v",
                });
                return;
            }
            const buf = req.rawBody;
            if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
                json(res, 400, { error: "Missing file bytes" });
                return;
            }
            const maxXaiBytes = 200 * 1024 * 1024;
            if (buf.length > maxXaiBytes) {
                json(res, 413, { error: "File too large. Maximum size is 200 MB." });
                return;
            }
            const contentType = String(req.headers["content-type"] ?? "").trim() || "application/octet-stream";
            const sha1 = crypto.createHash("sha1").update(buf).digest("hex");
            const auth = await b2Authorize();
            const up = await b2GetUploadUrl(auth);
            const bucketName = B2_BUCKET_NAME.value();
            const b2FileName = `xai-portfolio/${uploadId}/${originalName}`;
            const uploadRes = await fetch(up.uploadUrl, {
                method: "POST",
                headers: {
                    Authorization: up.uploadAuthToken,
                    "X-Bz-File-Name": encodeURIComponent(b2FileName).replace(/%2F/g, "/"),
                    "Content-Type": contentType,
                    "X-Bz-Content-Sha1": sha1,
                },
                body: buf,
            });
            if (!uploadRes.ok) {
                const t = await uploadRes.text().catch(() => "");
                json(res, 400, { error: t || `B2 upload failed (${uploadRes.status})` });
                return;
            }
            const out = await uploadRes.json();
            const fileId = String(out.fileId ?? "");
            const fileName = String(out.fileName ?? b2FileName);
            const downloadUrl = b2PublicDownloadUrl(auth.downloadUrl, bucketName, fileName);
            json(res, 200, { fileId, fileName, downloadUrl, sizeBytes: buf.length, contentType });
            return;
        }
        const kindFromPath = () => {
            if (path.startsWith("/b2/presentations/"))
                return "presentations";
            if (path.startsWith("/b2/study-guides/"))
                return "study-guides";
            if (path.startsWith("/b2/quiz-images/"))
                return "quiz-images";
            if (path.startsWith("/b2/portfolio-images/"))
                return "portfolio-images";
            if (path.startsWith("/b2/portfolio-cv/"))
                return "portfolio-cv";
            if (path.startsWith("/b2/client-gallery-images/"))
                return "client-gallery-images";
            if (path.startsWith("/b2/signed-contracts/"))
                return "signed-contracts";
            if (path.startsWith("/b2/contract-pdfs/"))
                return "contract-pdfs";
            if (path.startsWith("/b2/livestream-audio/"))
                return "livestream-audio";
            return null;
        };
        const isAllowedExt = (k, filename) => {
            const n = filename.toLowerCase();
            if (k === "presentations")
                return n.endsWith(".pptx");
            if (k === "contract-pdfs" || k === "portfolio-cv")
                return n.endsWith(".pdf");
            if (k === "signed-contracts") {
                return n.endsWith(".pdf") || n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg");
            }
            if (k === "livestream-audio") {
                return (n.endsWith(".mp3") ||
                    n.endsWith(".m4a") ||
                    n.endsWith(".wav") ||
                    n.endsWith(".ogg") ||
                    n.endsWith(".aac"));
            }
            if (k === "quiz-images" || k === "portfolio-images" || k === "client-gallery-images") {
                return (n.endsWith(".png") ||
                    n.endsWith(".jpg") ||
                    n.endsWith(".jpeg") ||
                    n.endsWith(".gif") ||
                    n.endsWith(".webp"));
            }
            return n.endsWith(".pdf") || n.endsWith(".docx") || n.endsWith(".doc");
        };
        const defaultName = (k) => k === "presentations"
            ? "presentation.pptx"
            : k === "signed-contracts"
                ? "signed-contract.pdf"
                : k === "contract-pdfs"
                    ? "contract.pdf"
                    : k === "portfolio-cv"
                        ? "Hannington_Kuria_Njuguna_Developer_CV.pdf"
                        : k === "livestream-audio"
                            ? "track.mp3"
                            : k === "quiz-images" || k === "portfolio-images" || k === "client-gallery-images"
                                ? "image.png"
                                : "study-guide.pdf";
        // Public file redirect (published only) — avoids proxying large files through Hosting.
        if (req.method === "GET" && (path.startsWith("/public/presentations/") || path.startsWith("/public/study-guides/"))) {
            const isPptx = path.startsWith("/public/presentations/");
            const id = decodeURIComponent(path.replace(isPptx ? "/public/presentations/" : "/public/study-guides/", "").split("?")[0] || "").trim();
            if (!id)
                return json(res, 400, { error: "Missing id" });
            const col = isPptx ? "classPresentations" : "classStudyGuides";
            const snap = await admin.firestore().doc(`${col}/${id}`).get();
            if (!snap.exists)
                return json(res, 404, { error: "Not found" });
            const data = snap.data();
            if (data?.published !== true)
                return json(res, 403, { error: "Not published" });
            const bucketName = B2_BUCKET_NAME.value();
            const srcUrl = await resolvePublicFileUrl(data, bucketName);
            if (!srcUrl)
                return json(res, 404, { error: "Missing file reference" });
            quotaGuard.redirectToExternal(res, srcUrl);
            return;
        }
        // Upload bytes (admin only)
        const kind = kindFromPath();
        if (req.method === "POST" && kind) {
            if (kind === "livestream-audio") {
                await requireSuperAdminFromBearer(req);
            }
            else if (kind === "portfolio-images") {
                await requireAdminWithAnyScope(req, ["development", "photography", "xai"]);
            }
            else if (kind === "client-gallery-images") {
                await requireAdminWithAnyScope(req, ["photography"]);
            }
            else if (kind === "signed-contracts") {
                const basePrefix = "/b2/signed-contracts/";
                const pathTail = decodeURIComponent(path.replace(basePrefix, "").split("?")[0] || "").trim();
                const clientUserId = pathTail.split("/").filter(Boolean)[0] || "";
                if (!clientUserId)
                    return json(res, 400, { error: "Missing clientUserId" });
                await requireClientOwnUploadFromBearer(req, clientUserId);
            }
            else if (kind === "contract-pdfs") {
                await requireAdminWithAnyScope(req, ["photography"]);
            }
            else if (kind === "portfolio-cv") {
                await requireAdminWithAnyScope(req, ["development", "photography"]);
            }
            else if (kind === "presentations" || kind === "study-guides" || kind === "quiz-images") {
                try {
                    await requireAdminWithAnyScope(req, ["tutoring"]);
                }
                catch {
                    await requireTutorOrAdminFromBearer(req);
                }
            }
            else {
                await requireTutorOrAdminFromBearer(req);
            }
            const basePrefix = kind === "presentations"
                ? "/b2/presentations/"
                : kind === "study-guides"
                    ? "/b2/study-guides/"
                    : kind === "portfolio-images"
                        ? "/b2/portfolio-images/"
                        : kind === "client-gallery-images"
                            ? "/b2/client-gallery-images/"
                            : kind === "signed-contracts"
                                ? "/b2/signed-contracts/"
                                : kind === "contract-pdfs"
                                    ? "/b2/contract-pdfs/"
                                    : kind === "portfolio-cv"
                                        ? "/b2/portfolio-cv/"
                                        : kind === "livestream-audio"
                                            ? "/b2/livestream-audio/"
                                            : "/b2/quiz-images/";
            const pathTail = decodeURIComponent(path.replace(basePrefix, "").split("?")[0] || "").trim();
            const docId = pathTail;
            if (!docId)
                return json(res, 400, { error: "Missing docId" });
            const originalName = String(req.headers["x-file-name"] ?? defaultName(kind)).trim() || defaultName(kind);
            if (!isAllowedExt(kind, originalName)) {
                return json(res, 400, {
                    error: kind === "presentations"
                        ? "Only .pptx files are supported"
                        : kind === "contract-pdfs" || kind === "portfolio-cv"
                            ? "Only .pdf files are supported"
                            : kind === "signed-contracts"
                                ? "Only .pdf, .png, .jpg, or .jpeg files are supported"
                                : kind === "livestream-audio"
                                    ? "Supported audio: .mp3, .m4a, .wav, .ogg, .aac"
                                    : kind === "quiz-images" || kind === "portfolio-images" || kind === "client-gallery-images"
                                        ? "Only .png, .jpg, .jpeg, .gif, or .webp images are supported"
                                        : "Only .pdf, .doc, or .docx files are supported",
                });
            }
            const buf = req.rawBody;
            if (!buf || !Buffer.isBuffer(buf) || buf.length === 0)
                return json(res, 400, { error: "Missing file bytes" });
            const maxImageBytes = 32 * 1024 * 1024;
            const maxAudioBytes = 48 * 1024 * 1024;
            const maxSignedContractBytes = 20 * 1024 * 1024;
            const maxContractPdfBytes = 25 * 1024 * 1024;
            if ((kind === "quiz-images" || kind === "portfolio-images" || kind === "client-gallery-images") &&
                buf.length > maxImageBytes) {
                return json(res, 413, { error: "Image too large. Maximum size is 32 MB per file." });
            }
            if (kind === "livestream-audio" && buf.length > maxAudioBytes) {
                return json(res, 413, { error: "Audio too large. Maximum size is 48 MB." });
            }
            if (kind === "signed-contracts" && buf.length > maxSignedContractBytes) {
                return json(res, 413, { error: "File too large. Maximum size is 20 MB." });
            }
            if ((kind === "contract-pdfs" || kind === "portfolio-cv") && buf.length > maxContractPdfBytes) {
                return json(res, 413, { error: "PDF too large. Maximum size is 25 MB." });
            }
            const contentTypeRaw = String(req.headers["content-type"] ?? "").trim();
            const contentType = contentTypeRaw ||
                (kind === "presentations"
                    ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    : kind === "contract-pdfs" || kind === "portfolio-cv" || kind === "signed-contracts"
                        ? "application/pdf"
                        : kind === "quiz-images" || kind === "portfolio-images" || kind === "client-gallery-images"
                            ? "application/octet-stream"
                            : "application/octet-stream");
            const sha1 = crypto.createHash("sha1").update(buf).digest("hex");
            const auth = await b2Authorize();
            const up = await b2GetUploadUrl(auth);
            const bucketName = B2_BUCKET_NAME.value();
            const prefix = kind === "presentations"
                ? "class-presentations"
                : kind === "study-guides"
                    ? "class-study-guides"
                    : kind === "portfolio-images"
                        ? "portfolio-images"
                        : kind === "client-gallery-images"
                            ? "client-gallery-images"
                            : kind === "signed-contracts"
                                ? "signed-contracts"
                                : kind === "contract-pdfs"
                                    ? "contract-pdfs"
                                    : kind === "portfolio-cv"
                                        ? "portfolio-cv"
                                        : kind === "livestream-audio"
                                            ? "livestream-audio"
                                            : "quiz-question-images";
            const b2FileName = `${prefix}/${docId}/${originalName}`;
            const uploadRes = await fetch(up.uploadUrl, {
                method: "POST",
                headers: {
                    Authorization: up.uploadAuthToken,
                    "X-Bz-File-Name": encodeURIComponent(b2FileName).replace(/%2F/g, "/"),
                    "Content-Type": contentType,
                    "X-Bz-Content-Sha1": sha1,
                },
                body: buf,
            });
            if (!uploadRes.ok) {
                const t = await uploadRes.text().catch(() => "");
                return json(res, 400, { error: t || `B2 upload failed (${uploadRes.status})` });
            }
            const out = await uploadRes.json();
            const fileId = String(out.fileId ?? "");
            const fileName = String(out.fileName ?? b2FileName);
            const downloadUrl = b2PublicDownloadUrl(auth.downloadUrl, bucketName, fileName);
            return json(res, 200, { fileId, fileName, downloadUrl, sizeBytes: buf.length, contentType });
        }
        // Delete (admin only)
        if (req.method === "DELETE" && (path === "/b2/presentations" || path === "/b2/study-guides")) {
            await requireTutorOrAdminFromBearer(req);
            const body = (req.body ?? {});
            const fileId = String(body.fileId ?? "").trim();
            const fileName = String(body.fileName ?? "").trim();
            // Allow deleting Firestore rows that never finished uploading (no B2 reference).
            if (!fileId || !fileName)
                return json(res, 200, { ok: true, skippedB2: true });
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
        const blockGameHandled = await blockGameApi.handleBlockGameApi(req, res, path, {
            ensureAdmin,
            requireAdminFromBearer,
        });
        if (blockGameHandled)
            return;
        return json(res, 404, { error: "Not found" });
    }
    catch (e) {
        const msg = typeof e?.message === "string" ? e.message : "Request failed";
        const status = msg === "Forbidden" ? 403 : msg === "Missing auth token" ? 401 : 400;
        return json(res, status, { error: msg });
    }
});

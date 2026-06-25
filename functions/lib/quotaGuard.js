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
exports.MAX_REQUESTS_PER_IP_PER_HOUR = exports.MAX_DAILY_FIRESTORE_WRITES = exports.MAX_DAILY_FIRESTORE_READS = exports.MAX_DAILY_EGRESS_BYTES = void 0;
exports.clientIp = clientIp;
exports.userAgent = userAgent;
exports.isBlockedCrawler = isBlockedCrawler;
exports.checkApiQuota = checkApiQuota;
exports.reserveEgress = reserveEgress;
exports.redirectToExternal = redirectToExternal;
const admin = __importStar(require("firebase-admin"));
/** Daily caps — protect against billing spikes. */
exports.MAX_DAILY_EGRESS_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
exports.MAX_DAILY_FIRESTORE_READS = 1000;
exports.MAX_DAILY_FIRESTORE_WRITES = 1000;
exports.MAX_REQUESTS_PER_IP_PER_HOUR = 120;
const CRAWLER_UA = /GPTBot|ChatGPT-User|OAI-SearchBot|PerplexityBot|anthropic-ai|ClaudeBot|Claude-Web|Google-Extended|Bytespider|CCBot|Amazonbot|SemrushBot|AhrefsBot|DotBot|PetalBot|MJ12bot|Baiduspider|YandexBot|facebookexternalhit|meta-externalagent|Applebot-Extended|cohere-ai|Diffbot|Scrapy|python-requests|curl\/|wget\/|Go-http-client|HeadlessChrome|Puppeteer|Playwright|PhantomJS|ia_archiver/i;
function ensureAdmin() {
    if (!admin.apps.length)
        admin.initializeApp();
}
function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
function currentHourKey() {
    const d = new Date();
    return `${d.toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH
}
function clientIp(req) {
    const fwd = String(req.headers?.["x-forwarded-for"] ?? "")
        .split(",")[0]
        ?.trim();
    return fwd || String(req.ip ?? "unknown");
}
function userAgent(req) {
    return String(req.headers?.["user-agent"] ?? "");
}
function isBlockedCrawler(req) {
    return CRAWLER_UA.test(userAgent(req));
}
function quotaRef() {
    ensureAdmin();
    return admin.firestore().doc(`system/apiQuota/${todayKey()}`);
}
/** Gate API traffic: per-IP hourly cap + daily read/write budgets. */
async function checkApiQuota(req, opts = {}) {
    if (opts.blockCrawlers && isBlockedCrawler(req)) {
        return { ok: false, status: 403, message: "Automated crawlers are not permitted on this endpoint." };
    }
    const ip = clientIp(req);
    const hour = currentHourKey();
    const isWrite = opts.isWrite === true;
    try {
        const result = await admin.firestore().runTransaction(async (tx) => {
            const ref = quotaRef();
            const snap = await tx.get(ref);
            const data = (snap.exists ? snap.data() : {}) ?? {};
            const egressBytes = Number(data.egressBytes ?? 0);
            const firestoreReads = Number(data.firestoreReads ?? 0);
            const firestoreWrites = Number(data.firestoreWrites ?? 0);
            const ipBuckets = { ...(data.ipBuckets ?? {}) };
            const bucket = ipBuckets[ip] ?? { hour, count: 0 };
            const ipCount = bucket.hour === hour ? bucket.count + 1 : 1;
            if (ipCount > exports.MAX_REQUESTS_PER_IP_PER_HOUR) {
                return { ok: false, status: 429, message: "Too many requests from this IP. Try again later." };
            }
            const nextReads = firestoreReads + 1;
            if (nextReads > exports.MAX_DAILY_FIRESTORE_READS) {
                return {
                    ok: false,
                    status: 429,
                    message: "Daily API read quota reached. Resets at midnight UTC.",
                };
            }
            let nextWrites = firestoreWrites;
            if (isWrite) {
                nextWrites += 1;
                if (nextWrites > exports.MAX_DAILY_FIRESTORE_WRITES) {
                    return {
                        ok: false,
                        status: 429,
                        message: "Daily API write quota reached. Resets at midnight UTC.",
                    };
                }
            }
            ipBuckets[ip] = { hour, count: ipCount };
            tx.set(ref, {
                egressBytes,
                firestoreReads: nextReads,
                firestoreWrites: nextWrites,
                ipBuckets,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { ok: true };
        });
        return result;
    }
    catch {
        // Fail open for authenticated admin flows if quota doc fails — still rate-limit crawlers above.
        return { ok: true };
    }
}
/** Reserve egress budget before streaming (redirects should not call this). */
async function reserveEgress(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0)
        return { ok: true };
    try {
        return await admin.firestore().runTransaction(async (tx) => {
            const ref = quotaRef();
            const snap = await tx.get(ref);
            const data = (snap.exists ? snap.data() : {}) ?? {};
            const egressBytes = Number(data.egressBytes ?? 0);
            const next = egressBytes + bytes;
            if (next > exports.MAX_DAILY_EGRESS_BYTES) {
                return {
                    ok: false,
                    status: 429,
                    message: "Daily download bandwidth quota reached. Resets at midnight UTC.",
                };
            }
            tx.set(ref, { egressBytes: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            return { ok: true };
        });
    }
    catch {
        return { ok: true };
    }
}
function redirectToExternal(res, url) {
    res.set("Cache-Control", "public, max-age=3600");
    res.redirect(302, url);
}

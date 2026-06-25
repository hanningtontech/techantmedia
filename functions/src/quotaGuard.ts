import * as admin from "firebase-admin";

/** Daily caps — protect against billing spikes. */
export const MAX_DAILY_EGRESS_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
export const MAX_DAILY_FIRESTORE_READS = 1000;
export const MAX_DAILY_FIRESTORE_WRITES = 1000;
export const MAX_REQUESTS_PER_IP_PER_HOUR = 120;

const CRAWLER_UA =
  /GPTBot|ChatGPT-User|OAI-SearchBot|PerplexityBot|anthropic-ai|ClaudeBot|Claude-Web|Google-Extended|Bytespider|CCBot|Amazonbot|SemrushBot|AhrefsBot|DotBot|PetalBot|MJ12bot|Baiduspider|YandexBot|facebookexternalhit|meta-externalagent|Applebot-Extended|cohere-ai|Diffbot|Scrapy|python-requests|curl\/|wget\/|Go-http-client|HeadlessChrome|Puppeteer|Playwright|PhantomJS|ia_archiver/i;

type QuotaDoc = {
  egressBytes?: number;
  firestoreReads?: number;
  firestoreWrites?: number;
  ipBuckets?: Record<string, { hour: string; count: number }>;
};

function ensureAdmin() {
  if (!admin.apps.length) admin.initializeApp();
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentHourKey(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH
}

export function clientIp(req: { headers?: Record<string, unknown>; ip?: string }): string {
  const fwd = String(req.headers?.["x-forwarded-for"] ?? "")
    .split(",")[0]
    ?.trim();
  return fwd || String(req.ip ?? "unknown");
}

export function userAgent(req: { headers?: Record<string, unknown> }): string {
  return String(req.headers?.["user-agent"] ?? "");
}

export function isBlockedCrawler(req: { headers?: Record<string, unknown> }): boolean {
  return CRAWLER_UA.test(userAgent(req));
}

function quotaRef() {
  ensureAdmin();
  return admin.firestore().doc(`system/apiQuota/${todayKey()}`);
}

export type QuotaCheckResult =
  | { ok: true }
  | { ok: false; status: 429 | 403; message: string };

/** Gate API traffic: per-IP hourly cap + daily read/write budgets. */
export async function checkApiQuota(
  req: { headers?: Record<string, unknown>; ip?: string; method?: string },
  opts: { isWrite?: boolean; blockCrawlers?: boolean } = {},
): Promise<QuotaCheckResult> {
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
      const data = (snap.exists ? (snap.data() as QuotaDoc) : {}) ?? {};
      const egressBytes = Number(data.egressBytes ?? 0);
      const firestoreReads = Number(data.firestoreReads ?? 0);
      const firestoreWrites = Number(data.firestoreWrites ?? 0);
      const ipBuckets = { ...(data.ipBuckets ?? {}) };

      const bucket = ipBuckets[ip] ?? { hour, count: 0 };
      const ipCount = bucket.hour === hour ? bucket.count + 1 : 1;
      if (ipCount > MAX_REQUESTS_PER_IP_PER_HOUR) {
        return { ok: false as const, status: 429 as const, message: "Too many requests from this IP. Try again later." };
      }

      const nextReads = firestoreReads + 1;
      if (nextReads > MAX_DAILY_FIRESTORE_READS) {
        return {
          ok: false as const,
          status: 429 as const,
          message: "Daily API read quota reached. Resets at midnight UTC.",
        };
      }

      let nextWrites = firestoreWrites;
      if (isWrite) {
        nextWrites += 1;
        if (nextWrites > MAX_DAILY_FIRESTORE_WRITES) {
          return {
            ok: false as const,
            status: 429 as const,
            message: "Daily API write quota reached. Resets at midnight UTC.",
          };
        }
      }

      ipBuckets[ip] = { hour, count: ipCount };
      tx.set(
        ref,
        {
          egressBytes,
          firestoreReads: nextReads,
          firestoreWrites: nextWrites,
          ipBuckets,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: true as const };
    });
    return result;
  } catch {
    // Fail open for authenticated admin flows if quota doc fails — still rate-limit crawlers above.
    return { ok: true };
  }
}

/** Reserve egress budget before streaming (redirects should not call this). */
export async function reserveEgress(bytes: number): Promise<QuotaCheckResult> {
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: true };
  try {
    return await admin.firestore().runTransaction(async (tx) => {
      const ref = quotaRef();
      const snap = await tx.get(ref);
      const data = (snap.exists ? (snap.data() as QuotaDoc) : {}) ?? {};
      const egressBytes = Number(data.egressBytes ?? 0);
      const next = egressBytes + bytes;
      if (next > MAX_DAILY_EGRESS_BYTES) {
        return {
          ok: false as const,
          status: 429 as const,
          message: "Daily download bandwidth quota reached. Resets at midnight UTC.",
        };
      }
      tx.set(ref, { egressBytes: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { ok: true as const };
    });
  } catch {
    return { ok: true };
  }
}

export function redirectToExternal(res: any, url: string): void {
  res.set("Cache-Control", "public, max-age=3600");
  res.redirect(302, url);
}

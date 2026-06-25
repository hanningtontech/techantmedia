import { randomBytes } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const SECRETS_DOC = "adminSecrets/livestream";

export function generateStreamKey(): string {
  return `sk_${randomBytes(16).toString("hex")}`;
}

export async function getOrCreateStreamKey(): Promise<string> {
  const ref = getFirestore().doc(SECRETS_DOC);
  const snap = await ref.get();
  const existing = String(snap.data()?.streamKey ?? "").trim();
  if (existing) return existing;

  const streamKey = generateStreamKey();
  await ref.set({ streamKey, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return streamKey;
}

export async function regenerateStreamKey(): Promise<string> {
  const streamKey = generateStreamKey();
  await getFirestore().doc(SECRETS_DOC).set({ streamKey, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return streamKey;
}

export async function probeHlsManifest(url: string): Promise<boolean> {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(trimmed, {
      method: "GET",
      headers: { Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes("#EXTM3U");
  } catch {
    return false;
  }
}

export async function updateLivestreamStreamStatus(status: "offline" | "connecting" | "live"): Promise<void> {
  await getFirestore().doc("portfolio/livestream").set(
    { streamStatus: status, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/** OBS: Server = RTMP URL, Stream Key = secret key. */
export function formatObsCredentials(rtmpIngestUrl: string, streamKey: string) {
  return {
    obsServer: rtmpIngestUrl.trim().replace(/\/+$/, ""),
    obsStreamKey: streamKey,
  };
}

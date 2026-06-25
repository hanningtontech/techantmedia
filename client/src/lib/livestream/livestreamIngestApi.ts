import { apiFetch } from "@/lib/api/authenticatedFetch";
import type { LivestreamIngestSecrets } from "@/lib/livestream/livestreamTypes";

export type LivestreamIngestInfo = LivestreamIngestSecrets & {
  rtmpIngestUrl: string;
  hlsPlaybackUrl: string;
  obsServer: string;
  obsStreamKey: string;
};

export async function fetchLivestreamIngest(): Promise<LivestreamIngestInfo> {
  const res = await apiFetch("/api/livestream/ingest");
  return res.json() as Promise<LivestreamIngestInfo>;
}

export async function regenerateLivestreamKey(): Promise<LivestreamIngestInfo> {
  const res = await apiFetch("/api/livestream/regenerate-key", { method: "POST" });
  return res.json() as Promise<LivestreamIngestInfo>;
}

export async function probeLivestreamStatus(): Promise<{ streamStatus: string; ok: boolean }> {
  const res = await apiFetch("/api/livestream/probe", { method: "POST" });
  return res.json() as Promise<{ streamStatus: string; ok: boolean }>;
}

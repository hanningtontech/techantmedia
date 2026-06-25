import { SITE_URL } from "@/lib/seo/constants";

/** Production site — used when deriving stream endpoints. */
export const LIVE_SITE_ORIGIN = SITE_URL.replace(/\/$/, "");

function siteHostname(): string {
  try {
    return new URL(LIVE_SITE_ORIGIN).hostname;
  } catch {
    return "techantmedia.com";
  }
}

/**
 * Default HLS manifest on your domain (reverse-proxy to your media server).
 * Override with VITE_LIVESTREAM_HLS_URL in .env if your path differs.
 */
export function defaultLivestreamHlsUrl(): string {
  const fromEnv = (import.meta.env.VITE_LIVESTREAM_HLS_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  return `${LIVE_SITE_ORIGIN}/live/index.m3u8`;
}

/**
 * Default RTMP ingest for OBS (Custom service).
 * Override with VITE_LIVESTREAM_RTMP_URL in .env if needed.
 */
export function defaultLivestreamRtmpUrl(): string {
  const fromEnv = (import.meta.env.VITE_LIVESTREAM_RTMP_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  return `rtmp://${siteHostname()}/live`;
}

/** Fill empty stream URL fields with techantmedia.com defaults. */
export function withLivestreamUrlDefaults<T extends { hlsPlaybackUrl?: string; rtmpIngestUrl?: string }>(
  settings: T,
): T {
  return {
    ...settings,
    hlsPlaybackUrl: String(settings.hlsPlaybackUrl ?? "").trim() || defaultLivestreamHlsUrl(),
    rtmpIngestUrl: String(settings.rtmpIngestUrl ?? "").trim() || defaultLivestreamRtmpUrl(),
  };
}

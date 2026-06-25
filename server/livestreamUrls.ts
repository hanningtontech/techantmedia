const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || "https://techantmedia.com").replace(/\/$/, "");

function siteHostname(): string {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return "techantmedia.com";
  }
}

export function defaultLivestreamHlsUrl(): string {
  const fromEnv = process.env.LIVESTREAM_HLS_URL?.trim() || process.env.VITE_LIVESTREAM_HLS_URL?.trim();
  if (fromEnv) return fromEnv;
  return `${SITE_URL}/live/index.m3u8`;
}

export function defaultLivestreamRtmpUrl(): string {
  const fromEnv = process.env.LIVESTREAM_RTMP_URL?.trim() || process.env.VITE_LIVESTREAM_RTMP_URL?.trim();
  if (fromEnv) return fromEnv;
  return `rtmp://${siteHostname()}/live`;
}

export function withLivestreamUrlDefaults<T extends { hlsPlaybackUrl?: string; rtmpIngestUrl?: string }>(
  settings: T,
): T {
  return {
    ...settings,
    hlsPlaybackUrl: String(settings.hlsPlaybackUrl ?? "").trim() || defaultLivestreamHlsUrl(),
    rtmpIngestUrl: String(settings.rtmpIngestUrl ?? "").trim() || defaultLivestreamRtmpUrl(),
  };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLivestreamHlsUrl = defaultLivestreamHlsUrl;
exports.defaultLivestreamRtmpUrl = defaultLivestreamRtmpUrl;
exports.withLivestreamUrlDefaults = withLivestreamUrlDefaults;
const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || "https://techantmedia.com").replace(/\/$/, "");
function siteHostname() {
    try {
        return new URL(SITE_URL).hostname;
    }
    catch {
        return "techantmedia.com";
    }
}
function defaultLivestreamHlsUrl() {
    const fromEnv = process.env.LIVESTREAM_HLS_URL?.trim() || process.env.VITE_LIVESTREAM_HLS_URL?.trim();
    if (fromEnv)
        return fromEnv;
    return `${SITE_URL}/live/index.m3u8`;
}
function defaultLivestreamRtmpUrl() {
    const fromEnv = process.env.LIVESTREAM_RTMP_URL?.trim() || process.env.VITE_LIVESTREAM_RTMP_URL?.trim();
    if (fromEnv)
        return fromEnv;
    return `rtmp://${siteHostname()}/live`;
}
function withLivestreamUrlDefaults(settings) {
    return {
        ...settings,
        hlsPlaybackUrl: String(settings.hlsPlaybackUrl ?? "").trim() || defaultLivestreamHlsUrl(),
        rtmpIngestUrl: String(settings.rtmpIngestUrl ?? "").trim() || defaultLivestreamRtmpUrl(),
    };
}

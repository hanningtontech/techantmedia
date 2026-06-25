import type { VideoSourceKind } from "./xaiPortfolioTypes";

export type ParsedVideo = {
  kind: VideoSourceKind;
  embedUrl: string | null;
  videoId?: string;
};

export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0]?.split("?")[0];
      return id && id.length >= 6 ? id : null;
    }

    if (host.includes("youtube.com") || host === "m.youtube.com") {
      const v = parsed.searchParams.get("v");
      if (v && v.length >= 6) return v;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];

      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
    }
  } catch {
    /* invalid URL */
  }

  return null;
}

export function detectVideoKind(url: string): VideoSourceKind {
  const u = url.trim().toLowerCase();
  if (!u) return "none";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return "self-hosted";
  if (u.startsWith("http") && (u.includes("/file/") || u.includes("backblazeb2.com") || u.includes(".b2."))) {
    return "self-hosted";
  }
  if (u.startsWith("http")) return "self-hosted";
  return "self-hosted";
}

export function parseVideoEmbed(url: string, kind?: VideoSourceKind): ParsedVideo {
  const trimmed = url.trim();
  if (!trimmed) return { kind: "none", embedUrl: null };

  const autoKind = detectVideoKind(trimmed);
  const resolvedKind =
    kind && kind !== "none"
      ? kind === "self-hosted" && (autoKind === "youtube" || autoKind === "vimeo")
        ? autoKind
        : kind
      : autoKind;

  if (resolvedKind === "youtube") {
    const id = extractYouTubeId(trimmed);
    if (id) {
      return {
        kind: "youtube",
        videoId: id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      };
    }
  }

  if (resolvedKind === "vimeo") {
    try {
      const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
      }
    } catch {
      /* fall through */
    }
  }

  if (resolvedKind === "self-hosted" && trimmed) {
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return { kind: "self-hosted", embedUrl: href };
  }

  return { kind: resolvedKind, embedUrl: null };
}

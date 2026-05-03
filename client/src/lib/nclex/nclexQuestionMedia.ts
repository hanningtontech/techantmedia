/** Split on http(s) URLs while keeping delimiters (String.split with capturing group). */
export const NCLEX_URL_SPLIT_RE = /(https?:\/\/[^\s<>"'\u2019]+)/gi;

/** Wikimedia production thumbnail width steps; other widths return 400 (see https://w.wiki/GHai). */
const WIKIMEDIA_THUMB_WIDTH_STEPS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840] as const;

function wikimediaThumbStepForRequested(width: number): number {
  for (const s of WIKIMEDIA_THUMB_WIDTH_STEPS) {
    if (s >= width) return s;
  }
  return WIKIMEDIA_THUMB_WIDTH_STEPS[WIKIMEDIA_THUMB_WIDTH_STEPS.length - 1]!;
}

/** Rewrites e.g. `.../800px-File.jpg` → `.../960px-File.jpg` when width is not an allowed step. */
function rewriteWikimediaThumbUrlIfNeeded(url: string): string {
  const low = url.toLowerCase();
  if (!low.includes("upload.wikimedia.org") && !low.includes("commons.wikimedia.org")) return url;
  if (!url.includes("/thumb/")) return url;
  try {
    const parsed = new URL(url);
    const segs = parsed.pathname.split("/").filter(Boolean);
    if (!segs.length) return url;
    const last = segs[segs.length - 1] ?? "";
    const m = /^(\d+)px-(.+)$/i.exec(last);
    if (!m) return url;
    const requested = Number(m[1]);
    if (!Number.isFinite(requested) || requested <= 0) return url;
    if ((WIKIMEDIA_THUMB_WIDTH_STEPS as readonly number[]).includes(requested)) return url;
    const step = wikimediaThumbStepForRequested(requested);
    segs[segs.length - 1] = `${step}px-${m[2]}`;
    parsed.pathname = `/${segs.join("/")}`;
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Strips trailing punctuation and wrapping parens often pasted after URLs in prose
 * (e.g. "…swelling.png." or "(https://…/x.png)"). Keeps real query strings intact.
 */
export function normalizeHttpUrlForMedia(url: string): string {
  let u = url.trim().replace(/[\u201c\u201d]/g, '"');
  if (u.startsWith("(") && u.endsWith(")")) u = u.slice(1, -1).trim();
  const tail = /[)\].,;:!?]+$/;
  let guard = 0;
  while (tail.test(u) && guard++ < 12) {
    const next = u.replace(tail, "");
    if (next === u) break;
    u = next;
  }
  return rewriteWikimediaThumbUrlIfNeeded(u);
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?[^#\s]*)?(#\S*)?$/i;

/** True when a standalone URL is very likely an image (file extension or known image/CDN hosts). */
export function isProbablyImageUrl(url: string): boolean {
  const u = normalizeHttpUrlForMedia(url);
  if (IMAGE_EXT_RE.test(u)) return true;
  const low = u.toLowerCase();
  // Firebase / Google object URLs often omit a tidy ".png" suffix before query params.
  if (low.includes("firebasestorage.googleapis.com")) return true;
  if (low.includes("googleusercontent.com")) return true;
  if (low.includes("storage.googleapis.com")) return true;
  if (low.includes("backblazeb2.com")) return true;
  // Signed / proxied responses that declare an image content type
  if (/[?&]content-type=image%2F/i.test(low) || /[?&]response-content-type=image%2F/i.test(low)) return true;
  if (/[?&]content-type=image\//i.test(low) || /[?&]response-content-type=image\//i.test(low)) return true;
  if (/[?&]format=(png|jpe?g|gif|webp|svg)/i.test(low)) return true;
  if (/[?&]fm=(png|jpe?g|gif|webp|svg)/i.test(low)) return true;
  if (/^https?:\/\/(i\.)?imgur\.com\//i.test(u)) return true;
  if (/\.cloudinary\.com\/.+\/(image|fetch)\//i.test(low)) return true;
  // Wikimedia Commons / Wikipedia file delivery (paths often include /thumb/…/NNNpx-…).
  if (/^https?:\/\/(upload|commons)\.wikimedia\.org\//i.test(u)) return true;
  return false;
}

export function extractFirstImageUrlFromText(text: string): string | null {
  if (!text.trim()) return null;
  const re = /https?:\/\/[^\s<>"'\u2019]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const cleaned = normalizeHttpUrlForMedia(m[0]);
    if (isProbablyImageUrl(cleaned)) return cleaned;
  }
  return null;
}

/** Removes the first image-like URL from prose so it can be shown once (e.g. dedicated stem figure). */
export function stripFirstImageUrlFromText(text: string): string {
  if (!text.trim()) return text;
  const re = /https?:\/\/[^\s<>"'\u2019]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const cleaned = normalizeHttpUrlForMedia(m[0]);
    if (!isProbablyImageUrl(cleaned)) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    return `${text.slice(0, start)}${text.slice(end)}`.replace(/\n{3,}/g, "\n\n").trim();
  }
  return text;
}

/** Pixabay blocks cross-site loads of `cdn.pixabay.com` files (403); a normal img embed will not work. */
export function isPixabayCdnHotlinkBlocked(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === "cdn.pixabay.com";
  } catch {
    return false;
  }
}

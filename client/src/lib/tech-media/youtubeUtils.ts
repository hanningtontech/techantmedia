/** Normalize a YouTube video ID from a bare ID or full URL. */
export function extractYoutubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0] ?? "";
    if (url.searchParams.get("v")) return url.searchParams.get("v") ?? "";
    const parts = url.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  } catch {
    /* not a URL */
  }
  return trimmed;
}

export function youtubeThumbnailUrl(input: string): string {
  const id = extractYoutubeId(input);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : "";
}

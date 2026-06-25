/** Canonical public site — all routes (marketing + admin/student/tutor) live here. */
export const SITE_ORIGIN = (
  (import.meta.env.VITE_SITE_URL as string | undefined) || "https://techantmedia.com"
).replace(/\/$/, "");

/** @deprecated Use same-origin paths; kept for callers that expect a URL helper. */
export const APP_ORIGIN = SITE_ORIGIN;

/** Same-origin path on techantmedia.com (no separate app subdomain). */
export function appUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p;
}

/** Absolute URL when needed for SEO, emails, or external links. */
export function siteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${p}`;
}

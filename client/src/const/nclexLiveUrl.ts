import { appUrl } from "@/lib/seo/appOrigin";

/**
 * Default link for "Launch practice app" on `/tutoring`.
 * `VITE_NCLEX_APP_URL` in `.env` / CI still wins when set (useful for staging).
 */
export const NCLEX_APP_URL_FALLBACK = "";

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getNclexAppUrl(): string {
  const fromEnv = String(import.meta.env.VITE_NCLEX_APP_URL ?? "").trim();
  if (fromEnv) return stripTrailingSlashes(fromEnv);
  const fallback = NCLEX_APP_URL_FALLBACK.trim();
  if (fallback) return stripTrailingSlashes(fallback);
  return appUrl("/student/nclex");
}

import { SITE_URL } from "@/lib/seo/constants";

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  try {
    hosts.add(normalizeHost(new URL(SITE_URL).hostname));
  } catch {
    hosts.add("techantmedia.com");
  }

  const extra = String(import.meta.env.VITE_LIVESTREAM_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => normalizeHost(h))
    .filter(Boolean);
  for (const h of extra) hosts.add(h);

  return hosts;
}

/**
 * `/livestream` is a hidden route — only available on the site's custom domain
 * (not linked in nav). Local dev is always allowed.
 */
export function isLivestreamHostAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  const current = normalizeHost(window.location.hostname);
  return allowedHosts().has(current);
}

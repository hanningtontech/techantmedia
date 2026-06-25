/** Canonical production origin — override with VITE_SITE_URL for staging. */
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) || "https://techantmedia.com"
).replace(/\/$/, "");

export const SITE_NAME = "TechantMedia";
export const SITE_OWNER = "Hannington Kuria Njuguna";
export const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80&auto=format&fit=crop";
export const DEFAULT_LOCALE = "en_KE";

/**
 * Writes sitemap.xml into client/public before Vite build.
 * Run: node scripts/generate-seo-static.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "client", "public", "sitemap.xml");

const SITE_URL = (process.env.VITE_SITE_URL || "https://techantmedia.com").replace(/\/$/, "");

const GALLERY_SLUGS = [
  "wedding",
  "traditional",
  "engagement",
  "couples",
  "ladies",
  "gents",
  "kids-family",
  "maternity",
  "graduation",
  "corporate",
  "studio",
  "black-white",
  "fashion",
  "events",
  "product",
  "lifestyle",
];

const CONTRACT_SLUGS = ["photography-videography", "vixen-release"];

const PATHS = [
  "/",
  "/photography",
  "/development",
  "/tutoring",
  "/nclex-platform",
  "/contact",
  "/portfolio",
  "/developer-portfolio",
  "/photography/contracts",
  ...GALLERY_SLUGS.map((s) => `/photography/gallery/${s}`),
  ...CONTRACT_SLUGS.map((s) => `/photography/contracts/${s}`),
];

const lastmod = new Date().toISOString().slice(0, 10);

const urls = PATHS.map(
  (p) => `  <url>
    <loc>${SITE_URL}${p}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p === "/" ? "weekly" : "monthly"}</changefreq>
    <priority>${p === "/" ? "1.0" : p.includes("/gallery/") ? "0.7" : "0.8"}</priority>
  </url>`,
).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, xml, "utf8");
console.log(`[seo] Wrote ${PATHS.length} URLs to client/public/sitemap.xml`);

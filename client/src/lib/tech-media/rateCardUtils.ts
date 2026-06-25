import type { RateCardCategory, RateCardGroup, RateCardPackage } from "@/lib/portfolio/portfolioTypes";

export const RATE_CARD_CATEGORY_LABELS: Record<RateCardCategory, string> = {
  wedding: "Wedding",
  corporate: "Corporate",
  portraits: "Portraits & studio",
  videography: "Videography",
  events: "Events",
  studio: "Studio",
  other: "Other",
};

export const RATE_CARD_CATEGORIES: RateCardCategory[] = [
  "wedding",
  "corporate",
  "portraits",
  "videography",
  "events",
  "studio",
  "other",
];

function parseLines(raw: string[] | undefined, detailFallback: string): string[] {
  if (raw?.length) return raw.map((s) => s.trim()).filter(Boolean);
  const detail = detailFallback.trim();
  if (!detail) return [];
  return detail
    .split(/[·•|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function packageFeatures(pkg: RateCardPackage): string[] {
  return parseLines(pkg.features, pkg.detail);
}

export function packageIncludes(pkg: RateCardPackage): string[] {
  return parseLines(pkg.includes, "");
}

export function groupPreviewPackage(group: RateCardGroup): RateCardPackage | undefined {
  return group.packages.find((p) => p.highlight) ?? group.packages[0];
}

export function formatWhatsappDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("254") && d.length >= 12) {
    return `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return digits.trim();
}

export function guessCategoryFromLabel(label: string): RateCardCategory {
  const l = label.toLowerCase();
  if (l.includes("wedding")) return "wedding";
  if (l.includes("engagement") || l.includes("anniversary") || l.includes("funeral") || l.includes("memorial"))
    return "other";
  if (l.includes("birthday") || l.includes("graduation")) return "events";
  if (l.includes("real estate") || l.includes("listing")) return "other";
  if (l.includes("video")) return "videography";
  if (l.includes("portrait") || l.includes("studio")) return "portraits";
  if (l.includes("corporate")) return "corporate";
  if (l.includes("event")) return "events";
  return "other";
}

import { getCategoryAccent, type CategoryAccent } from "@/lib/portfolio/categoryAccent";
import type { PhotoCategory, RateCardGroup } from "@/lib/portfolio/portfolioTypes";

/** Default gallery category links for built-in rate card groups (photo category ids). */
export const RATE_GROUP_DEFAULT_GALLERY_IDS: Record<string, string> = {
  "rates-packages": "cat-wedding",
  "rates-engagement": "cat-engagement",
  "rates-anniversary": "cat-couples",
  "rates-birthdays": "cat-events",
  "rates-graduation": "cat-graduation",
  "rates-funeral": "",
  "rates-corporate": "cat-corporate",
  "rates-real-estate": "cat-product",
  "rates-portraits": "cat-studio",
  "rates-video": "",
};

function accentSlugForGroup(group: RateCardGroup): string {
  const label = group.label.toLowerCase();
  const id = group.id.toLowerCase();

  if (label.includes("wedding") || id.includes("rates-packages") || id === "rates-packages") return "wedding";
  if (label.includes("engagement")) return "engagement";
  if (label.includes("anniversary")) return "couples";
  if (label.includes("birthday")) return "events";
  if (label.includes("graduation")) return "graduation";
  if (label.includes("funeral") || label.includes("memorial")) return "black-white";
  if (label.includes("corporate")) return "corporate";
  if (label.includes("real estate") || label.includes("listing")) return "product";
  if (label.includes("portrait") || label.includes("studio")) return "studio";
  if (label.includes("video") || group.category === "videography") return "studio";
  if (group.category === "wedding") return "wedding";
  if (group.category === "events") return "events";
  if (group.category === "corporate") return "corporate";
  if (group.category === "portraits") return "studio";

  return label.replace(/\s+/g, "-") || "lifestyle";
}

export function getRateCardAccent(group: RateCardGroup): CategoryAccent {
  return getCategoryAccent(accentSlugForGroup(group), group.id);
}

export function resolveRateCardGalleryCategoryId(group: RateCardGroup): string {
  const linked = group.linkedGalleryCategoryId?.trim() ?? "";
  if (linked) return linked;
  return RATE_GROUP_DEFAULT_GALLERY_IDS[group.id] ?? "";
}

export function getRateCardSamplesHref(
  group: RateCardGroup,
  photoCategories: PhotoCategory[],
): string | null {
  const catId = resolveRateCardGalleryCategoryId(group);
  if (!catId) return null;
  const cat = photoCategories.find((c) => c.id === catId && c.visible);
  if (!cat) return null;
  return `/photography/gallery/${cat.slug}`;
}

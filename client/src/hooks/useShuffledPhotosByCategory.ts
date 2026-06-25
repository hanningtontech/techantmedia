import { useRef } from "react";
import type { SitePhotoItem } from "@/lib/portfolio/portfolioTypes";
import { shufflePhotosWithFeaturedFirst } from "@/lib/portfolio/galleryUtils";

function mapFingerprint(map: Map<string, SitePhotoItem[]>): string {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([catId, photos]) => `${catId}=${photos.map((p) => `${p.id}:${p.featured ? 1 : 0}`).join(",")}`)
    .join("|");
}

/**
 * Shuffles photo lists inside a category map once per mount / data load.
 */
export function useShuffledPhotosByCategory(
  map: Map<string, SitePhotoItem[]>,
  resetKey = "gallery",
): Map<string, SitePhotoItem[]> {
  const cacheRef = useRef<{ key: string; result: Map<string, SitePhotoItem[]> } | null>(null);

  const fp = `${resetKey}::${mapFingerprint(map)}`;

  if (cacheRef.current?.key !== fp) {
    const next = new Map<string, SitePhotoItem[]>();
    for (const [catId, photos] of map) {
      next.set(catId, photos.length > 0 ? shufflePhotosWithFeaturedFirst(photos) : []);
    }
    cacheRef.current = { key: fp, result: next };
  }

  return cacheRef.current.result;
}

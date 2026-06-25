import { useRef } from "react";
import type { SitePhotoItem } from "@/lib/portfolio/portfolioTypes";
import { shufflePhotosWithFeaturedFirst } from "@/lib/portfolio/galleryUtils";

/** Shuffle gallery photos once per load; featured items always appear first in the category. */
export function useShuffledGalleryPhotos(items: readonly SitePhotoItem[], resetKey = "gallery"): SitePhotoItem[] {
  const cacheRef = useRef<{ key: string; result: SitePhotoItem[] } | null>(null);

  const ids =
    items.length > 0
      ? items.map((p) => `${p.id}:${p.featured ? 1 : 0}`).join("|")
      : "";

  const combinedKey = `${resetKey}::${ids}`;

  if (cacheRef.current?.key !== combinedKey) {
    cacheRef.current = {
      key: combinedKey,
      result: items.length > 0 ? shufflePhotosWithFeaturedFirst(items) : [],
    };
  }

  return cacheRef.current.result;
}

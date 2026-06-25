import { useRef } from "react";
import type { SiteVideoItem } from "@/lib/portfolio/portfolioTypes";
import { shuffleVideosWithFeaturedFirst } from "@/lib/portfolio/galleryUtils";

/** Shuffle videos once per load; featured items always appear first. */
export function useShuffledGalleryVideos(items: readonly SiteVideoItem[], resetKey = "videos"): SiteVideoItem[] {
  const cacheRef = useRef<{ key: string; result: SiteVideoItem[] } | null>(null);

  const ids =
    items.length > 0
      ? items.map((v) => `${v.id}:${v.featured ? 1 : 0}`).join("|")
      : "";

  const combinedKey = `${resetKey}::${ids}`;

  if (cacheRef.current?.key !== combinedKey) {
    cacheRef.current = {
      key: combinedKey,
      result: items.length > 0 ? shuffleVideosWithFeaturedFirst(items) : [],
    };
  }

  return cacheRef.current.result;
}

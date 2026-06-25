import type { PhotoCategory, SitePhotoItem, SiteVideoItem } from "@/lib/portfolio/portfolioTypes";
import { shuffleArray } from "@/lib/shuffle";

export function photoHasSrc(photo: SitePhotoItem): boolean {
  return Boolean(photo.src?.trim());
}

export function buildPhotosByCategory(
  photos: SitePhotoItem[],
  visibleCategories: PhotoCategory[],
): Map<string, SitePhotoItem[]> {
  const visibleIds = new Set(visibleCategories.map((c) => c.id));
  const map = new Map<string, SitePhotoItem[]>();
  for (const cat of visibleCategories) map.set(cat.id, []);
  const fallbackId = visibleCategories[0]?.id;

  for (const photo of [...photos].filter(photoHasSrc).sort((a, b) => a.order - b.order)) {
    if (visibleIds.has(photo.categoryId)) {
      map.get(photo.categoryId)!.push(photo);
    } else if (fallbackId) {
      map.get(fallbackId)!.push(photo);
    }
  }
  return map;
}

export function findCategoryBySlug(categories: PhotoCategory[], slug: string): PhotoCategory | undefined {
  const s = slug.trim().toLowerCase();
  return categories.find((c) => c.slug.toLowerCase() === s || c.id === slug);
}

/** Featured items stay first (by order); the rest are shuffled. */
export function shufflePhotosWithFeaturedFirst(photos: readonly SitePhotoItem[]): SitePhotoItem[] {
  const featured = photos.filter((p) => p.featured).sort((a, b) => a.order - b.order);
  const rest = shuffleArray(photos.filter((p) => !p.featured));
  return [...featured, ...rest];
}

/** Featured videos stay first (by order); the rest are shuffled. */
export function shuffleVideosWithFeaturedFirst(videos: readonly SiteVideoItem[]): SiteVideoItem[] {
  const featured = videos.filter((v) => v.featured).sort((a, b) => a.order - b.order);
  const rest = shuffleArray(videos.filter((v) => !v.featured));
  return [...featured, ...rest];
}

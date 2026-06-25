import type { HeroAnimation, PhotoHeroSlide } from "@/lib/portfolio/portfolioTypes";

export function heroSlideHq(slide: PhotoHeroSlide): string {
  return slide.src.trim();
}

export function heroSlideLq(slide: PhotoHeroSlide): string {
  return slide.srcLq.trim();
}

export function heroSlideHasMedia(slide: PhotoHeroSlide): boolean {
  return Boolean(heroSlideHq(slide) || heroSlideLq(slide));
}

/** URL shown immediately (LQ if set, otherwise HQ). */
export function heroSlidePreviewUrl(slide: PhotoHeroSlide): string {
  return heroSlideLq(slide) || heroSlideHq(slide);
}

/** Maps legacy CMS value `fade` to film dissolve. */
export function resolveHeroAnimation(
  animation: HeroAnimation | string | undefined,
  fallback: HeroAnimation,
): HeroAnimation {
  const raw = String(animation ?? fallback);
  if (raw === "fade" || raw === "filmDissolve") return "filmDissolve";
  if (raw === "slide") return "slide";
  if (raw === "kenburns") return "kenburns";
  return fallback;
}

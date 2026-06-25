import type { PhotoHeroSlide } from "@/lib/portfolio/portfolioTypes";
import { heroSlideHq, heroSlideLq, heroSlidePreviewUrl } from "@/lib/portfolio/heroSlideMedia";

const loadedUrls = new Set<string>();
const pending = new Map<string, Promise<void>>();

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** True when this URL has finished loading at least once this session. */
export function isHeroImageCached(url: string): boolean {
  return Boolean(url && loadedUrls.has(url));
}

/** Preload a single hero image URL; resolves when decoded (or on error). */
export function preloadHeroImage(url: string): Promise<void> {
  const src = url.trim();
  if (!src) return Promise.resolve();
  if (loadedUrls.has(src)) return Promise.resolve();

  const existing = pending.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      loadedUrls.add(src);
      pending.delete(src);
      resolve();
    };
    img.onerror = () => {
      pending.delete(src);
      resolve();
    };
    img.src = src;
  });

  pending.set(src, promise);
  return promise;
}

/** Preload LQ then HQ so the preview appears before the full frame. */
export async function preloadHeroSlide(slide: PhotoHeroSlide): Promise<void> {
  const lq = heroSlideLq(slide);
  const hq = heroSlideHq(slide);
  const tasks: Promise<void>[] = [];
  if (lq) tasks.push(preloadHeroImage(lq));
  if (hq && hq !== lq) tasks.push(preloadHeroImage(hq));
  await Promise.all(tasks);
}

/** Preload every slide in parallel (background). */
export function preloadAllHeroSlides(slides: PhotoHeroSlide[]): void {
  for (const slide of slides) {
    void preloadHeroSlide(slide);
  }
}

export async function preloadAllHeroSlidesAsync(slides: PhotoHeroSlide[]): Promise<void> {
  await Promise.all(slides.map((slide) => preloadHeroSlide(slide)));
}

/** True when preview (LQ or HQ) is cached — enough to start a film dissolve. */
export function isHeroSlidePreviewReady(slide: PhotoHeroSlide): boolean {
  const preview = heroSlidePreviewUrl(slide);
  return Boolean(preview && isHeroImageCached(preview));
}

/** True when preview and HQ (if separate) are cached. */
export function isHeroSlideReady(slide: PhotoHeroSlide): boolean {
  const preview = heroSlidePreviewUrl(slide);
  if (!preview || !isHeroImageCached(preview)) return false;
  const hq = heroSlideHq(slide);
  if (hq && hq !== preview && !isHeroImageCached(hq)) return false;
  return true;
}

/** Wait until preview is cached (fast gate for transitions). */
export async function waitUntilHeroSlidePreviewReady(slide: PhotoHeroSlide): Promise<boolean> {
  const preview = heroSlidePreviewUrl(slide);
  if (!preview) return false;
  await preloadHeroImage(preview);
  if (isHeroImageCached(preview)) return true;

  for (let i = 0; i < 50; i++) {
    await preloadHeroImage(preview);
    if (isHeroImageCached(preview)) return true;
    await sleep(100);
  }
  return isHeroImageCached(preview);
}

/** Preload full slide (preview + HQ). */
export async function waitUntilHeroSlideReady(slide: PhotoHeroSlide): Promise<boolean> {
  await preloadHeroSlide(slide);
  if (isHeroSlideReady(slide)) return true;

  for (let i = 0; i < 100; i++) {
    await preloadHeroSlide(slide);
    if (isHeroSlideReady(slide)) return true;
    await sleep(200);
  }
  return isHeroSlideReady(slide);
}

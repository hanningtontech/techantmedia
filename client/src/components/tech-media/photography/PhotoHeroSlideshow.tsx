import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroProgressiveImage } from "@/components/tech-media/photography/HeroProgressiveImage";
import type { HeroAnimation, PhotoHeroSlide } from "@/lib/portfolio/portfolioTypes";
import {
  preloadAllHeroSlides,
  preloadAllHeroSlidesAsync,
  preloadHeroSlide,
  waitUntilHeroSlidePreviewReady,
} from "@/lib/portfolio/heroImageCache";
import { heroSlideHasMedia, heroSlideHq, heroSlideLq, resolveHeroAnimation } from "@/lib/portfolio/heroSlideMedia";

type Props = {
  slides: PhotoHeroSlide[];
  title: string;
  subtitle: string;
  defaultAnimation?: HeroAnimation;
  /** e.g. Book a session button below the hero copy */
  actions?: ReactNode;
};

const SLIDE_HOLD_BASE_MS = 4000;
const SLIDE_HOLD_JITTER_MS = 1200;
const FILM_DISSOLVE_S = 1.85;

function randomHoldMs(): number {
  return SLIDE_HOLD_BASE_MS + Math.floor(Math.random() * SLIDE_HOLD_JITTER_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function slidesFingerprint(slides: PhotoHeroSlide[]): string {
  return slides
    .filter(heroSlideHasMedia)
    .map((s) => `${s.id}:${s.src}:${s.srcLq}:${s.order}`)
    .join("|");
}

const slideVariants = {
  filmDissolve: {
    initial: { opacity: 0, scale: 1, filter: "brightness(1.1)" },
    animate: { opacity: 1, scale: 1, filter: "brightness(1)" },
    exit: { opacity: 0, scale: 1, filter: "brightness(0.9)" },
  },
  slide: {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
  },
  kenburns: {
    initial: { opacity: 0, scale: 1.08 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  },
};

function transitionFor(animation: HeroAnimation, prefersReducedMotion: boolean) {
  if (prefersReducedMotion) return { duration: 0 };
  if (animation === "filmDissolve") {
    return { duration: FILM_DISSOLVE_S, ease: [0.42, 0.02, 0.58, 1] as const };
  }
  if (animation === "kenburns") return { duration: 1.2, ease: "easeOut" as const };
  return { duration: 0.85, ease: "easeOut" as const };
}

export function PhotoHeroSlideshow({
  slides,
  title,
  subtitle,
  defaultAnimation = "filmDissolve",
  actions,
}: Props) {
  const reducedMotion = useReducedMotion();
  const prefersReducedMotion = reducedMotion === true;

  const validSlides = useMemo(() => slides.filter(heroSlideHasMedia), [slides]);
  const fingerprint = useMemo(() => slidesFingerprint(slides), [slides]);
  const slideCount = validSlides.length;

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const validSlidesRef = useRef(validSlides);
  validSlidesRef.current = validSlides;
  indexRef.current = index;

  useEffect(() => {
    if (!slideCount) return;
    preloadAllHeroSlides(validSlides);
    void preloadAllHeroSlidesAsync(validSlides);
  }, [fingerprint, slideCount, validSlides]);

  useEffect(() => {
    if (slideCount <= 1) return;
    let cancelled = false;

    const warmNeighbors = () => {
      const list = validSlidesRef.current;
      const i = indexRef.current;
      const next = list[(i + 1) % list.length];
      const prev = list[(i - 1 + list.length) % list.length];
      if (next) void preloadHeroSlide(next);
      if (prev) void preloadHeroSlide(prev);
    };

    const id = window.setInterval(() => {
      if (!cancelled) warmNeighbors();
    }, 2500);

    warmNeighbors();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fingerprint, slideCount, index]);

  const goToIndex = useCallback(async (nextIdx: number) => {
    const list = validSlidesRef.current;
    if (!list.length) return;
    const wrapped = ((nextIdx % list.length) + list.length) % list.length;
    const target = list[wrapped];
    if (!target) return;

    const ready = await waitUntilHeroSlidePreviewReady(target);
    if (!ready) return;

    void preloadHeroSlide(target);
    indexRef.current = wrapped;
    setIndex(wrapped);
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (validSlidesRef.current.length <= 1) return;
      void goToIndex(indexRef.current + dir);
    },
    [goToIndex],
  );

  useEffect(() => {
    if (slideCount <= 1) return;

    let cancelled = false;

    const runAutoplay = async () => {
      const list = validSlidesRef.current;
      await waitUntilHeroSlidePreviewReady(list[indexRef.current]!);

      while (!cancelled && list.length > 1) {
        await sleep(randomHoldMs());
        if (cancelled) break;

        const nextIdx = (indexRef.current + 1) % list.length;
        const target = list[nextIdx]!;
        const ready = await waitUntilHeroSlidePreviewReady(target);
        if (cancelled) break;
        if (!ready) {
          void preloadHeroSlide(target);
          continue;
        }

        void preloadHeroSlide(target);
        indexRef.current = nextIdx;
        setIndex(nextIdx);
      }
    };

    void runAutoplay();

    return () => {
      cancelled = true;
    };
  }, [fingerprint, slideCount]);

  if (!slideCount) {
    return (
      <section className="tm-photo-hero relative flex min-h-[70dvh] w-full items-end bg-[#0c0c12] sm:min-h-[85dvh] lg:min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full px-4 pb-12 pt-24 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20"
        >
          <p className="tm-eyebrow text-orange-400">Visual storytelling</p>
          <h1 className="tm-heading-hero mt-2 max-w-4xl font-bold text-white">{title}</h1>
          <p className="tm-body-lg mt-3 max-w-2xl text-zinc-300 sm:mt-4">{subtitle}</p>
        </motion.div>
      </section>
    );
  }

  const current = validSlides[index]!;
  const animation = resolveHeroAnimation(current.animation, defaultAnimation);
  const variants = slideVariants[animation];
  const kenburnsClass = animation === "kenburns" && !prefersReducedMotion ? "tm-hero-kenburns" : "";
  const imageClass = `h-full w-full object-cover ${kenburnsClass}`;
  const useFilmDissolve = animation === "filmDissolve" && !prefersReducedMotion;

  return (
    <section className="tm-photo-hero relative min-h-[62dvh] w-full overflow-hidden bg-[#0c0c12] sm:min-h-[72dvh] md:min-h-[78dvh] lg:min-h-screen">
      <AnimatePresence initial={false} mode={useFilmDissolve ? "sync" : "wait"}>
        <motion.div
          key={current.id}
          className="absolute inset-0 tm-hero-slide-layer"
          style={{ zIndex: useFilmDissolve ? 1 : 0 }}
          initial={prefersReducedMotion ? false : variants.initial}
          animate={variants.animate}
          exit={prefersReducedMotion ? undefined : variants.exit}
          transition={transitionFor(animation, prefersReducedMotion)}
        >
          <HeroProgressiveImage
            lq={heroSlideLq(current)}
            hq={heroSlideHq(current)}
            alt={current.alt}
            className={imageClass}
            preload
          />
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-[#08080c] via-[#08080c]/50 to-black/30" />

      <div className="relative z-10 flex min-h-[62dvh] flex-col justify-end sm:min-h-[72dvh] md:min-h-[78dvh] lg:min-h-screen">
        <div className="w-full px-4 pb-8 pt-20 sm:px-6 sm:pb-12 sm:pt-24 md:px-8 lg:px-12 lg:pb-20">
          {current.caption ? (
            <p className="tm-eyebrow mb-2 text-orange-300/90">{current.caption}</p>
          ) : null}
          <h1 className="tm-heading-hero max-w-5xl font-bold text-white 2xl:max-w-6xl">{title}</h1>
          <p className="tm-body-lg mt-3 max-w-2xl text-zinc-200 sm:mt-4">{subtitle}</p>
          {actions ? <div className="pointer-events-auto mt-8">{actions}</div> : null}
        </div>

        {slideCount > 1 ? (
          <>
            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-8">
              {validSlides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-orange-500" : "w-2 bg-white/40 hover:bg-white/70"}`}
                  onClick={() => void goToIndex(i)}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60 sm:left-6 sm:flex"
              onClick={() => go(-1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60 sm:right-6 sm:flex"
              onClick={() => go(1)}
            >
              <ChevronRight size={22} />
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

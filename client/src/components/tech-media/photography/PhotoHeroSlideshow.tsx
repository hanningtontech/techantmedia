import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroAnimation, PhotoHeroSlide } from "@/lib/portfolio/portfolioTypes";

type Props = {
  slides: PhotoHeroSlide[];
  title: string;
  subtitle: string;
  defaultAnimation?: HeroAnimation;
};

const slideVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
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

export function PhotoHeroSlideshow({ slides, title, subtitle, defaultAnimation = "kenburns" }: Props) {
  const reducedMotion = useReducedMotion();
  const validSlides = slides.filter((s) => s.src.trim());
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (validSlides.length <= 1) return;
      setIndex((i) => (i + dir + validSlides.length) % validSlides.length);
    },
    [validSlides.length],
  );

  useEffect(() => {
    if (reducedMotion || validSlides.length <= 1) return;
    const id = window.setInterval(() => go(1), 6000);
    return () => window.clearInterval(id);
  }, [go, reducedMotion, validSlides.length]);

  if (!validSlides.length) {
    return (
      <section className="tm-photo-hero relative flex min-h-[70dvh] w-full items-end bg-[#0c0c12] sm:min-h-[85dvh] lg:min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full px-4 pb-12 pt-24 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-400">Visual storytelling</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-bold text-white sm:text-5xl lg:text-6xl xl:text-7xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-300 lg:text-xl">{subtitle}</p>
        </motion.div>
      </section>
    );
  }

  const current = validSlides[index]!;
  const animation = current.animation ?? defaultAnimation;
  const variants = slideVariants[animation];

  return (
    <section className="tm-photo-hero relative min-h-[70dvh] w-full overflow-hidden sm:min-h-[85dvh] lg:min-h-screen">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          className="absolute inset-0"
          initial={reducedMotion ? false : variants.initial}
          animate={variants.animate}
          exit={reducedMotion ? undefined : variants.exit}
          transition={{ duration: reducedMotion ? 0 : animation === "kenburns" ? 1.2 : 0.7, ease: "easeOut" }}
        >
          <img
            src={current.src}
            alt={current.alt}
            className={`h-full w-full object-cover ${animation === "kenburns" && !reducedMotion ? "tm-hero-kenburns" : ""}`}
          />
        </motion.div>
      </AnimatePresence>

      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/50 to-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      />

      <div className="relative z-10 flex min-h-[70dvh] flex-col justify-end sm:min-h-[85dvh] lg:min-h-screen">
        <div className="w-full px-4 pb-10 pt-24 sm:px-8 sm:pb-14 lg:px-12 lg:pb-20">
          {current.caption && (
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-orange-300/90">{current.caption}</p>
          )}
          <h1 className="max-w-5xl text-4xl font-bold text-white sm:text-5xl lg:text-6xl xl:text-7xl 2xl:max-w-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base text-zinc-200 sm:text-lg lg:text-xl">{subtitle}</p>
        </div>

        {validSlides.length > 1 && (
          <>
            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-8">
              {validSlides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-orange-500" : "w-2 bg-white/40 hover:bg-white/70"}`}
                  onClick={() => setIndex(i)}
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
        )}
      </div>
    </section>
  );
}

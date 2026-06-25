import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useOptionalLivestreamKeepAlive } from "@/contexts/LivestreamKeepAliveContext";
import type { LivestreamBackgroundImage } from "@/lib/livestream/livestreamTypes";

type Props = {
  images: LivestreamBackgroundImage[];
  intervalSec: number;
  /** 0 = opaque, 100 = fully transparent */
  transparency: number;
  blurPx: number;
};

export function LivestreamBackground({ images, intervalSec, transparency, blurPx }: Props) {
  const reducedMotion = useReducedMotion();
  const validImages = useMemo(() => images.filter((img) => img.url.trim()), [images]);
  const [index, setIndex] = useState(0);
  const lastSlideAtRef = useRef(Date.now());
  const keepAlive = useOptionalLivestreamKeepAlive();

  const fingerprint = useMemo(() => validImages.map((i) => i.id).join("|"), [validImages]);
  const slideMs = Math.max(2, intervalSec) * 1000;

  useEffect(() => {
    setIndex(0);
  }, [fingerprint]);

  useEffect(() => {
    if (validImages.length <= 1 || reducedMotion) return;

    const advance = () => {
      lastSlideAtRef.current = Date.now();
      setIndex((i) => (i + 1) % validImages.length);
    };

    const id = window.setInterval(advance, slideMs);
    const unsubResume = keepAlive?.onResume(() => {
      const elapsed = Date.now() - lastSlideAtRef.current;
      const skipped = Math.floor(elapsed / slideMs);
      if (skipped > 0) {
        setIndex((i) => (i + skipped) % validImages.length);
        lastSlideAtRef.current = Date.now();
      }
    });

    return () => {
      window.clearInterval(id);
      unsubResume?.();
    };
  }, [validImages.length, reducedMotion, validImages, slideMs, keepAlive]);

  if (!validImages.length) {
    return (
      <div className="absolute inset-0 bg-[#08080c]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(45,212,191,0.14),_transparent_50%)]" />
      </div>
    );
  }

  const current = validImages[index]!;
  const imageOpacity = Math.max(0, Math.min(1, 1 - transparency / 100));
  const imageBlur = Math.max(0, blurPx);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#08080c]">
      <AnimatePresence mode="sync">
        <motion.div
          key={current.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 1.4, ease: [0.42, 0.02, 0.58, 1] }}
        >
          <img
            src={current.url}
            alt={current.alt ?? ""}
            className="h-full w-full object-cover"
            style={{
              opacity: imageOpacity,
              filter: imageBlur > 0 ? `blur(${imageBlur}px)` : undefined,
            }}
            loading={index === 0 ? "eager" : "lazy"}
          />
        </motion.div>
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/55 to-black/40" />
    </div>
  );
}

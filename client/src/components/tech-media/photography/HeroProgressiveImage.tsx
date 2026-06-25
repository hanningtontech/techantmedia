import { useEffect, useState } from "react";
import { isHeroImageCached, preloadHeroImage } from "@/lib/portfolio/heroImageCache";
import { cn } from "@/lib/utils";

type Props = {
  lq: string;
  hq: string;
  alt: string;
  className?: string;
  /** Preload HQ even when slide is not visible */
  preload?: boolean;
};

/**
 * Shows LQ immediately, preloads HQ, then cross-fades HQ over LQ when ready.
 * Uses a session cache so revisiting slides does not flash empty frames.
 */
export function HeroProgressiveImage({ lq, hq, alt, className, preload = true }: Props) {
  const preview = lq || hq;
  const hasSeparateHq = Boolean(hq && hq !== lq);
  const [hqReady, setHqReady] = useState(() => Boolean(hq && isHeroImageCached(hq)));

  useEffect(() => {
    if (!hq) {
      setHqReady(false);
      return;
    }
    if (isHeroImageCached(hq)) {
      setHqReady(true);
      return;
    }
    if (!preload && !hasSeparateHq) return;

    let cancelled = false;
    setHqReady(false);
    void preloadHeroImage(hq).then(() => {
      if (!cancelled) setHqReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hq, hasSeparateHq, preload]);

  useEffect(() => {
    if (!lq || lq === hq) return;
    void preloadHeroImage(lq);
  }, [lq, hq]);

  if (!preview) return null;

  const showHqLayer = Boolean(hq) && hqReady;
  const showPreviewLayer = preview && (!showHqLayer || hasSeparateHq);

  return (
    <>
      {showPreviewLayer ? (
        <img
          src={showPreviewLayer}
          alt={alt}
          decoding="async"
          fetchPriority="high"
          className={cn(className, "absolute inset-0")}
          aria-hidden={showHqLayer && hasSeparateHq}
        />
      ) : null}
      {hq ? (
        <img
          src={hq}
          alt={alt}
          decoding="async"
          className={cn(
            className,
            "absolute inset-0 transition-opacity duration-[900ms] ease-out",
            showHqLayer ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </>
  );
}

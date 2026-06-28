import { useEffect, useState } from "react";

/** Phone layout at this width and below; desktop (grid + session sidebar) above. */
export const PHONE_MAX_WIDTH = 700;

/** @deprecated Height no longer drives layout tier; kept for compact-split helpers. */
export const SHORT_VIEWPORT_MAX_HEIGHT = 900;

/** @deprecated Layout tiers simplified to phone | desktop. */
export const COMPACT_SPLIT_MIN_WIDTH = 640;

/** @deprecated Layout tiers simplified to phone | desktop. */
export const DESKTOP_MIN_WIDTH = 1024;

export type GameViewportTier = "phone" | "desktop";

export function measureGameViewportTier(width: number, _height?: number): GameViewportTier {
  if (width <= PHONE_MAX_WIDTH) return "phone";
  return "desktop";
}

/** Single source of truth for block-game responsive layout tiers. */
export function useGameViewportLayout() {
  const [tier, setTier] = useState<GameViewportTier>(() => {
    if (typeof window === "undefined") return "desktop";
    return measureGameViewportTier(window.innerWidth, window.innerHeight);
  });

  useEffect(() => {
    const update = () => {
      setTier(measureGameViewportTier(window.innerWidth, window.innerHeight));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    tier,
    isPhone: tier === "phone",
    /** @deprecated Always false — compact split replaced by desktop above 700px. */
    isCompactSplit: false,
    /** @deprecated Always false — stacked layout replaced by desktop above 700px. */
    isStacked: false,
    isDesktopWithSession: tier === "desktop",
  };
}

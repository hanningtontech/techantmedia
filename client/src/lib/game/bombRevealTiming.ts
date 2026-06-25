/** Timing + capability hints for player bomb-hit animation (not simulation). */
export function isLightBombEffects(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return (navigator.hardwareConcurrency ?? 8) <= 4;
}

/** Delay before revealing the rest of the grid after the hit bomb animates. */
export function bombFullGridRevealDelayMs(): number {
  if (typeof window === "undefined") return 520;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 280;
  if ((navigator.hardwareConcurrency ?? 8) <= 4) return 380;
  return 520;
}

export function bombShakeDurationMs(): number {
  return isLightBombEffects() ? 340 : 560;
}

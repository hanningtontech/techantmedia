/** Timing for player bomb-hit effects (not simulation). */

/** Pause after hit before staggered board reveal (explosion + shake window). */
export function bombHitEffectsDelayMs(animationsEnabled: boolean, totalCells = 36): number {
  if (!animationsEnabled) return 0;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 100;
  }
  if (totalCells >= 120) return 130;
  if (totalCells >= 99) return 150;
  if (totalCells >= 72) return 165;
  if (totalCells >= 48) return 180;
  return 200;
}

export function bombShakeDurationMs(animationsEnabled: boolean): number {
  if (!animationsEnabled) return 0;
  return 220;
}

/** Total ms budget for the bomb cascade — tighter on larger boards. */
function bombCascadeBudgetMs(remainingBombs: number, totalCells: number): number {
  if (remainingBombs <= 3) return 140;
  if (totalCells <= 30) return 190;
  if (totalCells <= 48) return 175;
  if (totalCells <= 72) return 155;
  if (totalCells <= 99) return 130;
  if (totalCells <= 120) return 115;
  return 100;
}

/** Ms between stagger steps (may reveal multiple bombs per step on large grids). */
export function bombStaggerIntervalMs(remainingBombs: number, totalCells = 36): number {
  if (remainingBombs <= 0) return 0;
  const batch = bombsPerStaggerStep(remainingBombs, totalCells);
  const steps = Math.ceil(remainingBombs / batch);
  const budget = bombCascadeBudgetMs(remainingBombs, totalCells);
  const ideal = budget / steps;
  const minInterval =
    totalCells >= 120 ? 5 : totalCells >= 99 ? 6 : totalCells >= 72 ? 8 : totalCells >= 48 ? 10 : 14;
  const maxInterval = totalCells <= 30 ? 30 : totalCells <= 48 ? 26 : totalCells <= 72 ? 22 : 18;
  return Math.max(minInterval, Math.min(maxInterval, Math.round(ideal)));
}

/** How many bombs to flip per stagger tick on large boards. */
export function bombsPerStaggerStep(remainingBombs: number, totalCells: number): number {
  if (remainingBombs <= 6 || totalCells < 72) return 1;
  if (totalCells >= 120 && remainingBombs >= 16) return 4;
  if (totalCells >= 99 && remainingBombs >= 12) return 3;
  if (remainingBombs >= 10) return 2;
  return 1;
}

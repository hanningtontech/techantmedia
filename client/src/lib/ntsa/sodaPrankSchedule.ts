const STORAGE_KEY = "ntsa-soda-prank-combine-count";

export function getSodaPrankCombineCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function incrementSodaPrankCombineCount(): number {
  const next = getSodaPrankCombineCount() + 1;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

/** 1st combine, 6th combine, then every 10th from 15 (15, 25, 35, …). */
export function shouldShowSodaPrank(combineCount: number): boolean {
  if (combineCount === 1 || combineCount === 6) return true;
  if (combineCount >= 15 && (combineCount - 15) % 10 === 0) return true;
  return false;
}

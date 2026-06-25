import { randomIntInRange } from "@/lib/simulation/engine";
import { totalCells } from "@/lib/simulation/math";
import { BOMB_PCT_MAX, BOMB_PCT_MIN } from "./constants";

export function randomBombCountForGrid(
  rows: number,
  cols: number,
  pctMin = BOMB_PCT_MIN,
  pctMax = BOMB_PCT_MAX,
  rng = Math.random,
): number {
  const total = totalCells(rows, cols);
  const lo = Math.max(0.05, Math.min(pctMin, pctMax));
  const hi = Math.max(lo, pctMax);
  const min = Math.max(1, Math.ceil(total * lo));
  const max = Math.max(min, Math.floor(total * hi));
  return randomIntInRange(min, max, rng);
}

export function bombPercentLabel(bombs: number, rows: number, cols: number): string {
  const total = totalCells(rows, cols);
  if (total === 0) return "0%";
  return `${Math.round((bombs / total) * 100)}%`;
}

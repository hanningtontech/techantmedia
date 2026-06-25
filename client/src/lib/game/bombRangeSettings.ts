import { BOMB_PCT_MAX, BOMB_PCT_MIN } from "./constants";
import { PLAYER_GRID_PRESETS, type PlayerGridPresetId } from "./gridThemes";

export interface GridBombRange {
  pctMin: number;
  pctMax: number;
}

export type GridBombRanges = Record<string, GridBombRange>;

function clampPct(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(0.9, Math.max(0.05, n));
}

/** Default 30%–55% bomb density for every player grid preset. */
export function defaultBombRanges(): GridBombRanges {
  const ranges: GridBombRanges = {};
  for (const p of PLAYER_GRID_PRESETS) {
    ranges[p.id] = { pctMin: BOMB_PCT_MIN, pctMax: BOMB_PCT_MAX };
  }
  return ranges;
}

export function normalizeGridBombRange(raw: unknown, fallback: GridBombRange): GridBombRange {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let pctMin = clampPct(Number(o.pctMin), fallback.pctMin);
  let pctMax = clampPct(Number(o.pctMax), fallback.pctMax);
  if (pctMin > pctMax) [pctMin, pctMax] = [pctMax, pctMin];
  return { pctMin, pctMax };
}

export function mergeBombRanges(stored?: GridBombRanges | Record<string, unknown>): GridBombRanges {
  const defaults = defaultBombRanges();
  if (!stored) return defaults;
  const merged = { ...defaults };
  for (const p of PLAYER_GRID_PRESETS) {
    const raw = (stored as Record<string, unknown>)[p.id];
    if (raw != null) merged[p.id] = normalizeGridBombRange(raw, defaults[p.id]!);
  }
  return merged;
}

export function resolveBombRangeForPreset(
  presetId: PlayerGridPresetId | string,
  ranges: GridBombRanges,
): GridBombRange {
  return ranges[presetId] ?? { pctMin: BOMB_PCT_MIN, pctMax: BOMB_PCT_MAX };
}

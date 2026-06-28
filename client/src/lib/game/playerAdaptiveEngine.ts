import { applyEarlyCashOutPenaltyMultiplier } from "@/lib/game/earlyCashOutPenalty";
import { randomIntInRange } from "@/lib/simulation/engine";
import { calculateMultiplier, totalCells } from "@/lib/simulation/math";
import type { GameConfig, SessionOutcome } from "@/lib/simulation/types";

/** Each safe pick in a round grows effective house edge by 25%. */
export const HOUSE_EDGE_GROWTH_FACTOR = 1.25;
export const MAX_EFFECTIVE_HOUSE_EDGE = 0.4;

/** Session profit ≥ this × stake → tighter bomb clustering. */
export const PROFIT_TIGHT_STAKE_MULTIPLE = 3;

/** Balance within this fraction of session target → max-bomb strike. */
export const TARGET_CLOSE_RATIO = 0.88;

/** Quick withdraw: ≤2 picks then cash out, 3+ times in a row. */
export const QUICK_WITHDRAW_MAX_ROUND = 2;
export const QUICK_WITHDRAW_STREAK_TRIGGER = 3;
export const QUICK_WITHDRAW_PENALTY_GAMES = 3;
export const QUICK_WITHDRAW_MULT_MIN = 1.12;
export const QUICK_WITHDRAW_MULT_MAX = 1.23;

/** Pick concentration in one quadrant triggers zone bias. */
export const ZONE_CONCENTRATION_THRESHOLD = 0.55;
export const PICK_HISTORY_MAX = 48;

export type GridZone = 0 | 1 | 2 | 3;

export type BombPlacementMode =
  | "uniform"
  | "spread"
  | "cluster_tight"
  | "avoid_hot_zone"
  | "prefer_hot_zone";

export interface PlayerAdaptiveState {
  pickHistory: number[];
  consecutiveQuickWithdraws: number;
  quickWithdrawPenaltyGamesLeft: number;
  /** Max multiplier cap for the current penalized game (1.12–1.23). */
  quickWithdrawMultiplierCap: number | null;
  lastGameMaxRound: number;
}

const STORAGE_KEY = "block-game-player-adaptive-v1";

export function defaultPlayerAdaptiveState(): PlayerAdaptiveState {
  return {
    pickHistory: [],
    consecutiveQuickWithdraws: 0,
    quickWithdrawPenaltyGamesLeft: 0,
    quickWithdrawMultiplierCap: null,
    lastGameMaxRound: 0,
  };
}

function storageKey(uid: string): string {
  return `${STORAGE_KEY}:${uid}`;
}

export function loadPlayerAdaptiveState(uid: string): PlayerAdaptiveState {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return defaultPlayerAdaptiveState();
    const parsed = JSON.parse(raw) as Partial<PlayerAdaptiveState>;
    return {
      ...defaultPlayerAdaptiveState(),
      ...parsed,
      pickHistory: Array.isArray(parsed.pickHistory)
        ? parsed.pickHistory.filter((n) => Number.isFinite(n)).slice(-PICK_HISTORY_MAX)
        : [],
    };
  } catch {
    return defaultPlayerAdaptiveState();
  }
}

export function savePlayerAdaptiveState(uid: string, state: PlayerAdaptiveState): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

/** House edge grows by ¼ of its value after each safe pick in the same round. */
export function effectiveHouseEdgeForRound(baseHouseEdge: number, safeRound: number): number {
  if (safeRound <= 1) return baseHouseEdge;
  const grown = baseHouseEdge * Math.pow(HOUSE_EDGE_GROWTH_FACTOR, safeRound - 1);
  return Math.min(MAX_EFFECTIVE_HOUSE_EDGE, grown);
}

export function calculateAdaptivePlayerMultiplier(
  config: GameConfig,
  round: number,
  options: {
    baseHouseEdge: number;
    penaltyKeepFraction: number | null;
    multiplierCap: number | null;
  },
): number {
  if (round <= 0) return 0;
  const edge = effectiveHouseEdgeForRound(options.baseHouseEdge, round);
  const cfg: GameConfig = { ...config, houseEdge: edge };
  let mult = calculateMultiplier(cfg, round);
  if (options.penaltyKeepFraction != null) {
    mult = applyEarlyCashOutPenaltyMultiplier(mult, options.penaltyKeepFraction);
  }
  if (options.multiplierCap != null && mult > options.multiplierCap) {
    mult = options.multiplierCap;
  }
  return Math.round(mult * 10000) / 10000;
}

export function adaptivePlayerPayout(
  config: GameConfig,
  round: number,
  gameStake: number,
  options: {
    baseHouseEdge: number;
    penaltyKeepFraction: number | null;
    multiplierCap: number | null;
  },
): number {
  if (round <= 0) return 0;
  return gameStake * calculateAdaptivePlayerMultiplier(config, round, options);
}

export function cellZone(index: number, rows: number, cols: number): GridZone {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const top = r < rows / 2;
  const left = c < cols / 2;
  if (top && left) return 0;
  if (top && !left) return 1;
  if (!top && left) return 2;
  return 3;
}

export function analyzeHotZone(
  pickHistory: number[],
  rows: number,
  cols: number,
): GridZone | null {
  if (pickHistory.length < 4) return null;
  const counts: Record<GridZone, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const idx of pickHistory) {
    if (idx < 0 || idx >= rows * cols) continue;
    counts[cellZone(idx, rows, cols)] += 1;
  }
  const total = pickHistory.length;
  let best: GridZone = 0;
  let bestShare = 0;
  for (const z of [0, 1, 2, 3] as GridZone[]) {
    const share = counts[z] / total;
    if (share > bestShare) {
      bestShare = share;
      best = z;
    }
  }
  return bestShare >= ZONE_CONCENTRATION_THRESHOLD ? best : null;
}

export function isInZone(index: number, zone: GridZone, rows: number, cols: number): boolean {
  return cellZone(index, rows, cols) === zone;
}

function indexDistance(a: number, b: number, cols: number): number {
  const ar = Math.floor(a / cols);
  const ac = a % cols;
  const br = Math.floor(b / cols);
  const bc = b % cols;
  return Math.abs(ar - br) + Math.abs(ac - bc);
}

function spreadBombIndices(total: number, bombs: number, cols: number, rng: () => number): Set<number> {
  const chosen: number[] = [];
  chosen.push(Math.floor(rng() * total));
  while (chosen.length < bombs) {
    let bestIdx = -1;
    let bestMin = -1;
    for (let i = 0; i < total; i++) {
      if (chosen.includes(i)) continue;
      let minD = Infinity;
      for (const c of chosen) minD = Math.min(minD, indexDistance(i, c, cols));
      if (minD > bestMin) {
        bestMin = minD;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) chosen.push(bestIdx);
    else break;
  }
  while (chosen.length < bombs) {
    const extra = Math.floor(rng() * total);
    if (!chosen.includes(extra)) chosen.push(extra);
  }
  return new Set(chosen);
}

function clusterBombIndices(
  total: number,
  bombs: number,
  cols: number,
  rng: () => number,
): Set<number> {
  const indices = new Set<number>();
  const seed = Math.floor(rng() * total);
  indices.add(seed);
  const queue = [seed];
  while (indices.size < bombs && queue.length > 0) {
    const cur = queue.shift()!;
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    const neighbors = [
      cur - cols,
      cur + cols,
      c > 0 ? cur - 1 : -1,
      c < cols - 1 ? cur + 1 : -1,
    ].filter((n) => n >= 0 && n < total && !indices.has(n));
    neighbors.sort(() => rng() - 0.5);
    for (const n of neighbors) {
      if (indices.size >= bombs) break;
      indices.add(n);
      queue.push(n);
    }
    if (neighbors.length === 0 && indices.size < bombs) {
      let extra = Math.floor(rng() * total);
      while (indices.has(extra)) extra = (extra + 1) % total;
      indices.add(extra);
      queue.push(extra);
    }
  }
  return indices;
}

function weightedBombIndices(
  total: number,
  bombs: number,
  weightFor: (index: number) => number,
  rng: () => number,
): Set<number> {
  const indices = new Set<number>();
  const remaining = () => {
    const pool: number[] = [];
    const weights: number[] = [];
    let sum = 0;
    for (let i = 0; i < total; i++) {
      if (indices.has(i)) continue;
      const w = Math.max(0.01, weightFor(i));
      pool.push(i);
      weights.push(w);
      sum += w;
    }
    return { pool, weights, sum };
  };

  while (indices.size < bombs) {
    const { pool, weights, sum } = remaining();
    if (pool.length === 0) break;
    let roll = rng() * sum;
    let pick = pool[0]!;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) {
        pick = pool[i]!;
        break;
      }
    }
    indices.add(pick);
  }
  return indices;
}

export function createAdaptiveBombIndices(
  rows: number,
  cols: number,
  bombs: number,
  mode: BombPlacementMode,
  hotZone: GridZone | null,
  rng: () => number = Math.random,
): Set<number> {
  const total = totalCells(rows, cols);
  const count = Math.min(Math.max(1, bombs), total - 1);

  switch (mode) {
    case "spread":
      return spreadBombIndices(total, count, cols, rng);
    case "cluster_tight":
      return clusterBombIndices(total, count, cols, rng);
    case "avoid_hot_zone":
      if (hotZone == null) return weightedBombIndices(total, count, () => 1, rng);
      return weightedBombIndices(total, count, (i) => (isInZone(i, hotZone, rows, cols) ? 0.12 : 1), rng);
    case "prefer_hot_zone":
      if (hotZone == null) return weightedBombIndices(total, count, () => 1, rng);
      return weightedBombIndices(total, count, (i) => (isInZone(i, hotZone, rows, cols) ? 1 : 0.15), rng);
    case "uniform":
    default:
      return weightedBombIndices(total, count, () => 1, rng);
  }
}

export interface AdaptiveBoardPlan {
  bombCount: number;
  placementMode: BombPlacementMode;
  hotZone: GridZone | null;
  multiplierCap: number | null;
  targetStrike: boolean;
  profitTight: boolean;
}

export interface AdaptiveBoardInput {
  rows: number;
  cols: number;
  pctMin: number;
  pctMax: number;
  sessionTarget: number | null;
  accountBalance: number;
  stake: number;
  sessionNetProfit: number;
  adaptive: PlayerAdaptiveState;
}

export function planAdaptiveBoard(input: AdaptiveBoardInput, rng: () => number = Math.random): AdaptiveBoardPlan {
  const total = totalCells(input.rows, input.cols);
  const lo = Math.max(1, Math.ceil(total * Math.min(input.pctMin, input.pctMax)));
  const hi = Math.max(lo, Math.floor(total * Math.max(input.pctMin, input.pctMax)));

  const hotZone = analyzeHotZone(input.adaptive.pickHistory, input.rows, input.cols);

  const targetStrike =
    input.sessionTarget != null &&
    input.sessionTarget > 0 &&
    input.accountBalance >= input.sessionTarget * TARGET_CLOSE_RATIO;

  const profitTight =
    input.stake > 0 && input.sessionNetProfit >= PROFIT_TIGHT_STAKE_MULTIPLE * input.stake;

  const highMultiplierStrike =
    input.adaptive.lastGameMaxRound >= 3 || profitTight || targetStrike;

  let bombCount = randomIntInRange(lo, hi, rng);
  let placementMode: BombPlacementMode = "uniform";

  if (targetStrike) {
    bombCount = hi;
    placementMode = "spread";
  } else if (profitTight) {
    bombCount = Math.max(bombCount, Math.min(hi, Math.ceil(hi * 0.92)));
    placementMode = "cluster_tight";
  } else if (hotZone != null) {
    placementMode = highMultiplierStrike ? "prefer_hot_zone" : "avoid_hot_zone";
  }

  let multiplierCap: number | null = null;
  if (input.adaptive.quickWithdrawPenaltyGamesLeft > 0) {
    multiplierCap =
      input.adaptive.quickWithdrawMultiplierCap ??
      QUICK_WITHDRAW_MULT_MIN + rng() * (QUICK_WITHDRAW_MULT_MAX - QUICK_WITHDRAW_MULT_MIN);
    multiplierCap = Math.round(multiplierCap * 10000) / 10000;
  }

  return {
    bombCount,
    placementMode,
    hotZone,
    multiplierCap,
    targetStrike,
    profitTight,
  };
}

export function recordAdaptivePick(state: PlayerAdaptiveState, cellIndex: number): PlayerAdaptiveState {
  const pickHistory = [...state.pickHistory, cellIndex].slice(-PICK_HISTORY_MAX);
  return { ...state, pickHistory };
}

function randomQuickWithdrawCap(rng: () => number): number {
  const cap = QUICK_WITHDRAW_MULT_MIN + rng() * (QUICK_WITHDRAW_MULT_MAX - QUICK_WITHDRAW_MULT_MIN);
  return Math.round(cap * 10000) / 10000;
}

/** Update adaptive memory when a /game round ends. */
export function onAdaptiveRoundComplete(
  uid: string,
  outcome: SessionOutcome,
  round: number,
  state: PlayerAdaptiveState,
  hadQuickWithdrawPenalty: boolean,
  rng: () => number = Math.random,
): PlayerAdaptiveState {
  const next: PlayerAdaptiveState = {
    ...state,
    lastGameMaxRound: Math.max(state.lastGameMaxRound, round),
  };

  const quickWithdraw =
    outcome === "cashed_out" && round >= 1 && round <= QUICK_WITHDRAW_MAX_ROUND;

  if (quickWithdraw) {
    next.consecutiveQuickWithdraws += 1;
    if (next.consecutiveQuickWithdraws >= QUICK_WITHDRAW_STREAK_TRIGGER) {
      next.quickWithdrawPenaltyGamesLeft = QUICK_WITHDRAW_PENALTY_GAMES;
      next.quickWithdrawMultiplierCap = randomQuickWithdrawCap(rng);
      next.consecutiveQuickWithdraws = 0;
    }
  } else {
    next.consecutiveQuickWithdraws = 0;
  }

  if (hadQuickWithdrawPenalty) {
    next.quickWithdrawPenaltyGamesLeft = Math.max(0, next.quickWithdrawPenaltyGamesLeft - 1);
    if (next.quickWithdrawPenaltyGamesLeft <= 0) {
      next.quickWithdrawMultiplierCap = null;
    } else {
      next.quickWithdrawMultiplierCap = randomQuickWithdrawCap(rng);
    }
  }

  savePlayerAdaptiveState(uid, next);
  return next;
}

/** Called when a penalized game starts — assigns multiplier cap if needed. */
export function prepareAdaptiveGame(state: PlayerAdaptiveState, rng: () => number = Math.random): PlayerAdaptiveState {
  if (state.quickWithdrawPenaltyGamesLeft <= 0) {
    return { ...state, quickWithdrawMultiplierCap: null };
  }
  const cap = state.quickWithdrawMultiplierCap ?? randomQuickWithdrawCap(rng);
  return { ...state, quickWithdrawMultiplierCap: cap };
}

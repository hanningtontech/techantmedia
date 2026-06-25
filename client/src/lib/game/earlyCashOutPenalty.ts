import { calculateMultiplier } from "@/lib/simulation/math";
import type { GameConfig, SessionOutcome } from "@/lib/simulation/types";

/** Cash-out at or below this round counts as an early exit. */
export const EARLY_CASHOUT_MAX_ROUND = 2;

/** Consecutive early cash-outs before the penalty cycle starts. */
export const EARLY_CASHOUT_TRIGGER_STREAK = 2;

/** How many games receive a reduced multiplier (spread with gaps, not back-to-back). */
export const PENALTY_GAMES_MIN = 4;
export const PENALTY_GAMES_MAX = 8;

/** Keep 30–50% of the bonus above 1× (i.e. reduce that bonus by 50–70%). */
export const PENALTY_BONUS_KEEP_MIN = 0.3;
export const PENALTY_BONUS_KEEP_MAX = 0.5;

const STORAGE_KEY = "block-game-early-cashout-penalty-v1";

export interface EarlyCashOutPenaltyState {
  consecutiveEarlyCashOuts: number;
  penaltyActive: boolean;
  penaltyGamesLeft: number;
  /** Games since the last penalized round — must be ≥ 1 before the next penalty applies. */
  gamesSinceLastPenalty: number;
}

export function defaultEarlyCashOutPenaltyState(): EarlyCashOutPenaltyState {
  return {
    consecutiveEarlyCashOuts: 0,
    penaltyActive: false,
    penaltyGamesLeft: 0,
    gamesSinceLastPenalty: 1,
  };
}

function storageKey(uid: string): string {
  return `${STORAGE_KEY}:${uid}`;
}

export function loadEarlyCashOutPenaltyState(uid: string): EarlyCashOutPenaltyState {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return defaultEarlyCashOutPenaltyState();
    const parsed = JSON.parse(raw) as Partial<EarlyCashOutPenaltyState>;
    return {
      ...defaultEarlyCashOutPenaltyState(),
      ...parsed,
    };
  } catch {
    return defaultEarlyCashOutPenaltyState();
  }
}

export function saveEarlyCashOutPenaltyState(uid: string, state: EarlyCashOutPenaltyState): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function isEarlyCashOut(outcome: SessionOutcome, round: number): boolean {
  return outcome === "cashed_out" && round >= 1 && round <= EARLY_CASHOUT_MAX_ROUND;
}

export function randomPenaltyGamesCount(rng = Math.random): number {
  return PENALTY_GAMES_MIN + Math.floor(rng() * (PENALTY_GAMES_MAX - PENALTY_GAMES_MIN + 1));
}

export function randomPenaltyKeepFraction(rng = Math.random): number {
  return PENALTY_BONUS_KEEP_MIN + rng() * (PENALTY_BONUS_KEEP_MAX - PENALTY_BONUS_KEEP_MIN);
}

/**
 * Reduce multiplier by trimming 50–70% of the profit above 1×.
 * Example: 1.5× with keep 0.4 → 1 + 0.5×0.4 = 1.2×
 */
export function applyEarlyCashOutPenaltyMultiplier(
  normalMultiplier: number,
  keepBonusFraction: number,
): number {
  if (normalMultiplier <= 1 || keepBonusFraction >= 1) return normalMultiplier;
  const bonus = normalMultiplier - 1;
  const adjusted = 1 + bonus * Math.max(0, Math.min(1, keepBonusFraction));
  return Math.round(adjusted * 10000) / 10000;
}

export function playerCalculateMultiplier(
  config: GameConfig,
  round: number,
  penaltyKeepFraction: number | null,
): number {
  const base = calculateMultiplier(config, round);
  if (penaltyKeepFraction == null) return base;
  return applyEarlyCashOutPenaltyMultiplier(base, penaltyKeepFraction);
}

export function playerCashOutPayout(
  config: GameConfig,
  round: number,
  gameStake: number,
  penaltyKeepFraction: number | null,
): number {
  if (round <= 0) return 0;
  return gameStake * playerCalculateMultiplier(config, round, penaltyKeepFraction);
}

/** Call when a new /game round begins — may attach a penalty keep-fraction for this game. */
export function preparePenaltyForNewGame(
  uid: string,
  rng = Math.random,
): { keepFraction: number | null; state: EarlyCashOutPenaltyState } {
  const state = loadEarlyCashOutPenaltyState(uid);

  if (!state.penaltyActive || state.penaltyGamesLeft <= 0) {
    return { keepFraction: null, state };
  }

  if (state.gamesSinceLastPenalty < 1) {
    return { keepFraction: null, state };
  }

  const keepFraction = randomPenaltyKeepFraction(rng);
  state.gamesSinceLastPenalty = 0;
  saveEarlyCashOutPenaltyState(uid, state);
  return { keepFraction, state };
}

/** Call when a /game round ends — updates streaks and penalty schedule. */
export function onPlayerRoundComplete(
  uid: string,
  outcome: SessionOutcome,
  round: number,
  hadPenalty: boolean,
  rng = Math.random,
): EarlyCashOutPenaltyState {
  const state = loadEarlyCashOutPenaltyState(uid);

  if (hadPenalty) {
    state.penaltyGamesLeft = Math.max(0, state.penaltyGamesLeft - 1);
    state.gamesSinceLastPenalty = 0;
    if (state.penaltyGamesLeft <= 0) {
      state.penaltyActive = false;
    }
  } else if (state.penaltyActive) {
    state.gamesSinceLastPenalty += 1;
  }

  if (isEarlyCashOut(outcome, round)) {
    state.consecutiveEarlyCashOuts += 1;
    if (
      state.consecutiveEarlyCashOuts >= EARLY_CASHOUT_TRIGGER_STREAK &&
      !state.penaltyActive
    ) {
      state.penaltyActive = true;
      state.penaltyGamesLeft = randomPenaltyGamesCount(rng);
      state.gamesSinceLastPenalty = 1;
    }
  } else {
    state.consecutiveEarlyCashOuts = 0;
    state.penaltyActive = false;
    state.penaltyGamesLeft = 0;
    state.gamesSinceLastPenalty = 1;
  }

  saveEarlyCashOutPenaltyState(uid, state);
  return state;
}

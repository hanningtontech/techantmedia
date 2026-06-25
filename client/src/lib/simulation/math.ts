import type { EvPoint, GameConfig, PayoutRow } from "./types";

export function totalCells(rows: number, cols: number): number {
  return rows * cols;
}

/** P(k consecutive safe picks without replacement). */
export function consecutiveWinProbability(total: number, bombs: number, rounds: number): number {
  if (rounds <= 0) return 1;
  const safe = total - bombs;
  if (rounds > safe || total <= 0 || bombs < 0) return 0;
  let p = 1;
  for (let i = 0; i < rounds; i++) {
    p *= (total - bombs - i) / (total - i);
  }
  return p;
}

export function singlePickWinProbability(total: number, bombs: number): number {
  if (total <= 0) return 0;
  return (total - bombs) / total;
}

export interface MultiplierVars {
  edge: number;
  pWin: number;
  round: number;
  total: number;
  bombs: number;
  stake: number;
}

const SAFE_FORMULA = /^[0-9+\-*/().%\s^a-zA-Z_]+$/;

export function evalCustomFormula(formula: string, vars: MultiplierVars): number {
  const trimmed = formula.trim();
  if (!trimmed || !SAFE_FORMULA.test(trimmed)) {
    throw new Error("Invalid custom formula");
  }
  const fn = new Function(
    "edge",
    "pWin",
    "round",
    "total",
    "bombs",
    "stake",
  `return (${trimmed});`,
  );
  const result = fn(vars.edge, vars.pWin, vars.round, vars.total, vars.bombs, vars.stake);
  if (typeof result !== "number" || !Number.isFinite(result) || result < 0) {
    throw new Error("Formula must return a finite non-negative number");
  }
  return result;
}

export function calculateMultiplier(config: GameConfig, round: number): number {
  const total = totalCells(config.rows, config.cols);
  const pWin = consecutiveWinProbability(total, config.bombs, round);
  if (pWin <= 0) return 0;

  const vars: MultiplierVars = {
    edge: config.houseEdge,
    pWin,
    round,
    total,
    bombs: config.bombs,
    stake: config.stake,
  };

  switch (config.multiplierMode) {
    case "linear":
      return (1 - config.houseEdge) / pWin;
    case "progressive": {
      const base = (1 - config.houseEdge) / pWin;
      return Math.pow(base, 1 + config.bonusFactor * (round - 1));
    }
    case "custom":
      return evalCustomFormula(config.customFormula, vars);
    default:
      return (1 - config.houseEdge) / pWin;
  }
}

export function buildPayoutTable(config: GameConfig): PayoutRow[] {
  const total = totalCells(config.rows, config.cols);
  const rows: PayoutRow[] = [];

  for (let round = 1; round <= config.simulationRounds; round++) {
    const winProbability = consecutiveWinProbability(total, config.bombs, round);
    const multiplier = calculateMultiplier(config, round);
    const potentialBalance = config.stake * multiplier;
    const expectedValue =
      config.stake * (winProbability * multiplier - (1 - winProbability));
    rows.push({ round, winProbability, multiplier, potentialBalance, expectedValue });
  }

  return rows;
}

export function buildEvSeries(config: GameConfig): EvPoint[] {
  return buildPayoutTable(config).map((row) => ({
    round: row.round,
    expectedValue: row.expectedValue,
    stake: config.stake,
  }));
}

export function clampBombs(bombs: number, total: number): number {
  return Math.min(Math.max(1, Math.floor(bombs)), Math.max(1, total - 1));
}

export function clampGridDimension(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, Math.floor(value)), max);
}

import { calculateMultiplier, totalCells } from "./math";
import type {
  AutoSimSettings,
  GameConfig,
  GameEconomics,
  PlayerStats,
  PlayerWallet,
  SessionEconomics,
  SimulationSummary,
  SinglePlayOutcome,
  UserWalletSettings,
} from "./types";
import { EMPTY_SESSION_ECONOMICS } from "./types";

export function createBombIndices(total: number, bombs: number, rng = Math.random): Set<number> {
  const indices = new Set<number>();
  while (indices.size < bombs && indices.size < total) {
    indices.add(Math.floor(rng() * total));
  }
  return indices;
}

export interface AutoGameResult {
  won: boolean;
  payout: number;
  roundsCompleted: number;
  bombIndices: number[];
  picks: number[];
  playerId: number;
  stake: number;
  economics: GameEconomics;
  skipped: boolean;
}

export function randomInRange(min: number, max: number, rng = Math.random): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + rng() * (hi - lo);
}

export function randomIntInRange(min: number, max: number, rng = Math.random): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(lo + rng() * (hi - lo + 1));
}

export interface PlayerGameQuota {
  playerId: number;
  total: number;
}

export function gamesPerPlayerRange(settings: AutoSimSettings): { min: number; max: number } {
  const min = settings.gamesPerPlayerMin ?? settings.gamesPerPlayer;
  const max = settings.gamesPerPlayerMax ?? settings.gamesPerPlayer;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

export function buildAutoSimSchedule(settings: AutoSimSettings, rng = Math.random): PlayerGameQuota[] {
  const { min, max } = gamesPerPlayerRange(settings);
  const quotas: PlayerGameQuota[] = [];
  for (let p = 0; p < settings.playerCount; p++) {
    quotas.push({ playerId: p, total: randomIntInRange(min, max, rng) });
  }
  return quotas;
}

export function totalScheduledGames(quotas: PlayerGameQuota[]): number {
  return quotas.reduce((sum, q) => sum + q.total, 0);
}

export function playerIdForGameIndex(quotas: PlayerGameQuota[], gameIndex: number): number {
  let offset = 0;
  for (const q of quotas) {
    if (gameIndex < offset + q.total) return q.playerId;
    offset += q.total;
  }
  return quotas[quotas.length - 1]?.playerId ?? 0;
}

export function randomDepositStake(
  settings: AutoSimSettings,
  wallet: UserWalletSettings,
  rng = Math.random,
): { deposit: number; stake: number } {
  if (settings.playerCount > 1 && settings.randomizeWallets) {
    const deposit = Math.round(randomInRange(settings.depositMin, settings.depositMax, rng) * 100) / 100;
    const stake = Math.round(randomInRange(settings.stakeMin, settings.stakeMax, rng) * 100) / 100;
    return { deposit: Math.max(1, deposit), stake: Math.max(0.01, stake) };
  }
  return { deposit: wallet.deposit, stake: wallet.stake };
}

export function createPlayerWallets(
  settings: AutoSimSettings,
  wallet: UserWalletSettings,
  rng = Math.random,
): PlayerWallet[] {
  const wallets: PlayerWallet[] = [];
  for (let p = 0; p < settings.playerCount; p++) {
    const { deposit, stake } = randomDepositStake(settings, wallet, rng);
    wallets.push({
      playerId: p,
      startingBalance: deposit,
      currentBalance: deposit,
      stakePerGame: stake,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      skippedGames: 0,
      totalStaked: 0,
      totalPayout: 0,
    });
  }
  return wallets;
}

/** User profit = payout − stake; admin revenue = stake − payout (mirror). */
export function computeGameEconomics(stake: number, payout: number): GameEconomics {
  return {
    userStake: stake,
    userPayout: payout,
    userProfit: payout - stake,
    adminRevenue: stake - payout,
  };
}

export function aggregateSessionEconomics(
  games: GameEconomics[],
  playerCount = 1,
  totalDeposited = 0,
  totalEndingBalance = 0,
): SessionEconomics {
  if (games.length === 0) {
    return { ...EMPTY_SESSION_ECONOMICS, playerCount, totalDeposited, totalEndingBalance };
  }
  let userTotalStaked = 0;
  let userTotalPayout = 0;
  for (const g of games) {
    userTotalStaked += g.userStake;
    userTotalPayout += g.userPayout;
  }
  const userNetProfit = userTotalPayout - userTotalStaked;
  const adminNetRevenue = userTotalStaked - userTotalPayout;
  return {
    gamesPlayed: games.length,
    playerCount,
    userTotalStaked,
    userTotalPayout,
    userNetProfit,
    adminNetRevenue,
    totalDeposited,
    totalEndingBalance,
    realizedHouseEdge: userTotalStaked > 0 ? adminNetRevenue / userTotalStaked : 0,
  };
}

/**
 * Simulate one full game with fair uniform RNG:
 * - bombs placed uniformly without replacement
 * - each pick is uniform among remaining unopened cells
 */
export function simulateAutoGame(
  config: GameConfig,
  playerId = 0,
  stakeOverride?: number,
  rng = Math.random,
): AutoGameResult {
  const stake = stakeOverride ?? config.stake;
  const total = totalCells(config.rows, config.cols);
  const bombIndices = createBombIndices(total, config.bombs, rng);
  const picks: number[] = [];
  const opened = new Set<number>();

  for (let round = 1; round <= config.simulationRounds; round++) {
    const unopened: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!opened.has(i)) unopened.push(i);
    }
    const pick = unopened[Math.floor(rng() * unopened.length)]!;
    picks.push(pick);
    opened.add(pick);

    if (bombIndices.has(pick)) {
      return {
        won: false,
        payout: 0,
        roundsCompleted: round - 1,
        bombIndices: Array.from(bombIndices),
        picks,
        playerId,
        stake,
        economics: computeGameEconomics(stake, 0),
        skipped: false,
      };
    }
  }

  const mult = calculateMultiplier(config, config.simulationRounds);
  const payout = stake * mult;
  return {
    won: true,
    payout,
    roundsCompleted: config.simulationRounds,
    bombIndices: Array.from(bombIndices),
    picks,
    playerId,
    stake,
    economics: computeGameEconomics(stake, payout),
    skipped: false,
  };
}

/** Play one game for a wallet player; returns null if insufficient balance. */
export function simulateWalletGame(
  config: GameConfig,
  player: PlayerWallet,
  rng = Math.random,
): AutoGameResult | null {
  if (player.currentBalance < player.stakePerGame) {
    player.skippedGames++;
    return null;
  }

  player.currentBalance -= player.stakePerGame;
  const result = simulateAutoGame(config, player.playerId, player.stakePerGame, rng);
  player.currentBalance += result.payout;
  player.gamesPlayed++;
  player.totalStaked += result.stake;
  player.totalPayout += result.payout;
  if (result.won) player.wins++;
  else player.losses++;
  return result;
}

export function walletsToPlayerStats(wallets: PlayerWallet[]): PlayerStats[] {
  return wallets.map((w) => {
    const netProfit = w.currentBalance - w.startingBalance;
    return {
      playerId: w.playerId,
      gamesPlayed: w.gamesPlayed,
      wins: w.wins,
      losses: w.losses,
      skippedGames: w.skippedGames,
      totalStaked: w.totalStaked,
      totalPayout: w.totalPayout,
      netProfit,
      startingBalance: w.startingBalance,
      endingBalance: w.currentBalance,
      stakePerGame: w.stakePerGame,
      sessionWon: netProfit > 0.001,
      sessionLost: netProfit < -0.001,
    };
  });
}

export function buildHistogram(
  payouts: number[],
  binCount = 20,
): { bin: string; count: number; min: number; max: number }[] {
  if (payouts.length === 0) return [];
  const min = Math.min(...payouts);
  const max = Math.max(...payouts);
  if (min === max) {
    return [{ bin: `$${min.toFixed(2)}`, count: payouts.length, min, max }];
  }

  const step = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    bin: `$${(min + i * step).toFixed(0)}–$${(min + (i + 1) * step).toFixed(0)}`,
    count: 0,
    min: min + i * step,
    max: min + (i + 1) * step,
  }));

  for (const p of payouts) {
    const idx = Math.min(binCount - 1, Math.floor((p - min) / step));
    bins[idx]!.count++;
  }

  return bins;
}

export function summarizeAutoPlay(
  results: AutoGameResult[],
  settings: AutoSimSettings,
  wallets: PlayerWallet[],
  stoppedEarly = false,
): SimulationSummary {
  const payouts = results.map((r) => r.payout);
  const gamesPlayed = payouts.length;
  const wins = results.filter((r) => r.won).length;
  const losses = gamesPlayed - wins;
  const totalStaked = results.reduce((a, r) => a + r.economics.userStake, 0);
  const totalPaidOut = results.reduce((a, r) => a + r.economics.userPayout, 0);
  const userNetProfit = totalPaidOut - totalStaked;
  const adminNetRevenue = totalStaked - totalPaidOut;
  const playerStats = walletsToPlayerStats(wallets);
  const totalDeposited = wallets.reduce((a, w) => a + w.startingBalance, 0);
  const totalEndingBalance = wallets.reduce((a, w) => a + w.currentBalance, 0);

  let playersWinners = 0;
  let playersLosers = 0;
  let playersBreakEven = 0;
  for (const p of playerStats) {
    if (p.sessionWon) playersWinners++;
    else if (p.sessionLost) playersLosers++;
    else playersBreakEven++;
  }

  return {
    gamesPlayed,
    totalWins: wins,
    totalLosses: losses,
    averagePayout: gamesPlayed ? totalPaidOut / gamesPlayed : 0,
    highestPayout: gamesPlayed ? Math.max(...payouts) : 0,
    lowestPayout: gamesPlayed ? Math.min(...payouts) : 0,
    totalStaked,
    totalPaidOut,
    rtp: totalStaked > 0 ? totalPaidOut / totalStaked : 0,
    playerCount: settings.playerCount,
    gamesPerPlayer: settings.gamesPerPlayerMax ?? settings.gamesPerPlayer,
    gamesPerPlayerMin: gamesPerPlayerRange(settings).min,
    gamesPerPlayerMax: gamesPerPlayerRange(settings).max,
    userNetProfit,
    adminNetRevenue,
    averageUserProfitPerGame: gamesPlayed ? userNetProfit / gamesPlayed : 0,
    totalDeposited,
    totalEndingBalance,
    playersWinners,
    playersLosers,
    playersBreakEven,
    playerStats,
    stoppedEarly,
  };
}

export function applyManualPick(
  config: GameConfig,
  bombIndices: Set<number>,
  cellIndex: number,
  currentRound: number,
  gameStake: number,
): SinglePlayOutcome {
  const isBomb = bombIndices.has(cellIndex);
  const round = isBomb ? currentRound : currentRound + 1;
  const multiplier = isBomb ? 0 : calculateMultiplier(config, round);
  const balanceAfter = isBomb ? 0 : gameStake * multiplier;
  const payout = isBomb ? 0 : balanceAfter;

  return {
    pickIndex: cellIndex,
    isBomb,
    balanceDelta: payout - gameStake,
    balanceAfter,
    round: isBomb ? currentRound : round,
    multiplier,
    bombIndices: Array.from(bombIndices),
    economics: computeGameEconomics(gameStake, payout),
  };
}

export function finalizeManualGameEconomics(gameStake: number, payout: number): GameEconomics {
  return computeGameEconomics(gameStake, payout);
}

export function cashOutPayout(config: GameConfig, round: number, gameStake: number): number {
  if (round <= 0) return 0;
  return gameStake * calculateMultiplier(config, round);
}

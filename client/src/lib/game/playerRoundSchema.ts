import type { SessionOutcome } from "@/lib/simulation/types";
import type { BlockGamePlayerRoundDoc } from "./playerRevenueFirestore";

/** Lifetime counters stored on `blockGamePlayers/{uid}`. */
export interface BlockGamePlayerStats {
  rounds: number;
  wins: number;
  losses: number;
  cashedOut: number;
  stopped: number;
  staked: number;
  payout: number;
  userProfit: number;
  adminRevenue: number;
}

export const EMPTY_PLAYER_STATS: BlockGamePlayerStats = {
  rounds: 0,
  wins: 0,
  losses: 0,
  cashedOut: 0,
  stopped: 0,
  staked: 0,
  payout: 0,
  userProfit: 0,
  adminRevenue: 0,
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function outcomeFromRaw(raw: unknown): SessionOutcome {
  if (
    raw === "won" ||
    raw === "lost" ||
    raw === "cashed_out" ||
    raw === "stopped"
  ) {
    return raw;
  }
  return "lost";
}

/** Normalize Firestore round payloads (handles legacy / partial docs). */
export function normalizePlayerRoundDoc(
  id: string,
  raw: Record<string, unknown>,
): BlockGamePlayerRoundDoc {
  const userStake = num(raw.userStake ?? raw.stake);
  const userPayout = num(raw.userPayout ?? raw.payout);
  let userProfit = num(raw.userProfit ?? raw.netProfit);
  let adminRevenue = num(raw.adminRevenue ?? raw.houseRevenue);

  if (userProfit === 0 && userPayout !== 0 && userStake !== 0) {
    userProfit = userPayout - userStake;
  }
  if (adminRevenue === 0 && userProfit !== 0) {
    adminRevenue = -userProfit;
  }

  let playedAtMs =
    num(raw.playedAtMs) ||
    (typeof raw.playedAt === "string" ? Date.parse(raw.playedAt) : 0);

  if (!playedAtMs && id.startsWith("pr_")) {
    const tail = id.split("_").pop();
    const fromId = tail ? Number(tail) : 0;
    if (Number.isFinite(fromId) && fromId > 0) playedAtMs = fromId;
  }

  if (!playedAtMs) playedAtMs = Date.now();

  return {
    id,
    uid: typeof raw.uid === "string" ? raw.uid : "",
    userEmail: typeof raw.userEmail === "string" ? raw.userEmail : "",
    userName: typeof raw.userName === "string" ? raw.userName : "",
    playedAt:
      typeof raw.playedAt === "string" ? raw.playedAt : new Date(playedAtMs).toISOString(),
    playedAtMs,
    outcome: outcomeFromRaw(raw.outcome),
    userStake,
    userPayout,
    userProfit,
    adminRevenue,
    gridRows: num(raw.gridRows, 3),
    gridCols: num(raw.gridCols, 3),
  };
}

export function emptyStatsForRound(): BlockGamePlayerStats {
  return { ...EMPTY_PLAYER_STATS };
}

export function applyRoundToStats(stats: BlockGamePlayerStats, round: BlockGamePlayerRoundDoc): void {
  stats.rounds += 1;
  stats.staked += round.userStake;
  stats.payout += round.userPayout;
  stats.userProfit += round.userProfit;
  stats.adminRevenue += round.adminRevenue;

  switch (round.outcome) {
    case "won":
      stats.wins += 1;
      break;
    case "lost":
      stats.losses += 1;
      break;
    case "cashed_out":
      stats.cashedOut += 1;
      break;
    case "stopped":
      stats.stopped += 1;
      break;
  }
}

/** Read `stats` object or legacy flat fields from a player Firestore doc. */
export function parsePlayerStatsFromFirestore(raw: Record<string, unknown>): BlockGamePlayerStats {
  const nested = raw.stats;
  if (nested && typeof nested === "object") {
    const s = nested as Record<string, unknown>;
    return {
      rounds: num(s.rounds ?? raw.totalRounds),
      wins: num(s.wins),
      losses: num(s.losses),
      cashedOut: num(s.cashedOut),
      stopped: num(s.stopped),
      staked: num(s.staked ?? raw.totalStaked),
      payout: num(s.payout ?? raw.totalPayout),
      userProfit: num(s.userProfit ?? raw.totalUserProfit),
      adminRevenue: num(s.adminRevenue ?? raw.totalAdminRevenue),
    };
  }

  return {
    rounds: num(raw.totalRounds),
    wins: num(raw.wins),
    losses: num(raw.losses),
    cashedOut: num(raw.cashedOut),
    stopped: num(raw.stopped),
    staked: num(raw.totalStaked),
    payout: num(raw.totalPayout),
    userProfit: num(raw.totalUserProfit),
    adminRevenue: num(raw.totalAdminRevenue),
  };
}

export function playerStatsToFirestore(stats: BlockGamePlayerStats): Record<string, unknown> {
  return {
    stats,
    totalRounds: stats.rounds,
    totalStaked: stats.staked,
    totalPayout: stats.payout,
    totalUserProfit: stats.userProfit,
    totalAdminRevenue: stats.adminRevenue,
    wins: stats.wins,
    losses: stats.losses,
    cashedOut: stats.cashedOut,
    stopped: stats.stopped,
  };
}

export function filterRoundsByPeriod(
  rounds: BlockGamePlayerRoundDoc[],
  startMs: number,
  endMs: number,
): BlockGamePlayerRoundDoc[] {
  return rounds.filter((r) => r.playedAtMs >= startMs && r.playedAtMs <= endMs);
}

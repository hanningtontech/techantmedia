import type { BlockGamePlayerRoundDoc } from "./playerRevenueFirestore";
import { aggregatePlayerRounds } from "./playerRevenueFirestore";

export interface PlayerOutcomeStats {
  wins: number;
  losses: number;
  cashedOut: number;
  stopped: number;
  totalRounds: number;
  userNet: number;
  adminNet: number;
  totalStaked: number;
  totalPayout: number;
}

export function computePlayerOutcomeStats(rounds: BlockGamePlayerRoundDoc[]): PlayerOutcomeStats {
  let wins = 0;
  let losses = 0;
  let cashedOut = 0;
  let stopped = 0;
  let userNet = 0;
  let adminNet = 0;
  let totalStaked = 0;
  let totalPayout = 0;

  for (const r of rounds) {
    if (r.outcome === "won") wins++;
    else if (r.outcome === "lost") losses++;
    else if (r.outcome === "cashed_out") cashedOut++;
    else if (r.outcome === "stopped") stopped++;

    userNet += r.userProfit;
    adminNet += r.adminRevenue;
    totalStaked += r.userStake;
    totalPayout += r.userPayout;
  }

  return {
    wins,
    losses,
    cashedOut,
    stopped,
    totalRounds: rounds.length,
    userNet,
    adminNet,
    totalStaked,
    totalPayout,
  };
}

export interface UserRoundBucket {
  uid: string;
  userName: string;
  userEmail: string;
  displayName: string;
  rounds: BlockGamePlayerRoundDoc[];
  stats: PlayerOutcomeStats;
}

export function groupRoundsByUser(rounds: BlockGamePlayerRoundDoc[]): UserRoundBucket[] {
  const map = new Map<string, BlockGamePlayerRoundDoc[]>();

  for (const r of rounds) {
    const list = map.get(r.uid) ?? [];
    list.push(r);
    map.set(r.uid, list);
  }

  const buckets: UserRoundBucket[] = [];

  for (const [uid, userRounds] of Array.from(map.entries())) {
    userRounds.sort((a: BlockGamePlayerRoundDoc, b: BlockGamePlayerRoundDoc) => b.playedAtMs - a.playedAtMs);
    const first = userRounds[0]!;
    buckets.push({
      uid,
      userName: first.userName,
      userEmail: first.userEmail,
      displayName: first.userName || first.userEmail || `${uid.slice(0, 8)}…`,
      rounds: userRounds,
      stats: computePlayerOutcomeStats(userRounds),
    });
  }

  buckets.sort((a, b) => b.stats.totalRounds - a.stats.totalRounds);
  return buckets;
}

export interface AdminRoundsAnalysis {
  aggregate: ReturnType<typeof aggregatePlayerRounds>;
  outcomes: PlayerOutcomeStats;
  userBuckets: UserRoundBucket[];
  uniquePlayers: number;
}

export function analyzeAdminPlayerRounds(
  rounds: BlockGamePlayerRoundDoc[],
  startMs: number,
  endMs: number,
): AdminRoundsAnalysis {
  const inPeriod = rounds.filter((r) => r.playedAtMs >= startMs && r.playedAtMs <= endMs);

  return {
    aggregate: aggregatePlayerRounds(rounds, startMs, endMs),
    outcomes: computePlayerOutcomeStats(inPeriod),
    userBuckets: groupRoundsByUser(inPeriod),
    uniquePlayers: new Set(inPeriod.map((r) => r.uid)).size,
  };
}

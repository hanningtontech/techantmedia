import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import type { GameEconomics } from "@/lib/simulation/types";
import type { SessionOutcome } from "@/lib/simulation/types";

const LOOKBACK_MS = 40 * 24 * 60 * 60 * 1000;

export interface BlockGamePlayerRoundDoc {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  playedAt: string;
  playedAtMs: number;
  outcome: SessionOutcome;
  userStake: number;
  userPayout: number;
  userProfit: number;
  /** House revenue — positive when player lost, negative when player won. */
  adminRevenue: number;
  gridRows: number;
  gridCols: number;
}

export interface PlayerRevenueSummaryDoc {
  totalGames: number;
  totalAdminRevenue: number;
  totalUserStaked: number;
  totalUserPayout: number;
  updatedAt: number;
}

function roundsCol() {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return collection(db, "blockGamePlayerRounds");
}

function summaryRef() {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return doc(db, "blockGame", "playerRevenue");
}

export interface PlayerRoundAggregate {
  rounds: number;
  adminNet: number;
  userNet: number;
  totalStaked: number;
  houseWinRounds: number;
  houseLossRounds: number;
  breakEvenRounds: number;
}

export function aggregatePlayerRounds(
  rounds: BlockGamePlayerRoundDoc[],
  startMs: number,
  endMs: number,
): PlayerRoundAggregate {
  let adminNet = 0;
  let userNet = 0;
  let totalStaked = 0;
  let houseWinRounds = 0;
  let houseLossRounds = 0;
  let breakEvenRounds = 0;
  let count = 0;

  for (const r of rounds) {
    if (r.playedAtMs < startMs || r.playedAtMs > endMs) continue;
    count++;
    adminNet += r.adminRevenue;
    userNet += r.userProfit;
    totalStaked += r.userStake;
    if (r.adminRevenue > 0) houseWinRounds++;
    else if (r.adminRevenue < 0) houseLossRounds++;
    else breakEvenRounds++;
  }

  return {
    rounds: count,
    adminNet,
    userNet,
    totalStaked,
    houseWinRounds,
    houseLossRounds,
    breakEvenRounds,
  };
}

/** Record a completed real-player round (not simulation). */
export async function recordPlayerRound(args: {
  uid: string;
  userEmail: string;
  userName: string;
  outcome: SessionOutcome;
  economics: GameEconomics;
  gridRows: number;
  gridCols: number;
}): Promise<void> {
  const col = roundsCol();
  const sumRef = summaryRef();
  const db = tryGetFirestoreDb();
  if (!col || !sumRef || !db) return;

  const playedAtMs = Date.now();
  const id = `pr_${args.uid.slice(0, 8)}_${playedAtMs}`;
  const round: BlockGamePlayerRoundDoc = {
    id,
    uid: args.uid,
    userEmail: args.userEmail,
    userName: args.userName,
    playedAt: new Date(playedAtMs).toISOString(),
    playedAtMs,
    outcome: args.outcome,
    userStake: args.economics.userStake,
    userPayout: args.economics.userPayout,
    userProfit: args.economics.userProfit,
    adminRevenue: args.economics.adminRevenue,
    gridRows: args.gridRows,
    gridCols: args.gridCols,
  };

  await runTransaction(db, async (tx) => {
    const sumSnap = await tx.get(sumRef);
    const prev = sumSnap.exists()
      ? (sumSnap.data() as PlayerRevenueSummaryDoc)
      : { totalGames: 0, totalAdminRevenue: 0, totalUserStaked: 0, totalUserPayout: 0, updatedAt: 0 };

    tx.set(doc(col, id), round);
    tx.set(
      sumRef,
      {
        totalGames: (prev.totalGames ?? 0) + 1,
        totalAdminRevenue: (prev.totalAdminRevenue ?? 0) + round.adminRevenue,
        totalUserStaked: (prev.totalUserStaked ?? 0) + round.userStake,
        totalUserPayout: (prev.totalUserPayout ?? 0) + round.userPayout,
        updatedAt: playedAtMs,
      },
      { merge: true },
    );
  });
}

/** Admin: live rounds for revenue dashboard (real players only). */
export function subscribePlayerRoundsAdmin(
  listener: (rounds: BlockGamePlayerRoundDoc[]) => void,
  sinceMs = Date.now() - LOOKBACK_MS,
): Unsubscribe {
  const col = roundsCol();
  if (!col) {
    listener([]);
    return () => {};
  }

  const q = query(
    col,
    where("playedAtMs", ">=", sinceMs),
    orderBy("playedAtMs", "desc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as BlockGamePlayerRoundDoc), id: d.id }));
      listener(list);
    },
    () => listener([]),
  );
}

export function subscribePlayerRevenueSummary(
  listener: (summary: PlayerRevenueSummaryDoc | null) => void,
): Unsubscribe {
  const ref = summaryRef();
  if (!ref) {
    listener(null);
    return () => {};
  }
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        listener(null);
        return;
      }
      listener(snap.data() as PlayerRevenueSummaryDoc);
    },
    () => listener(null),
  );
}

import * as admin from "firebase-admin";
import {
  appendTickToBuffer,
  appendTicksToPage,
  splitOverflowPages,
  type LiveChartTick,
} from "./liveChartStorage";

const GAMES_PER_RUN = 18;
const DEFAULT_HOUSE_EDGE = 0.03;
const ROWS = 6;
const COLS = 6;
const BOMBS = 3;
const STAKE = 10;
const SIM_ROUNDS = 5;

function totalCells(rows: number, cols: number): number {
  return rows * cols;
}

function consecutiveWinProbability(total: number, bombs: number, rounds: number): number {
  if (rounds <= 0) return 1;
  const safe = total - bombs;
  if (rounds > safe || total <= 0) return 0;
  let p = 1;
  for (let i = 0; i < rounds; i++) {
    p *= (total - bombs - i) / (total - i);
  }
  return p;
}

function calculateMultiplier(houseEdge: number, round: number, total: number, bombs: number): number {
  const pWin = consecutiveWinProbability(total, bombs, round);
  if (pWin <= 0) return 0;
  return (1 - houseEdge) / pWin;
}

function simulateOneGame(houseEdge: number, rng = Math.random): { stake: number; payout: number } {
  const total = totalCells(ROWS, COLS);
  const bombIndices = new Set<number>();
  while (bombIndices.size < BOMBS) {
    bombIndices.add(Math.floor(rng() * total));
  }
  const opened = new Set<number>();
  for (let round = 1; round <= SIM_ROUNDS; round++) {
    const unopened: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!opened.has(i)) unopened.push(i);
    }
    const pick = unopened[Math.floor(rng() * unopened.length)]!;
    opened.add(pick);
    if (bombIndices.has(pick)) {
      return { stake: STAKE, payout: 0 };
    }
  }
  const mult = calculateMultiplier(houseEdge, SIM_ROUNDS, total, BOMBS);
  return { stake: STAKE, payout: STAKE * mult };
}

function createTick(
  prev: LiveChartTick | undefined,
  stake: number,
  payout: number,
  gameIndex: number,
  t: number,
): LiveChartTick {
  const userDelta = payout - stake;
  const adminDelta = stake - payout;
  return {
    t,
    gameIndex,
    userCumulative: (prev?.userCumulative ?? 0) + userDelta,
    adminCumulative: (prev?.adminCumulative ?? 0) + adminDelta,
    userDelta,
    adminDelta,
    volume: stake,
    source: "auto",
  };
}

export async function pumpLiveChartOnce(): Promise<number> {
  const db = admin.firestore();
  const settingsSnap = await db.doc("blockGame/settings").get();
  const settings = settingsSnap.data() ?? {};
  const rawEdge = Number(settings.houseEdge ?? DEFAULT_HOUSE_EDGE);
  const houseEdge = Math.min(0.5, Math.max(0.01, Number.isFinite(rawEdge) ? rawEdge : DEFAULT_HOUSE_EDGE));

  const ref = db.doc("blockGame/liveChart");
  let added = 0;
  const newTicks: LiveChartTick[] = [];

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : {};
    let tail = Array.isArray(data.chartHistory) ? ([...data.chartHistory] as LiveChartTick[]) : [];
    let prev = tail[tail.length - 1] ?? (Array.isArray(data.chartHistory) ? undefined : undefined);

    let latestPageIndex = Number(data.latestPageIndex ?? 0);
    const pageRef = ref.collection("pages").doc(String(latestPageIndex));
    const pageSnap = await tx.get(pageRef);
    let pageTicks =
      pageSnap.exists && Array.isArray(pageSnap.data()?.ticks)
        ? ([...pageSnap.data()!.ticks] as LiveChartTick[])
        : [];

    let gameIndex = prev?.gameIndex ?? 0;

    for (let i = 0; i < GAMES_PER_RUN; i++) {
      const { stake, payout } = simulateOneGame(houseEdge);
      gameIndex += 1;
      const t = Math.max(Date.now(), (prev?.t ?? 0) + 1);
      const tick = createTick(prev, stake, payout, gameIndex, t);
      newTicks.push(tick);
      prev = tick;
      tail = appendTickToBuffer(tail, tick);
      added += 1;
    }

    pageTicks = appendTicksToPage(pageTicks, newTicks);
    const { pages, latestPageIndex: nextPageIndex, remainder } = splitOverflowPages(latestPageIndex, pageTicks);

    for (const page of pages) {
      tx.set(ref.collection("pages").doc(String(page.pageIndex)), page);
    }

    const activePageIndex = pages.length > 0 ? nextPageIndex : latestPageIndex;
    tx.set(ref.collection("pages").doc(String(activePageIndex)), {
      pageIndex: activePageIndex,
      ticks: remainder,
      startGameIndex: remainder[0]?.gameIndex ?? gameIndex,
      endGameIndex: remainder[remainder.length - 1]?.gameIndex ?? gameIndex,
    });

    const last = prev!;
    const sources = (data.activeSources ?? {}) as Record<string, number>;
    const totalTicks = Number(data.totalTicks ?? tail.length) + newTicks.length;
    const chartStartedAt = Number(data.chartStartedAt ?? last.t);

    tx.set(
      ref,
      {
        chartHistory: tail,
        latestPageIndex: activePageIndex,
        totalTicks,
        chartStartedAt: Math.min(chartStartedAt, newTicks[0]?.t ?? last.t),
        updatedAt: Date.now(),
        metrics: {
          totalGames: last.gameIndex,
          userProfit: last.userCumulative,
          adminRevenue: last.adminCumulative,
        },
        activeSources: {
          ...sources,
          simulation: Number(sources.simulation ?? 0) + added,
        },
      },
      { merge: true },
    );
  });

  return added;
}

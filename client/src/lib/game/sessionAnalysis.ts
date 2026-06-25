import type { PlayerSessionRecord } from "./playerSessionHistory";

export interface SessionEconomicsSummary {
  rounds: number;
  totalStaked: number;
  totalPayout: number;
  netProfit: number;
  realizedHouseEdge: number;
  targetHouseEdge: number | null;
  wins: number;
  losses: number;
  withdrawals: number;
}

export interface BombCountBucket {
  bombs: number;
  count: number;
  pctOfRounds: number;
}

export interface BombPlacementGroup {
  totalCells: number;
  gridLabel: string;
  rounds: number;
  cellHits: number[];
  expectedPerCell: number;
  uniformityScore: number;
  chiSquare: number;
  interpretation: string;
}

export interface SessionAnalysisResult {
  economics: SessionEconomicsSummary;
  bombBuckets: BombCountBucket[];
  avgBombPct: number | null;
  minBombs: number | null;
  maxBombs: number | null;
  placementGroups: BombPlacementGroup[];
  recordsWithBombData: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function analyzeSessionHistory(records: PlayerSessionRecord[]): SessionAnalysisResult {
  const rounds = records.length;
  let totalStaked = 0;
  let totalPayout = 0;
  let wins = 0;
  let losses = 0;
  let withdrawals = 0;
  let edgeSum = 0;
  let edgeCount = 0;

  for (const r of records) {
    totalStaked += r.stake;
    totalPayout += r.payout;
    if (r.outcome === "won") wins++;
    else if (r.outcome === "lost") losses++;
    else if (r.outcome === "cashed_out") withdrawals++;
    if (r.houseEdge != null && Number.isFinite(r.houseEdge)) {
      edgeSum += r.houseEdge;
      edgeCount++;
    }
  }

  const netProfit = totalPayout - totalStaked;
  const realizedHouseEdge = totalStaked > 0 ? round2(-netProfit / totalStaked) : 0;

  const withBombs = records.filter(
    (r) => r.bombCount != null && r.totalCells != null && r.totalCells > 0,
  );
  const recordsWithBombData = withBombs.filter(
    (r) => Array.isArray(r.bombIndices) && r.bombIndices.length > 0,
  ).length;

  const bombCountMap = new Map<number, number>();
  let bombPctSum = 0;
  let minBombs: number | null = null;
  let maxBombs: number | null = null;

  for (const r of withBombs) {
    const b = r.bombCount!;
    bombCountMap.set(b, (bombCountMap.get(b) ?? 0) + 1);
    bombPctSum += b / r.totalCells!;
    minBombs = minBombs == null ? b : Math.min(minBombs, b);
    maxBombs = maxBombs == null ? b : Math.max(maxBombs, b);
  }

  const bombBuckets: BombCountBucket[] = [...bombCountMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bombs, count]) => ({
      bombs,
      count,
      pctOfRounds: withBombs.length > 0 ? round2((count / withBombs.length) * 100) : 0,
    }));

  const placementByCells = new Map<number, { gridLabel: string; rounds: PlayerSessionRecord[] }>();

  for (const r of withBombs) {
    if (!Array.isArray(r.bombIndices) || r.bombIndices.length === 0) continue;
    const key = r.totalCells!;
    const prev = placementByCells.get(key);
    if (prev) prev.rounds.push(r);
    else placementByCells.set(key, { gridLabel: r.gridLabel, rounds: [r] });
  }

  const placementGroups: BombPlacementGroup[] = [];

  for (const [totalCells, { gridLabel, rounds: groupRounds }] of placementByCells) {
    const cellHits = Array.from({ length: totalCells }, () => 0);
    let totalBombPlacements = 0;

    for (const r of groupRounds) {
      for (const idx of r.bombIndices ?? []) {
        if (idx >= 0 && idx < totalCells) {
          cellHits[idx]!++;
          totalBombPlacements++;
        }
      }
    }

    const expectedPerCell = groupRounds.length > 0 ? totalBombPlacements / totalCells : 0;
    let chiSquare = 0;
    if (expectedPerCell > 0.01) {
      for (const hits of cellHits) {
        chiSquare += ((hits - expectedPerCell) ** 2) / expectedPerCell;
      }
    }

    const mean = cellHits.reduce((a, b) => a + b, 0) / Math.max(1, cellHits.length);
    const variance =
      cellHits.reduce((s, h) => s + (h - mean) ** 2, 0) / Math.max(1, cellHits.length);
    const uniformityScore = expectedPerCell > 0 ? round2(Math.sqrt(variance) / expectedPerCell) : 0;

    let interpretation = "Not enough data";
    if (groupRounds.length >= 5) {
      if (uniformityScore < 0.35) interpretation = "Looks random — bombs spread evenly across cells";
      else if (uniformityScore < 0.6) interpretation = "Fairly random — mild clustering may be luck";
      else interpretation = "Uneven spread — small samples often look clustered by chance";
    }

    placementGroups.push({
      totalCells,
      gridLabel,
      rounds: groupRounds.length,
      cellHits,
      expectedPerCell: round2(expectedPerCell),
      uniformityScore,
      chiSquare: round2(chiSquare),
      interpretation,
    });
  }

  placementGroups.sort((a, b) => b.rounds - a.rounds);

  return {
    economics: {
      rounds,
      totalStaked,
      totalPayout,
      netProfit,
      realizedHouseEdge,
      targetHouseEdge: edgeCount > 0 ? round2(edgeSum / edgeCount) : null,
      wins,
      losses,
      withdrawals,
    },
    bombBuckets,
    avgBombPct: withBombs.length > 0 ? round2((bombPctSum / withBombs.length) * 100) : null,
    minBombs,
    maxBombs,
    placementGroups,
    recordsWithBombData,
  };
}

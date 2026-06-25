import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadBlockGameSettings,
  subscribeBlockGameSettings,
  subscribeLiveChart,
  loadLiveChartSnapshot,
  loadFullLiveChartHistory,
  type LiveChartSnapshot,
} from "@/lib/game/blockGameFirestore";
import {
  hasSavedChartInterval,
  loadChartInterval,
  saveChartInterval,
} from "@/lib/game/chartDisplayPrefs";
import { DEFAULT_HOUSE_EDGE } from "@/lib/game/constants";
import {
  readSimChartSessionSnapshot,
  subscribeSimChartSessionSnapshot,
  type SimChartSessionSnapshot,
} from "@/lib/simulation/chartSessionSync";
import {
  allChartTimeframesForPicker,
  buildTimeCandles,
  CHART_TIMEFRAMES,
  mergeLiveChartTicks,
  pickDefaultTimeframeId,
  type SimChartTick,
} from "@/lib/simulation/timeChartHistory";
import type { SimCandle } from "@/lib/simulation/candleSeries";
import { useChartTickReplay, type ChartFeedSource } from "@/hooks/useChartTickReplay";

const LIVE_IDLE_MS = 12_000;
const SOFT_REFRESH_MS = 5_000;
const SIM_FAST_POLL_MS = 400;

interface MergedFeed {
  chartHistory: SimChartTick[];
  updatedAt: number;
  liveMetrics: { games: number; userProfit: number; adminRevenue: number };
  isLive: boolean;
  autoProgress: SimChartSessionSnapshot["autoProgress"] | null;
  houseEdge: number;
  userStake: number;
  activeSources: { player: number; simulation: number };
  source: ChartFeedSource;
}

function metricsFromHistory(
  history: SimChartTick[],
  fallback?: { totalGames: number; userProfit: number; adminRevenue: number },
) {
  const last = history[history.length - 1];
  return {
    games: last?.gameIndex ?? fallback?.totalGames ?? 0,
    userProfit: last?.userCumulative ?? fallback?.userProfit ?? 0,
    adminRevenue: last?.adminCumulative ?? fallback?.adminRevenue ?? 0,
  };
}

/** Firestore is the single chart timeline; sim session only supplies auto-progress overlay. */
function mergeChartFeeds(
  firestore: LiveChartSnapshot | null,
  sim: SimChartSessionSnapshot | null,
  houseEdge: number,
): MergedFeed {
  const empty: MergedFeed = {
    chartHistory: [],
    updatedAt: 0,
    liveMetrics: { games: 0, userProfit: 0, adminRevenue: 0 },
    isLive: false,
    autoProgress: null,
    houseEdge,
    userStake: 10,
    activeSources: { player: 0, simulation: 0 },
    source: "none",
  };

  const simRunning = sim?.autoProgress.running === true;
  const firestoreRecent = firestore != null && Date.now() - firestore.updatedAt < LIVE_IDLE_MS;

  let chartHistory: SimChartTick[] = [];
  if (firestore?.chartHistory.length) {
    chartHistory = firestore.chartHistory;
  } else if (sim?.chartHistory.length) {
    chartHistory = sim.chartHistory;
  }

  if (chartHistory.length === 0) return empty;

  const liveMetrics = metricsFromHistory(chartHistory, firestore ?? undefined);
  const isLive = simRunning || firestoreRecent || chartHistory.length > 0;

  return {
    chartHistory,
    updatedAt: Math.max(firestore?.updatedAt ?? 0, sim?.updatedAt ?? 0),
    liveMetrics,
    isLive,
    autoProgress: simRunning ? sim!.autoProgress : null,
    houseEdge: sim?.houseEdge ?? houseEdge,
    userStake: sim?.userStake ?? 10,
    activeSources: firestore?.activeSources ?? { player: 0, simulation: 0 },
    source: firestore?.chartHistory.length ? "firestore" : "sim",
  };
}

/** Soft-merge chart history — extend only, no flicker on refresh. */
function mergeChartHistorySoft(prev: SimChartTick[], incoming: SimChartTick[]): SimChartTick[] {
  return mergeLiveChartTicks(prev, incoming);
}

/** Same feed + UI as /simulation chart (`ForexCandlestickChart` via `BlockGameUniversalChart`). */
export function useUniversalLiveChart() {
  const [firestore, setFirestore] = useState<LiveChartSnapshot | null>(null);
  const [archivedHistory, setArchivedHistory] = useState<SimChartTick[]>([]);
  const [simSession, setSimSession] = useState<SimChartSessionSnapshot | null>(() =>
    readSimChartSessionSnapshot(),
  );
  const [houseEdge, setHouseEdge] = useState(DEFAULT_HOUSE_EDGE);
  const [timeframeId, setTimeframeIdState] = useState(() => loadChartInterval() ?? "1s");
  const prevTickCount = useRef(0);
  const [ticksGrowing, setTicksGrowing] = useState(false);

  const setTimeframeId = useCallback((id: string) => {
    setTimeframeIdState(id);
    saveChartInterval(id);
  }, []);

  useEffect(() => subscribeLiveChart(setFirestore), []);
  useEffect(() => subscribeBlockGameSettings((s) => setHouseEdge(s.houseEdge)), []);

  useEffect(() => {
    void loadFullLiveChartHistory().then(setArchivedHistory);
  }, []);

  useEffect(() => {
    return subscribeSimChartSessionSnapshot((snap) => {
      setSimSession(snap);
    });
  }, []);

  const simRunning = simSession?.autoProgress.running === true;

  useEffect(() => {
    const softRefresh = async () => {
      const snap = await loadLiveChartSnapshot();
      if (snap) {
        setFirestore((prev) => {
          if (!prev) return snap;
          return {
            ...snap,
            chartHistory: mergeChartHistorySoft(prev.chartHistory, snap.chartHistory),
          };
        });
      }
      const full = await loadFullLiveChartHistory();
      if (full.length > 0) setArchivedHistory(full);

      await loadBlockGameSettings().then((s) => setHouseEdge(s.houseEdge)).catch(() => {});

      const localSim = readSimChartSessionSnapshot();
      if (localSim) setSimSession(localSim);
    };

    const intervalMs = simRunning ? SIM_FAST_POLL_MS : SOFT_REFRESH_MS;
    const id = window.setInterval(() => void softRefresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [simRunning]);

  const merged = useMemo(
    () => mergeChartFeeds(firestore, simSession, houseEdge),
    [firestore, houseEdge, simSession],
  );

  const lifetimeHistory = useMemo(() => {
    const tail = merged.chartHistory;
    if (archivedHistory.length === 0) return tail;
    if (tail.length === 0) return archivedHistory;
    return mergeLiveChartTicks(archivedHistory, tail);
  }, [archivedHistory, merged.chartHistory]);

  const {
    liveMetrics,
    isLive,
    autoProgress,
    houseEdge: feedHouseEdge,
    userStake,
    activeSources,
    source,
  } = merged;

  const chartLive = isLive || ticksGrowing || simRunning;

  const chartHistory = useChartTickReplay(lifetimeHistory, { live: chartLive, source });

  useEffect(() => {
    const len = chartHistory.length;
    if (len > prevTickCount.current) {
      setTicksGrowing(true);
      const t = window.setTimeout(() => setTicksGrowing(false), LIVE_IDLE_MS);
      prevTickCount.current = len;
      return () => window.clearTimeout(t);
    }
    prevTickCount.current = len;
  }, [chartHistory.length]);

  const chartTimeframes = useMemo(() => allChartTimeframesForPicker(), []);

  const chartTimeframeMs = useMemo(() => {
    const found = CHART_TIMEFRAMES.find((t) => t.id === timeframeId);
    return found?.ms ?? CHART_TIMEFRAMES[0]!.ms;
  }, [timeframeId]);

  useEffect(() => {
    if (chartHistory.length < 2) return;
    if (hasSavedChartInterval()) return;
    if (!CHART_TIMEFRAMES.some((a) => a.id === timeframeId)) {
      setTimeframeIdState(pickDefaultTimeframeId(chartHistory));
    }
  }, [chartHistory, timeframeId]);

  const liveCandles = useMemo(
    () => buildTimeCandles(chartHistory, chartTimeframeMs, "user"),
    [chartHistory, chartTimeframeMs],
  );
  const liveAdminCandles = useMemo(
    () => buildTimeCandles(chartHistory, chartTimeframeMs, "admin"),
    [chartHistory, chartTimeframeMs],
  );

  const chartSeries = useMemo(
    () => [
      { id: "user", label: "User cumulative P/L", shortLabel: "USER/PL", candles: liveCandles },
      {
        id: "house",
        label: "House cumulative revenue",
        shortLabel: "HOUSE/REV",
        candles: liveAdminCandles,
      },
    ],
    [liveAdminCandles, liveCandles],
  );

  const progressPct =
    autoProgress && autoProgress.target > 0
      ? Math.round((autoProgress.completed / autoProgress.target) * 100)
      : liveMetrics.games > 0
        ? 100
        : 0;

  const liveRtp =
    liveMetrics.games > 0
      ? Math.max(0, 1 + liveMetrics.userProfit / Math.max(liveMetrics.games * userStake, 1))
      : 0;

  const liveStats =
    chartHistory.length > 0
      ? {
          games: liveMetrics.games,
          target: autoProgress?.target ?? liveMetrics.games,
          players:
            autoProgress?.totalPlayers ??
            activeSources.player + activeSources.simulation,
          activePlayer: autoProgress?.activePlayer ?? 0,
          userNet: liveMetrics.userProfit,
          houseNet: liveMetrics.adminRevenue,
          rtp: liveRtp,
          targetRtp: 1 - feedHouseEdge,
          progressPct,
        }
      : undefined;

  return {
    chartHistory,
    chartSeries,
    chartTimeframes,
    timeframeId,
    setTimeframeId,
    liveStats,
    isLive: chartLive,
    liveCandles,
    liveAdminCandles,
  };
}

export type { SimCandle };

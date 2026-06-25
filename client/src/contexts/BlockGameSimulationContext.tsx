import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  aggregateSessionEconomics,
  applyManualPick,
  buildAutoSimSchedule,
  buildHistogram,
  cashOutPayout,
  computeGameEconomics,
  createBombIndices,
  createPlayerWallets,
  finalizeManualGameEconomics,
  playerIdForGameIndex,
  simulateWalletGame,
  summarizeAutoPlay,
  totalScheduledGames,
} from "@/lib/simulation/engine";
import { appendLiveChartTick, loadLiveChartSnapshot, subscribeLiveChart, type LiveChartSnapshot } from "@/lib/game/blockGameFirestore";
import {
  getFullLiveChartHistoryCached,
  mergeTailIntoArchiveCache,
  peekLiveChartArchiveCache,
} from "@/lib/game/liveChartCache";
import { acquireChartSimWakeLock, releaseChartSimWakeLock } from "@/lib/game/chartSimKeepAlive";
import type { AutoGameResult, PlayerGameQuota } from "@/lib/simulation/engine";
import type { PlayerWallet } from "@/lib/simulation/types";
import {
  buildEvSeries,
  buildPayoutTable,
  clampBombs,
  clampGridDimension,
  consecutiveWinProbability,
  totalCells,
} from "@/lib/simulation/math";
import type {
  AutoPlayProgress,
  AutoSimSettings,
  CellState,
  EconomicsPoint,
  GameConfig,
  GameStatus,
  ManualSessionResult,
  PlayMode,
  SessionEconomics,
  SimulationSessionRecord,
  SimulationSummary,
  SinglePlayOutcome,
  UserWalletSettings,
} from "@/lib/simulation/types";
import {
  DEFAULT_AUTO_SIM,
  DEFAULT_CONFIG,
  DEFAULT_WALLET,
  EMPTY_SESSION_ECONOMICS,
} from "@/lib/simulation/types";
import { downloadSimulationSessionExcel } from "@/lib/simulation/sessionExport";
import {
  addSavedSession,
  createSessionId,
  defaultSessionName,
  deleteSavedSession,
  loadSavedSessions,
} from "@/lib/simulation/sessionStorage";
import { playBombExplosionSound, preloadBombSound } from "@/lib/simulation/bombEffects";
import {
  availableTimeframes,
  buildTimeCandles,
  CHART_TIMEFRAMES,
  chartWallClockMs,
  createChartTick,
  mergeLiveChartTicks,
  nextChartGameIndex,
  pickDefaultTimeframeId,
  type ChartTimeframe,
  type SimChartTick,
} from "@/lib/simulation/timeChartHistory";
import type { SimCandle } from "@/lib/simulation/candleSeries";
import {
  openSimChartPageInNewTab,
  writeSimChartSessionSnapshot,
} from "@/lib/simulation/chartSessionSync";

interface BlockGameSimulationState {
  config: GameConfig;
  autoSimSettings: AutoSimSettings;
  userWallet: UserWalletSettings;
  accountBalance: number;
  displayBalance: number;
  balanceAnimating: boolean;
  roundSettled: boolean;
  gameStake: number;
  canCashOut: boolean;
  playMode: PlayMode;
  status: GameStatus;
  cells: CellState[];
  bombIndices: Set<number>;
  revealed: Set<number>;
  selectedIndex: number | null;
  currentRound: number;
  balance: number;
  lastAction: "win" | "loss" | "idle";
  lastMultiplier: number;
  lastOutcome: SinglePlayOutcome | null;
  sessionEconomics: SessionEconomics;
  currentGameEconomics: ReturnType<typeof computeGameEconomics> | null;
  payoutTable: ReturnType<typeof buildPayoutTable>;
  evSeries: ReturnType<typeof buildEvSeries>;
  winLossDistribution: { name: string; value: number; fill: string }[];
  payoutHistogram: ReturnType<typeof buildHistogram>;
  economicsSeries: EconomicsPoint[];
  summary: SimulationSummary | null;
  manualResult: ManualSessionResult | null;
  simResultsOpen: boolean;
  chartMinimized: boolean;
  liveCandles: SimCandle[];
  liveAdminCandles: SimCandle[];
  chartHistory: SimChartTick[];
  chartTimeframeId: string;
  chartTimeframes: ChartTimeframe[];
  setChartTimeframe: (id: string) => void;
  liveMetrics: { games: number; userProfit: number; adminRevenue: number };
  autoProgress: AutoPlayProgress;
  formulaError: string | null;
  sessionName: string;
  sessionStartedAt: string | null;
  savedSessions: SimulationSessionRecord[];
  boardEpoch: number;
  explosionCell: number | null;
  setSessionName: (name: string) => void;
  startSession: () => void;
  clearActiveSession: () => void;
  saveSessionToStorage: () => boolean;
  exportCurrentSessionExcel: () => Promise<boolean>;
  exportSavedSessionExcel: (id: string) => Promise<void>;
  removeSavedSession: (id: string) => void;
  setConfig: (patch: Partial<GameConfig>) => void;
  setAutoSimSettings: (patch: Partial<AutoSimSettings>) => void;
  setUserWallet: (patch: Partial<UserWalletSettings>) => void;
  applyDeposit: () => void;
  applyPreset: (rows: number, cols: number) => void;
  resetGame: () => void;
  startNewGame: () => boolean;
  cashOut: () => void;
  clickCell: (index: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  startAutoPlay: (settingsOverride?: AutoSimSettings) => void;
  stopAutoPlay: () => void;
  closeSimResults: () => void;
  openChartDialog: () => void;
  minimizeChartDialog: () => void;
  expandChartDialog: () => void;
  openChartInNewTab: () => void;
  /** @deprecated use openChartDialog */
  openResultsDialog: () => void;
  playAgainAfterRound: () => boolean;
  stepRandomPick: () => void;
}

const BlockGameSimulationContext = createContext<BlockGameSimulationState | null>(null);

function emptyCells(total: number): CellState[] {
  return Array.from({ length: total }, () => "hidden");
}

function applyResultToBoard(
  result: AutoGameResult,
  cfg: GameConfig,
): { cells: CellState[]; revealed: Set<number> } {
  const total = totalCells(cfg.rows, cfg.cols);
  const cells = emptyCells(total);
  for (const idx of result.picks) {
    cells[idx] = result.bombIndices.includes(idx) ? "bomb" : "safe";
  }
  return { cells, revealed: new Set(result.picks) };
}

export function BlockGameSimulationProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<GameConfig>(DEFAULT_CONFIG);
  const [autoSimSettings, setAutoSimSettingsState] = useState<AutoSimSettings>(DEFAULT_AUTO_SIM);
  const [userWallet, setUserWalletState] = useState<UserWalletSettings>(DEFAULT_WALLET);
  const [accountBalance, setAccountBalance] = useState(DEFAULT_WALLET.deposit);
  const [displayBalance, setDisplayBalance] = useState(DEFAULT_WALLET.deposit);
  const [balanceAnimating, setBalanceAnimating] = useState(false);
  const [roundSettled, setRoundSettled] = useState(false);
  const [gameStake, setGameStake] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>("manual");
  const [status, setStatus] = useState<GameStatus>("idle");
  const [cells, setCells] = useState<CellState[]>(() => emptyCells(totalCells(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols)));
  const [bombIndices, setBombIndices] = useState<Set<number>>(() => new Set());
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [balance, setBalance] = useState(0);
  const [lastAction, setLastAction] = useState<"win" | "loss" | "idle">("idle");
  const [lastMultiplier, setLastMultiplier] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<SinglePlayOutcome | null>(null);
  const [sessionEconomics, setSessionEconomics] = useState<SessionEconomics>(EMPTY_SESSION_ECONOMICS);
  const [currentGameEconomics, setCurrentGameEconomics] = useState<ReturnType<typeof computeGameEconomics> | null>(null);
  const [payoutSamples, setPayoutSamples] = useState<number[]>([]);
  const [economicsSeries, setEconomicsSeries] = useState<EconomicsPoint[]>([]);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const [manualResult, setManualResult] = useState<ManualSessionResult | null>(null);
  const [simResultsOpen, setSimResultsOpen] = useState(false);
  const [chartMinimized, setChartMinimized] = useState(false);
  const [liveCandles, setLiveCandles] = useState<SimCandle[]>([]);
  const [liveAdminCandles, setLiveAdminCandles] = useState<SimCandle[]>([]);
  const [chartHistory, setChartHistory] = useState<SimChartTick[]>([]);
  const [chartTimeframeId, setChartTimeframeId] = useState("1s");
  const [liveMetrics, setLiveMetrics] = useState({ games: 0, userProfit: 0, adminRevenue: 0 });
  const [autoProgress, setAutoProgress] = useState<AutoPlayProgress>({
    running: false,
    completed: 0,
    target: 0,
    activePlayer: 0,
    totalPlayers: 0,
  });
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [sessionName, setSessionNameState] = useState("");
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<SimulationSessionRecord[]>([]);
  const [boardEpoch, setBoardEpoch] = useState(0);
  const [explosionCell, setExplosionCell] = useState<number | null>(null);

  const chartHistoryRef = useRef<SimChartTick[]>([]);
  const chartClockRef = useRef<number | null>(null);
  const autoSimLightweightRef = useRef(false);
  const autoProgressRef = useRef(autoProgress);
  autoProgressRef.current = autoProgress;
  const autoWallStepRef = useRef(Date.now());

  useEffect(() => {
    if (!autoProgress.running) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void acquireChartSimWakeLock();
        autoWallStepRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [autoProgress.running]);

  const autoAbortRef = useRef(false);
  const sessionGamesRef = useRef<ReturnType<typeof computeGameEconomics>[]>([]);
  const autoResultsRef = useRef<AutoGameResult[]>([]);
  const autoWalletsRef = useRef<PlayerWallet[]>([]);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScheduleRef = useRef<PlayerGameQuota[]>([]);
  const balanceAnimFrameRef = useRef<number | null>(null);
  const accountBeforeGameRef = useRef(accountBalance);

  const applyLiveChartSnapshot = useCallback((snap: LiveChartSnapshot) => {
    const cached = peekLiveChartArchiveCache();
    const base = cached.length > 0 ? cached : chartHistoryRef.current;
    const merged = mergeLiveChartTicks(base, snap.chartHistory);
    chartHistoryRef.current = merged;
    setChartHistory(merged);
    mergeTailIntoArchiveCache(snap.chartHistory);
    const last = merged[merged.length - 1];
    setLiveMetrics({
      games: last?.gameIndex ?? snap.totalGames,
      userProfit: last?.userCumulative ?? snap.userProfit,
      adminRevenue: last?.adminCumulative ?? snap.adminRevenue,
    });
  }, []);

  const hydrateChartFromLive = useCallback(async () => {
    const cached = peekLiveChartArchiveCache();
    if (cached.length > 0) {
      chartHistoryRef.current = cached;
      setChartHistory(cached);
      const last = cached[cached.length - 1];
      if (last) {
        setLiveMetrics({
          games: last.gameIndex,
          userProfit: last.userCumulative,
          adminRevenue: last.adminCumulative,
        });
      }
    }
    const snap = await loadLiveChartSnapshot();
    if (snap?.chartHistory.length) {
      applyLiveChartSnapshot(snap);
      return;
    }
    const full = await getFullLiveChartHistoryCached();
    if (full.length > 0) {
      chartHistoryRef.current = full;
      setChartHistory(full);
    }
  }, [applyLiveChartSnapshot]);

  useEffect(() => {
    setSavedSessions(loadSavedSessions());
    preloadBombSound();
    void hydrateChartFromLive();
    return subscribeLiveChart((live) => {
      if (!live) return;
      applyLiveChartSnapshot(live);
    });
  }, [applyLiveChartSnapshot, hydrateChartFromLive]);

  const pushChartTick = useCallback(
    (
      economics: ReturnType<typeof computeGameEconomics>,
      gameIndex: number,
      source: "manual" | "auto",
      opts?: { explicitTime?: number; stepMs?: number; batch?: boolean },
    ) => {
      const prev = chartHistoryRef.current[chartHistoryRef.current.length - 1];
      let t: number;
      if (opts?.explicitTime != null) {
        t = opts.explicitTime;
      } else {
        t = chartWallClockMs(prev);
      }

      const tick = createChartTick(prev, economics, gameIndex, t, source);
      chartHistoryRef.current.push(tick);
      setChartHistory([...chartHistoryRef.current]);
      setLiveMetrics({
        games: gameIndex,
        userProfit: tick.userCumulative,
        adminRevenue: tick.adminCumulative,
      });
      void appendLiveChartTick(tick, "simulation").catch(() => {});
    },
    [],
  );

  const appendAutoGameLive = useCallback(
    (economics: ReturnType<typeof computeGameEconomics>, batch = false) => {
      sessionGamesRef.current.push(economics);
      const gameIndex = nextChartGameIndex(chartHistoryRef.current);
      pushChartTick(economics, gameIndex, "auto", { batch });
    },
    [pushChartTick],
  );

  const syncSessionEconomics = useCallback((playerCount: number) => {
    const games = sessionGamesRef.current;
    const wallets = autoWalletsRef.current;
    const totalDeposited =
      wallets.length > 0
        ? wallets.reduce((a, w) => a + w.startingBalance, 0)
        : userWallet.deposit;
    const totalEndingBalance =
      wallets.length > 0
        ? wallets.reduce((a, w) => a + w.currentBalance, 0)
        : accountBalance;

    const session = aggregateSessionEconomics(games, playerCount, totalDeposited, totalEndingBalance);
    setSessionEconomics(session);

    if (games.length === 0) {
      setEconomicsSeries([]);
      return;
    }

    let userProfit = 0;
    let adminRevenue = 0;
    let stake = 0;
    const points: EconomicsPoint[] = [];
    const sampleEvery = Math.max(1, Math.floor(games.length / 40));

    for (let i = 0; i < games.length; i++) {
      const g = games[i]!;
      userProfit += g.userProfit;
      adminRevenue += g.adminRevenue;
      stake += g.userStake;
      const gameNum = i + 1;
      if (gameNum % sampleEvery === 0 || gameNum === games.length || gameNum === 1) {
        points.push({
          game: gameNum,
          userCumulativeProfit: userProfit,
          adminCumulativeRevenue: adminRevenue,
          cumulativeStake: stake,
        });
      }
    }
    setEconomicsSeries(points);
  }, [accountBalance, userWallet.deposit]);

  const recordGameEconomics = useCallback(
    (
      economics: ReturnType<typeof computeGameEconomics>,
      playerCount: number,
      _gameIndex?: number,
      opts?: { batch?: boolean },
    ) => {
      if (autoSimLightweightRef.current && playMode === "auto") {
        appendAutoGameLive(economics, opts?.batch);
        return;
      }
      sessionGamesRef.current.push(economics);
      const idx = nextChartGameIndex(chartHistoryRef.current);
      pushChartTick(economics, idx, playMode === "auto" ? "auto" : "manual");
      syncSessionEconomics(playerCount);
    },
    [appendAutoGameLive, playMode, pushChartTick, syncSessionEconomics],
  );

  const recordManualGameEconomics = useCallback(
    (economics: ReturnType<typeof computeGameEconomics>) => {
      sessionGamesRef.current.push(economics);
      const idx = nextChartGameIndex(chartHistoryRef.current);
      pushChartTick(economics, idx, "manual");
      syncSessionEconomics(1);
      setSessionStartedAt((prev) => prev ?? new Date().toISOString());
    },
    [pushChartTick, syncSessionEconomics],
  );

  const appendEconomicsBatch = useCallback(
    (batch: ReturnType<typeof computeGameEconomics>[], playerCount: number) => {
      sessionGamesRef.current.push(...batch);
      syncSessionEconomics(playerCount);
    },
    [syncSessionEconomics],
  );

  const openSimResults = useCallback((nextSummary: SimulationSummary) => {
    setManualResult(null);
    setSummary(nextSummary);
    setSimResultsOpen(true);
    setChartMinimized(false);
  }, []);

  const openChartDialog = useCallback(() => {
    setSimResultsOpen(true);
    setChartMinimized(false);
  }, []);

  const minimizeChartDialog = useCallback(() => setChartMinimized(true), []);

  const expandChartDialog = useCallback(() => {
    setSimResultsOpen(true);
    setChartMinimized(false);
  }, []);

  const openChartInNewTab = useCallback(() => {
    writeSimChartSessionSnapshot({
      updatedAt: Date.now(),
      chartHistory: chartHistoryRef.current,
      chartTimeframeId,
      liveMetrics,
      autoProgress,
      sessionName,
      houseEdge: config.houseEdge,
      userStake: userWallet.stake,
    });
    openSimChartPageInNewTab();
  }, [autoProgress, chartTimeframeId, config.houseEdge, liveMetrics, sessionName, userWallet.stake]);

  const closeSimResults = useCallback(() => {
    setSimResultsOpen(false);
    setChartMinimized(false);
  }, []);

  const openResultsDialog = openChartDialog;

  const animateBalanceTo = useCallback((from: number, to: number, onComplete?: () => void) => {
    if (balanceAnimFrameRef.current != null) {
      cancelAnimationFrame(balanceAnimFrameRef.current);
    }
    setBalanceAnimating(true);
    setDisplayBalance(from);
    const duration = 1400;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (to - from) * eased;
      setDisplayBalance(val);
      if (t < 1) {
        balanceAnimFrameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayBalance(to);
        setAccountBalance(to);
        setBalanceAnimating(false);
        balanceAnimFrameRef.current = null;
        onComplete?.();
      }
    };
    balanceAnimFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!balanceAnimating) setDisplayBalance(accountBalance);
  }, [accountBalance, balanceAnimating]);

  const setSessionName = useCallback((name: string) => setSessionNameState(name), []);

  const buildCurrentSessionRecord = useCallback((): SimulationSessionRecord | null => {
    const name = sessionName.trim() || defaultSessionName();
    if (sessionEconomics.gamesPlayed === 0 && !summary && !manualResult) {
      return null;
    }
    return {
      id: createSessionId(),
      name,
      startedAt: sessionStartedAt,
      savedAt: new Date().toISOString(),
      config,
      autoSimSettings,
      userWallet,
      sessionEconomics,
      summary,
      manualResult,
      economicsSeries,
    };
  }, [
    autoSimSettings,
    config,
    economicsSeries,
    manualResult,
    sessionEconomics,
    sessionName,
    sessionStartedAt,
    summary,
    userWallet,
  ]);

  const triggerBombExplosion = useCallback((cellIndex: number, playSound = true) => {
    if (playSound) playBombExplosionSound();
    setExplosionCell(cellIndex);
  }, []);

  /** New random bomb layout and hidden cells — call at every new game / round. */
  const reshuffleBoard = useCallback((cfg: GameConfig) => {
    const total = totalCells(cfg.rows, cfg.cols);
    const bombs = createBombIndices(total, cfg.bombs);
    setBoardEpoch((n) => n + 1);
    setExplosionCell(null);
    setCells(emptyCells(total));
    setBombIndices(bombs);
    setRevealed(new Set());
    setSelectedIndex(null);
    setCurrentRound(0);
    setBalance(0);
    setLastMultiplier(0);
    setLastOutcome(null);
    setCurrentGameEconomics(null);
  }, []);

  const revealAllCells = useCallback((bombs: Set<number>, total: number) => {
    setCells(
      Array.from({ length: total }, (_, i) => (bombs.has(i) ? "bomb" : "safe")),
    );
    setRevealed(new Set(Array.from({ length: total }, (_, i) => i)));
  }, []);

  const clearRunData = useCallback(() => {
    autoAbortRef.current = true;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setAutoProgress({
      running: false,
      completed: 0,
      target: 0,
      activePlayer: 0,
      totalPlayers: 0,
    });
    sessionGamesRef.current = [];
    autoResultsRef.current = [];
    autoWalletsRef.current = [];
    setSessionEconomics(EMPTY_SESSION_ECONOMICS);
    setCurrentGameEconomics(null);
    setPayoutSamples([]);
    setEconomicsSeries([]);
    setSummary(null);
    setManualResult(null);
    setSimResultsOpen(false);
    setChartMinimized(false);
    void hydrateChartFromLive();
    setRoundSettled(false);
    setGameStake(0);
    reshuffleBoard(config);
    setStatus("idle");
    setPlayMode("manual");
  }, [config, hydrateChartFromLive, reshuffleBoard]);

  const startSession = useCallback(() => {
    clearRunData();
    setSessionStartedAt(new Date().toISOString());
    setSessionNameState((prev) => (prev.trim() ? prev : defaultSessionName()));
    setAccountBalance(userWallet.deposit);
    setDisplayBalance(userWallet.deposit);
  }, [clearRunData, userWallet.deposit]);

  const clearActiveSession = useCallback(() => {
    clearRunData();
    setSessionStartedAt(null);
    setAccountBalance(userWallet.deposit);
    setDisplayBalance(userWallet.deposit);
  }, [clearRunData, userWallet.deposit]);

  const saveSessionToStorage = useCallback((): boolean => {
    const record = buildCurrentSessionRecord();
    if (!record) return false;
    setSavedSessions(addSavedSession(record));
    return true;
  }, [buildCurrentSessionRecord]);

  const exportCurrentSessionExcel = useCallback(async (): Promise<boolean> => {
    const record = buildCurrentSessionRecord();
    if (!record) return false;
    await downloadSimulationSessionExcel(record);
    return true;
  }, [buildCurrentSessionRecord]);

  const exportSavedSessionExcel = useCallback(async (id: string) => {
    const record = savedSessions.find((s) => s.id === id);
    if (record) await downloadSimulationSessionExcel(record);
  }, [savedSessions]);

  const removeSavedSession = useCallback((id: string) => {
    setSavedSessions(deleteSavedSession(id));
  }, []);

  useEffect(() => {
    if (status === "playing" || roundSettled) return;
    reshuffleBoard(config);
  }, [config.rows, config.cols, config.bombs, reshuffleBoard, status, roundSettled]);

  const setConfig = useCallback((patch: Partial<GameConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      const total = totalCells(
        clampGridDimension(next.rows, 1, 20),
        clampGridDimension(next.cols, 2, 20),
      );
      next.rows = clampGridDimension(next.rows, 1, 20);
      next.cols = clampGridDimension(next.cols, 2, 20);
      next.bombs = clampBombs(next.bombs, total);
      next.stake = Math.max(0.01, next.stake);
      next.houseEdge = Math.min(0.5, Math.max(0, next.houseEdge));
      next.simulationRounds = Math.min(total - next.bombs, Math.max(1, Math.floor(next.simulationRounds)));
      return next;
    });
  }, []);

  const setAutoSimSettings = useCallback((patch: Partial<AutoSimSettings>) => {
    setAutoSimSettingsState((prev) => {
      const next = {
        ...prev,
        ...patch,
        gamesPerPlayer: Math.min(
          1_000_000,
          Math.max(1, Math.floor(patch.gamesPerPlayer ?? prev.gamesPerPlayer)),
        ),
        gamesPerPlayerMin: Math.min(
          1_000_000,
          Math.max(1, Math.floor(patch.gamesPerPlayerMin ?? prev.gamesPerPlayerMin ?? prev.gamesPerPlayer)),
        ),
        gamesPerPlayerMax: Math.min(
          1_000_000,
          Math.max(1, Math.floor(patch.gamesPerPlayerMax ?? prev.gamesPerPlayerMax ?? prev.gamesPerPlayer)),
        ),
        playerCount: Math.min(10_000, Math.max(1, Math.floor(patch.playerCount ?? prev.playerCount))),
        speedMs: Math.min(2000, Math.max(0, Math.floor(patch.speedMs ?? prev.speedMs))),
        depositMin: Math.max(1, patch.depositMin ?? prev.depositMin),
        depositMax: Math.max(1, patch.depositMax ?? prev.depositMax),
        stakeMin: Math.max(0.01, patch.stakeMin ?? prev.stakeMin),
        stakeMax: Math.max(0.01, patch.stakeMax ?? prev.stakeMax),
      };
      const gMin = Math.min(next.gamesPerPlayerMin, next.gamesPerPlayerMax);
      const gMax = Math.max(next.gamesPerPlayerMin, next.gamesPerPlayerMax);
      next.gamesPerPlayerMin = gMin;
      next.gamesPerPlayerMax = gMax;
      next.gamesPerPlayer = gMax;
      return next;
    });
  }, []);

  const setUserWallet = useCallback((patch: Partial<UserWalletSettings>) => {
    setUserWalletState((prev) => {
      const next = {
        deposit: Math.max(0, patch.deposit ?? prev.deposit),
        stake: Math.max(0.01, patch.stake ?? prev.stake),
      };
      if (patch.stake !== undefined) {
        setConfigState((c) => ({ ...c, stake: next.stake }));
      }
      return next;
    });
  }, []);

  const applyDeposit = useCallback(() => {
    if (status === "playing") return;
    setAccountBalance(userWallet.deposit);
    setDisplayBalance(userWallet.deposit);
  }, [status, userWallet.deposit]);

  const applyPreset = useCallback(
    (rows: number, cols: number) => {
      setConfig({ rows, cols });
    },
    [setConfig],
  );

  const resetGame = useCallback(() => {
    autoAbortRef.current = true;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setAutoProgress({
      running: false,
      completed: 0,
      target: 0,
      activePlayer: 0,
      totalPlayers: 0,
    });
    sessionGamesRef.current = [];
    autoResultsRef.current = [];
    autoWalletsRef.current = [];
    setSessionEconomics(EMPTY_SESSION_ECONOMICS);
    setCurrentGameEconomics(null);
    setPayoutSamples([]);
    setEconomicsSeries([]);
    setSummary(null);
    setManualResult(null);
    setSimResultsOpen(false);
    setChartMinimized(false);
    setRoundSettled(false);
    setConfigState(DEFAULT_CONFIG);
    setAutoSimSettingsState(DEFAULT_AUTO_SIM);
    setUserWalletState(DEFAULT_WALLET);
    setAccountBalance(DEFAULT_WALLET.deposit);
    setDisplayBalance(DEFAULT_WALLET.deposit);
    setGameStake(0);
    reshuffleBoard(DEFAULT_CONFIG);
    setStatus("idle");
    setPlayMode("manual");
  }, [reshuffleBoard]);

  const recordManualRound = useCallback(
    (
      outcome: ManualSessionResult["outcome"],
      payout: number,
      round: number,
      multiplier: number,
      economics: ReturnType<typeof computeGameEconomics>,
      endingBalance: number,
    ) => {
      const starting = accountBeforeGameRef.current;
      const result: ManualSessionResult = {
        outcome,
        startingAccountBalance: starting,
        endingAccountBalance: endingBalance,
        gameStake,
        payout,
        netProfit: endingBalance - starting,
        round,
        multiplier,
      };
      setManualResult(result);
      setSummary(null);
      setCurrentGameEconomics(economics);
      recordManualGameEconomics(economics);
      setRoundSettled(true);
      setGameStake(0);
    },
    [gameStake, recordManualGameEconomics],
  );

  const startNewGame = useCallback((): boolean => {
    if (status === "playing" || playMode === "auto") return false;
    const stake = userWallet.stake;
    if (accountBalance < stake) return false;

    setRoundSettled(false);
    accountBeforeGameRef.current = accountBalance;
    setAccountBalance((b) => b - stake);
    setDisplayBalance((b) => b - stake);
    setGameStake(stake);
    setLastAction("idle");
    reshuffleBoard(config);
    setStatus("playing");
    return true;
  }, [accountBalance, config, playMode, reshuffleBoard, status, userWallet.stake]);

  const playAgainAfterRound = useCallback((): boolean => {
    if (status === "playing" || playMode === "auto") return false;
    setRoundSettled(false);
    setStatus("idle");
    return startNewGame();
  }, [playMode, startNewGame, status]);

  const revealCell = useCallback((index: number, isBomb: boolean) => {
    setCells((prev) => {
      const next = [...prev];
      next[index] = isBomb ? "bomb" : "safe";
      return next;
    });
    setRevealed((prev) => new Set(prev).add(index));
    setSelectedIndex(index);
  }, []);

  const settleWithPayout = useCallback(
    (
      outcome: ManualSessionResult["outcome"],
      payout: number,
      round: number,
      multiplier: number,
      gameStatus: GameStatus,
    ) => {
      const economics = finalizeManualGameEconomics(gameStake, payout);
      const ending = accountBalance + payout;
      setLastAction("win");
      setLastMultiplier(multiplier);
      setBalance(payout);
      setStatus(gameStatus);
      recordManualRound(outcome, payout, round, multiplier, economics, ending);
      animateBalanceTo(accountBalance, ending);
    },
    [accountBalance, animateBalanceTo, gameStake, recordManualRound],
  );

  const cashOut = useCallback(() => {
    if (status !== "playing" || currentRound <= 0 || playMode === "auto") return;
    const payout = cashOutPayout(config, currentRound, gameStake);
    const mult = payout / gameStake;
    settleWithPayout("cashed_out", payout, currentRound, mult, "cashed_out");
  }, [config, currentRound, gameStake, playMode, settleWithPayout, status]);

  const clickCell = useCallback(
    (index: number) => {
      if (status !== "playing" || revealed.has(index) || playMode === "auto") return;

      const outcome = applyManualPick(config, bombIndices, index, currentRound, gameStake);
      setLastOutcome(outcome);
      revealCell(index, outcome.isBomb);

      if (outcome.isBomb) {
        const total = totalCells(config.rows, config.cols);
        triggerBombExplosion(index);
        revealAllCells(bombIndices, total);
        setLastAction("loss");
        setBalance(0);
        setLastMultiplier(0);
        setStatus("lost");
        recordManualRound("lost", 0, outcome.round, 0, outcome.economics, accountBalance);
        return;
      }

      setCurrentRound(outcome.round);
      setBalance(outcome.balanceAfter);
      setLastMultiplier(outcome.multiplier);
      setLastAction("win");
      setCurrentGameEconomics(outcome.economics);

      // Manual/step: keep playing until withdraw, bomb, or all safe cells cleared.
      const total = totalCells(config.rows, config.cols);
      const maxSafeRounds = total - config.bombs;
      if (outcome.round >= maxSafeRounds) {
        settleWithPayout(
          "won",
          outcome.balanceAfter,
          outcome.round,
          outcome.multiplier,
          "won",
        );
      }
    },
    [
      accountBalance,
      bombIndices,
      config,
      currentRound,
      gameStake,
      playMode,
      recordManualRound,
      revealAllCells,
      revealCell,
      revealed,
      settleWithPayout,
      status,
      triggerBombExplosion,
    ],
  );

  const stepRandomPick = useCallback(() => {
    if (status !== "playing") return;
    const total = totalCells(config.rows, config.cols);
    const unopened: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!revealed.has(i)) unopened.push(i);
    }
    if (unopened.length === 0) return;
    const pick = unopened[Math.floor(Math.random() * unopened.length)]!;
    clickCell(pick);
  }, [clickCell, config.cols, config.rows, revealed, status]);

  const applyAutoResultToUi = useCallback(
    (result: AutoGameResult) => {
      const board = applyResultToBoard(result, config);
      setCells(board.cells);
      setRevealed(board.revealed);
      setBombIndices(new Set(result.bombIndices));
      const lastPick = result.picks[result.picks.length - 1] ?? 0;
      if (!result.won) {
        triggerBombExplosion(lastPick, false);
      } else {
        setExplosionCell(null);
      }
      setLastOutcome({
        pickIndex: lastPick,
        isBomb: !result.won,
        balanceDelta: result.economics.userProfit,
        balanceAfter: result.payout,
        round: result.roundsCompleted,
        multiplier: result.won ? result.payout / result.stake : 0,
        bombIndices: result.bombIndices,
        economics: result.economics,
      });
      setCurrentGameEconomics(result.economics);
      setLastAction(result.won ? "win" : "loss");
      setBalance(result.payout);
      setStatus(result.won ? "won" : "lost");
    },
    [config, triggerBombExplosion],
  );

  const startAutoPlay = useCallback(
    (settingsOverride?: AutoSimSettings) => {
      autoAbortRef.current = false;
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);

      const settings = settingsOverride ?? autoSimSettings;
      if (settingsOverride) setAutoSimSettingsState(settings);

      const wallets = createPlayerWallets(settings, userWallet);
      autoWalletsRef.current = wallets;
      autoResultsRef.current = [];
      sessionGamesRef.current = [];

      autoScheduleRef.current = buildAutoSimSchedule(settings);
      const totalGames = totalScheduledGames(autoScheduleRef.current);
      const playerFor = (index: number) => playerIdForGameIndex(autoScheduleRef.current, index);
      const useLightweightUi = true;
      autoSimLightweightRef.current = useLightweightUi;
      setManualResult(null);
      setSummary(null);
      setSimResultsOpen(true);
      setChartMinimized(true);
      setSessionStartedAt((prev) => prev ?? new Date().toISOString());
      setPlayMode("auto");
      setAutoProgress({
        running: true,
        completed: 0,
        target: totalGames,
        activePlayer: 0,
        totalPlayers: settings.playerCount,
      });

      let completed = 0;
      const payouts: number[] = [];

      const finishRun = (stoppedEarly = false) => {
        autoSimLightweightRef.current = false;
        void releaseChartSimWakeLock();
        setAutoProgress((p) => ({ ...p, running: false, completed }));
        setPayoutSamples([...payouts]);
        const finalSummary = summarizeAutoPlay(
          autoResultsRef.current,
          settings,
          autoWalletsRef.current,
          stoppedEarly,
        );
        syncSessionEconomics(settings.playerCount);
        openSimResults(finalSummary);
        const last = autoResultsRef.current[autoResultsRef.current.length - 1];
        if (last) applyAutoResultToUi(last);
      };

      const playOne = (playerIndex: number): boolean => {
        const wallet = autoWalletsRef.current[playerIndex];
        if (!wallet) return false;
        const result = simulateWalletGame(config, wallet);
        if (!result) return false;
        autoResultsRef.current.push(result);
        payouts.push(result.payout);
        return true;
      };

      void acquireChartSimWakeLock();
      autoWallStepRef.current = Date.now();

      const runVisualStep = () => {
        if (autoAbortRef.current) {
          finishRun(true);
          return;
        }
        if (completed >= totalGames) {
          finishRun(false);
          return;
        }

        const now = Date.now();
        const hiddenBurst =
          typeof document !== "undefined" &&
          document.hidden &&
          settings.speedMs > 0
            ? Math.min(400, Math.max(1, Math.floor((now - autoWallStepRef.current) / settings.speedMs)))
            : 1;
        autoWallStepRef.current = now;

        let lastPlayerId = playerFor(Math.max(0, completed - 1));
        for (let burst = 0; burst < hiddenBurst && completed < totalGames; burst++) {
          const playerId = playerFor(completed);
          lastPlayerId = playerId;
          const played = playOne(playerId);
          completed++;
          if (played) {
            recordGameEconomics(
              autoResultsRef.current[autoResultsRef.current.length - 1]!.economics,
              settings.playerCount,
              completed,
            );
          }
        }

        setAutoProgress({
          running: true,
          completed,
          target: totalGames,
          activePlayer: lastPlayerId,
          totalPlayers: settings.playerCount,
        });

        if (completed >= totalGames) {
          finishRun(false);
          return;
        }

        const delay =
          typeof document !== "undefined" && document.hidden
            ? Math.max(250, Math.min(settings.speedMs, 1000))
            : settings.speedMs;
        autoTimerRef.current = setTimeout(runVisualStep, delay);
      };

      const runBatch = () => {
        if (autoAbortRef.current) {
          finishRun(true);
          return;
        }

        const batchSize = totalGames >= 100_000 ? 2000 : 500;
        let batchEnd = completed + batchSize;

        while (completed < batchEnd && completed < totalGames) {
          const playerId = playerFor(completed);
          const played = playOne(playerId);
          completed++;
          if (played) {
            recordGameEconomics(
              autoResultsRef.current[autoResultsRef.current.length - 1]!.economics,
              settings.playerCount,
              completed,
              { batch: settings.speedMs === 0 },
            );
          }
        }

        setAutoProgress({
          running: true,
          completed,
          target: totalGames,
          activePlayer: playerFor(Math.max(0, completed - 1)),
          totalPlayers: settings.playerCount,
        });

        if (completed < totalGames) {
          requestAnimationFrame(runBatch);
        } else {
          finishRun(false);
        }
      };

      const beginAutoRun = () => {
        if (settings.speedMs > 0) {
          runVisualStep();
        } else if (totalGames >= 500) {
          runBatch();
        } else {
          while (completed < totalGames) {
            const playerId = playerFor(completed);
            const played = playOne(playerId);
            completed++;
            if (played) {
              recordGameEconomics(
                autoResultsRef.current[autoResultsRef.current.length - 1]!.economics,
                settings.playerCount,
                completed,
                { batch: settings.speedMs === 0 },
              );
            }
          }
          finishRun(false);
        }
      };

      void hydrateChartFromLive().then(beginAutoRun);
    },
    [
      appendAutoGameLive,
      applyAutoResultToUi,
      autoSimSettings,
      config,
      hydrateChartFromLive,
      openSimResults,
      recordGameEconomics,
      syncSessionEconomics,
      userWallet,
    ],
  );

  const stopAutoPlay = useCallback(() => {
    autoAbortRef.current = true;
    autoSimLightweightRef.current = false;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setAutoProgress((p) => ({ ...p, running: false }));
    if (autoResultsRef.current.length > 0 || autoWalletsRef.current.length > 0) {
      const finalSummary = summarizeAutoPlay(
        autoResultsRef.current,
        autoSimSettings,
        autoWalletsRef.current,
        true,
      );
      syncSessionEconomics(autoSimSettings.playerCount);
      openSimResults(finalSummary);
    }
  }, [autoSimSettings, openSimResults, syncSessionEconomics]);

  const { payoutTable, evSeries, formulaError: derivedFormulaError } = useMemo(() => {
    try {
      return {
        payoutTable: buildPayoutTable(config),
        evSeries: buildEvSeries(config),
        formulaError: null as string | null,
      };
    } catch (e) {
      return {
        payoutTable: [] as ReturnType<typeof buildPayoutTable>,
        evSeries: [] as ReturnType<typeof buildEvSeries>,
        formulaError: e instanceof Error ? e.message : "Invalid formula",
      };
    }
  }, [config]);

  useEffect(() => {
    setFormulaError(derivedFormulaError);
  }, [derivedFormulaError]);

  const winLossDistribution = useMemo(() => {
    const total = totalCells(config.rows, config.cols);
    const winP = consecutiveWinProbability(total, config.bombs, config.simulationRounds);
    const lossP = 1 - winP;
    return [
      { name: "User wins", value: winP * 100, fill: "hsl(152, 70%, 45%)" },
      { name: "User loses", value: lossP * 100, fill: "hsl(0, 72%, 55%)" },
    ];
  }, [config]);

  const payoutHistogram = useMemo(() => buildHistogram(payoutSamples), [payoutSamples]);
  const canCashOut = status === "playing" && currentRound > 0 && playMode !== "auto";

  const chartTimeframes = useMemo(() => availableTimeframes(chartHistory), [chartHistory]);

  const chartTimeframeMs = useMemo(() => {
    const found = CHART_TIMEFRAMES.find((t) => t.id === chartTimeframeId);
    return found?.ms ?? CHART_TIMEFRAMES[0]!.ms;
  }, [chartTimeframeId]);

  useEffect(() => {
    if (chartHistory.length < 2) return;
    const avail = availableTimeframes(chartHistory);
    if (avail.length === 0) return;
    if (!avail.some((a) => a.id === chartTimeframeId)) {
      setChartTimeframeId(pickDefaultTimeframeId(chartHistory));
    }
  }, [chartHistory, chartTimeframeId]);

  useEffect(() => {
    const user = buildTimeCandles(chartHistory, chartTimeframeMs, "user");
    const admin = buildTimeCandles(chartHistory, chartTimeframeMs, "admin");
    setLiveCandles(user);
    setLiveAdminCandles(admin);
  }, [chartHistory, chartTimeframeMs]);

  const setChartTimeframe = useCallback((id: string) => {
    setChartTimeframeId(id);
  }, []);

  useEffect(() => {
    writeSimChartSessionSnapshot({
      updatedAt: Date.now(),
      chartHistory,
      chartTimeframeId,
      liveMetrics,
      autoProgress,
      sessionName,
      houseEdge: config.houseEdge,
      userStake: userWallet.stake,
    });
  }, [
    autoProgress,
    chartHistory,
    chartTimeframeId,
    config.houseEdge,
    liveMetrics,
    sessionName,
    userWallet.stake,
  ]);

  const value: BlockGameSimulationState = {
    config,
    autoSimSettings,
    userWallet,
    accountBalance,
    displayBalance,
    balanceAnimating,
    roundSettled,
    gameStake,
    canCashOut,
    playMode,
    status,
    cells,
    bombIndices,
    revealed,
    selectedIndex,
    currentRound,
    balance,
    lastAction,
    lastMultiplier,
    lastOutcome,
    sessionEconomics,
    currentGameEconomics,
    payoutTable,
    evSeries,
    winLossDistribution,
    payoutHistogram,
    economicsSeries,
    summary,
    manualResult,
    simResultsOpen,
    chartMinimized,
    liveCandles,
    liveAdminCandles,
    chartHistory,
    chartTimeframeId,
    chartTimeframes,
    setChartTimeframe,
    liveMetrics,
    autoProgress,
    formulaError,
    sessionName,
    sessionStartedAt,
    savedSessions,
    boardEpoch,
    explosionCell,
    setSessionName,
    startSession,
    clearActiveSession,
    saveSessionToStorage,
    exportCurrentSessionExcel,
    exportSavedSessionExcel,
    removeSavedSession,
    setConfig,
    setAutoSimSettings,
    setUserWallet,
    applyDeposit,
    applyPreset,
    resetGame,
    startNewGame,
    cashOut,
    clickCell,
    setPlayMode,
    startAutoPlay,
    stopAutoPlay,
    closeSimResults,
    openChartDialog,
    minimizeChartDialog,
    expandChartDialog,
    openChartInNewTab,
    openResultsDialog,
    playAgainAfterRound,
    stepRandomPick,
  };

  return (
    <BlockGameSimulationContext.Provider value={value}>{children}</BlockGameSimulationContext.Provider>
  );
}

export function useBlockGameSimulation() {
  const ctx = useContext(BlockGameSimulationContext);
  if (!ctx) {
    throw new Error("useBlockGameSimulation must be used within BlockGameSimulationProvider");
  }
  return ctx;
}

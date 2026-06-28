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
  basePlayerGameConfig,
  DEFAULT_PLAYER_GRID_ID,
  DEFAULT_HOUSE_EDGE,
  MAX_STAKE_KES,
  MIN_STAKE_KES,
  PLAYER_GRID_PRESETS,
  loadGridAppearancePrefs,
  saveGridAppearancePrefs,
  type GridColorThemeId,
  type GridStyleThemeId,
  normalizeGridPresetForPhone,
  resolvePlayerGridDimensions,
  type PlayerGridPresetId,
} from "@/lib/game/constants";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { playTargetApplause, preloadTargetApplause } from "@/lib/game/applauseSound";
import { isValidTargetBalance, targetProfitAmount } from "@/lib/game/targetMode";
import {
  clearPlayerTargetStorage,
  loadPlayerTarget,
  savePlayerTarget,
} from "@/lib/game/targetStorage";
import { formatKes } from "@/lib/game/formatKes";
import { toast } from "sonner";
import { openSimChartPageInNewTab } from "@/lib/simulation/chartSessionSync";
import {
  loadChartPanelMode,
  saveChartPanelMode,
  type ChartPanelMode,
} from "@/lib/game/chartPanelPrefs";
import {
  appendLiveChartTick,
  createBlockGameFundRequest,
  ensureBlockGameWallet,
  saveBlockGameWallet,
  subscribeBlockGameWallet,
  subscribeLiveChart,
  subscribeBlockGameSettings,
  subscribeUserFundRequests,
} from "@/lib/game/blockGameFirestore";
import {
  appendPlayerSessionRecord,
  loadPlayerSessionHistory,
  type PlayerSessionRecord,
} from "@/lib/game/playerSessionHistory";
import { recordPlayerRound } from "@/lib/game/playerRevenueFirestore";
import { bombHitEffectsDelayMs, bombStaggerIntervalMs, bombsPerStaggerStep } from "@/lib/game/bombRevealTiming";
import {
  loadPlayerWallet,
  savePlayerWallet,
  type FundRequestRecord,
} from "@/lib/game/playerStorage";
import { resolveBombRangeForPreset, type GridBombRanges, defaultBombRanges } from "@/lib/game/bombRangeSettings";
import {
  onPlayerRoundComplete,
  preparePenaltyForNewGame,
} from "@/lib/game/earlyCashOutPenalty";
import {
  adaptivePlayerPayout,
  calculateAdaptivePlayerMultiplier,
  createAdaptiveBombIndices,
  loadPlayerAdaptiveState,
  onAdaptiveRoundComplete,
  planAdaptiveBoard,
  prepareAdaptiveGame,
  recordAdaptivePick,
  savePlayerAdaptiveState,
  type PlayerAdaptiveState,
} from "@/lib/game/playerAdaptiveEngine";
import {
  applyManualPick,
  finalizeManualGameEconomics,
} from "@/lib/simulation/engine";
import { isBombSoundMuted, playBombExplosionSound, playBombRevealTickSound, playSafeRevealSound, preloadBombSound, setBombSoundMuted, stopBombRevealTickSound, unlockGameAudio } from "@/lib/simulation/bombEffects";
import { totalCells } from "@/lib/simulation/math";
import type {
  CellState,
  GameConfig,
  GameEconomics,
  GameStatus,
  ManualSessionResult,
} from "@/lib/simulation/types";
import {
  buildTimeCandles,
  CHART_TIMEFRAMES,
  createChartTick,
  chartWallClockMs,
  nextChartGameIndex,
  type ChartTimeframe,
  type SimChartTick,
} from "@/lib/simulation/timeChartHistory";
import type { SimCandle } from "@/lib/simulation/candleSeries";

interface BlockGamePlayerState {
  config: GameConfig;
  gridPresetId: PlayerGridPresetId;
  gridColorId: GridColorThemeId;
  gridStyleId: GridStyleThemeId;
  cells: CellState[];
  status: GameStatus;
  selectedIndex: number | null;
  currentRound: number;
  roundBalance: number;
  lastMultiplier: number;
  roundSettled: boolean;
  lastResult: ManualSessionResult | null;
  accountBalance: number;
  displayBalance: number;
  balanceAnimating: boolean;
  stake: number;
  soundMuted: boolean;
  gamesPlayed: number;
  sessionHistory: PlayerSessionRecord[];
  chartHistory: SimChartTick[];
  liveCandles: SimCandle[];
  liveAdminCandles: SimCandle[];
  chartTimeframeId: string;
  chartTimeframes: ChartTimeframe[];
  chartPanelMode: ChartPanelMode;
  liveMetrics: { games: number; userProfit: number; adminRevenue: number };
  explosionCell: number | null;
  bombPopCell: number | null;
  bombAnimationsEnabled: boolean;
  bombCascadeActive: boolean;
  boardEpoch: number;
  canCashOut: boolean;
  canStartGame: boolean;
  canPlayAgain: boolean;
  canResetAfterRound: boolean;
  playAgain: () => boolean;
  sessionTarget: number | null;
  targetCelebration: { owedAmount: number; targetBalance: number } | null;
  formatKes: typeof formatKes;
  setGridPreset: (id: PlayerGridPresetId) => void;
  setGridColorTheme: (id: GridColorThemeId) => void;
  setGridStyleTheme: (id: GridStyleThemeId) => void;
  setStake: (amount: number) => void;
  toggleSoundMuted: () => void;
  setBombAnimationsEnabled: (enabled: boolean) => void;
  startNewGame: () => boolean;
  resetAfterRound: () => void;
  setPlayerTarget: (targetBalance: number) => boolean;
  clearPlayerTarget: () => void;
  cashOut: () => void;
  penaltyKeepFraction: number | null;
  roundMultiplierCap: number | null;
  clickCell: (index: number) => void;
  requestFund: (amount: number) => FundRequestRecord;
  dismissTargetCelebration: () => void;
  openChartInNewTab: () => void;
  setChartTimeframe: (id: string) => void;
  showChartPanel: () => void;
  expandChartPanel: () => void;
  minimizeChartPanel: () => void;
  hideChartPanel: () => void;
}

const BlockGamePlayerContext = createContext<BlockGamePlayerState | null>(null);

interface ActiveRoundState {
  config: GameConfig;
  bombIndices: Set<number>;
  gameStake: number;
  currentRound: number;
  penaltyKeepFraction: number | null;
  baseHouseEdge: number;
  multiplierCap: number | null;
}

interface BoardSnapshot {
  bombs: number;
  bombIndices: Set<number>;
  config: GameConfig;
  multiplierCap: number | null;
  baseHouseEdge: number;
}

function roundMultOptions(active: ActiveRoundState) {
  return {
    baseHouseEdge: active.baseHouseEdge,
    penaltyKeepFraction: active.penaltyKeepFraction,
    multiplierCap: active.multiplierCap,
  };
}

function emptyCells(total: number): CellState[] {
  return Array.from({ length: total }, () => "hidden");
}

export function BlockGamePlayerProvider({
  children,
  uid,
  userEmail,
  userName,
}: {
  children: ReactNode;
  uid: string;
  userEmail: string;
  userName: string;
}) {
  const isPhone = usePhoneGameLayout();
  const initialPrefs = loadGridAppearancePrefs();
  const initialPresetId = normalizeGridPresetForPhone(initialPrefs.gridPresetId, isPhone);
  const preset =
    PLAYER_GRID_PRESETS.find((p) => p.id === initialPresetId) ??
    PLAYER_GRID_PRESETS.find((p) => p.id === DEFAULT_PLAYER_GRID_ID)!;
  const [gridPresetId, setGridPresetId] = useState<PlayerGridPresetId>(initialPresetId);
  const [gridColorId, setGridColorId] = useState<GridColorThemeId>(initialPrefs.colorId);
  const [gridStyleId, setGridStyleId] = useState<GridStyleThemeId>(initialPrefs.styleId);
  const [bombAnimationsEnabled, setBombAnimationsEnabledState] = useState(
    initialPrefs.bombAnimationsEnabled !== false,
  );
  const [stake, setStakeState] = useState(10);
  const [accountBalance, setAccountBalance] = useState(() => loadPlayerWallet().balance);
  const [displayBalance, setDisplayBalance] = useState(() => loadPlayerWallet().balance);
  const [balanceAnimating, setBalanceAnimating] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(() => loadPlayerWallet().totalGames);
  const [sessionHistory, setSessionHistory] = useState<PlayerSessionRecord[]>(() =>
    loadPlayerSessionHistory(uid),
  );
  const [soundMuted, setSoundMuted] = useState(isBombSoundMuted);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [cells, setCells] = useState<CellState[]>(() => emptyCells(preset.rows * preset.cols));
  const [bombIndices, setBombIndices] = useState<Set<number>>(() => new Set());
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundBalance, setRoundBalance] = useState(0);
  const [gameStake, setGameStake] = useState(0);
  const [lastMultiplier, setLastMultiplier] = useState(0);
  const [roundSettled, setRoundSettled] = useState(false);
  const [lastResult, setLastResult] = useState<ManualSessionResult | null>(null);
  const [explosionCell, setExplosionCell] = useState<number | null>(null);
  const [bombPopCell, setBombPopCell] = useState<number | null>(null);
  const [bombCascadeActive, setBombCascadeActive] = useState(false);
  const [boardEpoch, setBoardEpoch] = useState(0);
  const [chartHistory, setChartHistory] = useState<SimChartTick[]>([]);
  const [chartTimeframeId, setChartTimeframeId] = useState("1s");
  const [chartPanelMode, setChartPanelMode] = useState<ChartPanelMode>(() => loadChartPanelMode());
  const [liveCandles, setLiveCandles] = useState<SimCandle[]>([]);
  const [liveAdminCandles, setLiveAdminCandles] = useState<SimCandle[]>([]);
  const [liveMetrics, setLiveMetrics] = useState({ games: 0, userProfit: 0, adminRevenue: 0 });
  const [currentBombs, setCurrentBombs] = useState(3);
  const [houseEdge, setHouseEdge] = useState(DEFAULT_HOUSE_EDGE);
  const [bombRanges, setBombRanges] = useState<GridBombRanges>(() => defaultBombRanges());
  const [sessionTarget, setSessionTarget] = useState<number | null>(() => {
    const saved = loadPlayerTarget(uid);
    return saved?.targetBalance ?? null;
  });
  const [targetBaseline, setTargetBaseline] = useState(() => {
    const saved = loadPlayerTarget(uid);
    return saved?.baselineBalance ?? 0;
  });
  const [targetCelebration, setTargetCelebration] = useState<{
    owedAmount: number;
    targetBalance: number;
  } | null>(null);
  const [penaltyKeepFraction, setPenaltyKeepFraction] = useState<number | null>(null);
  const [roundMultiplierCap, setRoundMultiplierCap] = useState<number | null>(null);

  const chartHistoryRef = useRef<SimChartTick[]>([]);
  const accountBeforeGameRef = useRef(0);
  const balanceAnimFrameRef = useRef<number | null>(null);
  const targetHitRef = useRef(false);
  const statusRef = useRef<GameStatus>("idle");
  const revealedRef = useRef<Set<number>>(new Set());
  const activeRoundRef = useRef<ActiveRoundState | null>(null);
  const hadPenaltyThisGameRef = useRef(false);
  const hadQuickWithdrawPenaltyRef = useRef(false);
  const adaptiveStateRef = useRef<PlayerAdaptiveState>(loadPlayerAdaptiveState(uid));
  const sessionHistoryRef = useRef(sessionHistory);
  const sessionTargetRef = useRef(sessionTarget);
  const accountBalanceRef = useRef(accountBalance);
  const bombRevealPendingRef = useRef(false);
  const bombRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bombCascadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bombPopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bombRevealSoundTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bombCascadeGenRef = useRef(0);
  const bombAnimationsRef = useRef(bombAnimationsEnabled);

  const clearBombRevealSoundTimers = useCallback(() => {
    for (const t of bombRevealSoundTimersRef.current) {
      window.clearTimeout(t);
    }
    bombRevealSoundTimersRef.current = [];
    stopBombRevealTickSound();
  }, []);

  const clearBombCascadeTimers = useCallback(() => {
    if (bombCascadeTimerRef.current != null) {
      window.clearTimeout(bombCascadeTimerRef.current);
      bombCascadeTimerRef.current = null;
    }
    clearBombRevealSoundTimers();
  }, [clearBombRevealSoundTimers]);

  const gridPreset = PLAYER_GRID_PRESETS.find((p) => p.id === gridPresetId) ?? preset;
  const effectiveGrid = useMemo(
    () => resolvePlayerGridDimensions(gridPreset, isPhone),
    [gridPreset, isPhone],
  );

  const config = useMemo(
    () => basePlayerGameConfig(effectiveGrid.rows, effectiveGrid.cols, currentBombs, stake, houseEdge),
    [currentBombs, effectiveGrid.cols, effectiveGrid.rows, houseEdge, stake],
  );

  useEffect(() => {
    sessionHistoryRef.current = sessionHistory;
  }, [sessionHistory]);

  useEffect(() => {
    sessionTargetRef.current = sessionTarget;
  }, [sessionTarget]);

  useEffect(() => {
    accountBalanceRef.current = accountBalance;
  }, [accountBalance]);

  useEffect(() => {
    adaptiveStateRef.current = loadPlayerAdaptiveState(uid);
  }, [uid]);

  const reshuffleBoard = useCallback(
    (rows: number, cols: number, presetId: PlayerGridPresetId, stakeForConfig = stake): BoardSnapshot => {
      const range = resolveBombRangeForPreset(presetId, bombRanges);
      let adaptive = prepareAdaptiveGame(adaptiveStateRef.current);
      const sessionNetProfit = sessionHistoryRef.current.reduce((sum, r) => sum + r.netProfit, 0);
      const plan = planAdaptiveBoard({
        rows,
        cols,
        pctMin: range.pctMin,
        pctMax: range.pctMax,
        sessionTarget: sessionTargetRef.current,
        accountBalance: accountBalanceRef.current,
        stake: stakeForConfig,
        sessionNetProfit,
        adaptive,
      });
      adaptive = { ...adaptive, quickWithdrawMultiplierCap: plan.multiplierCap };
      adaptiveStateRef.current = adaptive;
      savePlayerAdaptiveState(uid, adaptive);

      const bombIndices = createAdaptiveBombIndices(
        rows,
        cols,
        plan.bombCount,
        plan.placementMode,
        plan.hotZone,
      );
      const gameConfig = basePlayerGameConfig(rows, cols, plan.bombCount, stakeForConfig, houseEdge);
      const total = rows * cols;

      setCurrentBombs(plan.bombCount);
      setBoardEpoch((n) => n + 1);
      setExplosionCell(null);
      setBombPopCell(null);
      stopBombRevealTickSound();
      clearBombCascadeTimers();
      if (bombRevealTimerRef.current != null) {
        window.clearTimeout(bombRevealTimerRef.current);
        bombRevealTimerRef.current = null;
      }
      if (bombPopTimerRef.current != null) {
        window.clearTimeout(bombPopTimerRef.current);
        bombPopTimerRef.current = null;
      }
      bombRevealPendingRef.current = false;
      setBombCascadeActive(false);
      setCells(emptyCells(total));
      setBombIndices(bombIndices);
      setRevealed(new Set());
      revealedRef.current = new Set();
      setSelectedIndex(null);
      setCurrentRound(0);
      setRoundBalance(0);
      setLastMultiplier(0);
      activeRoundRef.current = null;

      return {
        bombs: plan.bombCount,
        bombIndices,
        config: gameConfig,
        multiplierCap: plan.multiplierCap,
        baseHouseEdge: houseEdge,
      };
    },
    [bombRanges, clearBombCascadeTimers, houseEdge, stake, uid],
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    bombAnimationsRef.current = bombAnimationsEnabled;
  }, [bombAnimationsEnabled]);

  /** Safety net: after a loss, every cell must be bomb or safe — never left hidden. */
  useEffect(() => {
    if (status !== "lost") return;
    const total = totalCells(config.rows, config.cols);
    if (cells.length !== total) return;
    if (!cells.some((c) => c === "hidden")) return;
    setCells(Array.from({ length: total }, (_, i) => (bombIndices.has(i) ? "bomb" : "safe")));
    setRevealed(new Set(Array.from({ length: total }, (_, i) => i)));
  }, [status, cells, bombIndices, config.rows, config.cols]);

  useEffect(
    () => () => {
      if (bombRevealTimerRef.current != null) {
        window.clearTimeout(bombRevealTimerRef.current);
        bombRevealTimerRef.current = null;
      }
      if (bombCascadeTimerRef.current != null) {
        window.clearTimeout(bombCascadeTimerRef.current);
        bombCascadeTimerRef.current = null;
      }
      if (bombPopTimerRef.current != null) {
        window.clearTimeout(bombPopTimerRef.current);
        bombPopTimerRef.current = null;
      }
      stopBombRevealTickSound();
      clearBombCascadeTimers();
      bombRevealPendingRef.current = false;
    },
    [clearBombCascadeTimers],
  );

  useEffect(() => {
    preloadBombSound();
    preloadTargetApplause();
  }, []);

  useEffect(() => {
    const s = statusRef.current;
    if (s === "playing" || s === "lost" || s === "won" || s === "cashed_out") return;
    reshuffleBoard(effectiveGrid.rows, effectiveGrid.cols, gridPresetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when grid identity / uid changes, not mid-round settings
  }, [uid, effectiveGrid.cols, effectiveGrid.rows, gridPresetId]);

  useEffect(() => {
    let cancelled = false;
    const local = loadPlayerWallet();
    ensureBlockGameWallet(uid, local.balance).then((wallet) => {
      if (cancelled) return;
      setAccountBalance(wallet.balance);
      setDisplayBalance(wallet.balance);
      setGamesPlayed(wallet.totalGames);
    });

    const unsubWallet = subscribeBlockGameWallet(uid, (wallet) => {
      if (!wallet || balanceAnimating) return;
      setAccountBalance(wallet.balance);
      setDisplayBalance(wallet.balance);
      setGamesPlayed(wallet.totalGames);
    });

    const unsubChart = subscribeLiveChart((live) => {
      if (!live) return;
      chartHistoryRef.current = live.chartHistory;
      setChartHistory(live.chartHistory);
      setLiveMetrics({
        games: live.totalGames,
        userProfit: live.userProfit,
        adminRevenue: live.adminRevenue,
      });
    });

    const unsubSettings = subscribeBlockGameSettings((settings) => {
      setHouseEdge(settings.houseEdge);
      setBombRanges(settings.bombRanges);
    });

    return () => {
      cancelled = true;
      unsubWallet();
      unsubChart();
      unsubSettings();
    };
  }, [uid, balanceAnimating]);

  const fundStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!uid) return;
    return subscribeUserFundRequests(uid, (requests) => {
      for (const r of requests) {
        const prev = fundStatusRef.current.get(r.id);
        if (prev === "pending" && r.status === "approved") {
          toast.success(`Fund request approved — ${formatKes(r.amount)} added to your wallet.`);
        } else if (prev === "pending" && r.status === "rejected") {
          toast.error(`Fund request for ${formatKes(r.amount)} was rejected.`);
        }
        fundStatusRef.current.set(r.id, r.status);
      }
    });
  }, [uid]);

  const persistWallet = useCallback(
    async (balance: number, games: number, stakedDelta = 0, wonDelta = 0) => {
      const normalized = Math.max(0, Math.round(balance));
      const local = loadPlayerWallet();
      local.balance = normalized;
      local.totalGames = games;
      local.totalStaked += stakedDelta;
      local.totalWon += wonDelta;
      savePlayerWallet(local);

      await saveBlockGameWallet(uid, {
        balance: normalized,
        totalGames: games,
        totalStaked: local.totalStaked,
        totalWon: local.totalWon,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    },
    [uid],
  );

  const pushChartTick = useCallback((economics: GameEconomics, gameIndex: number) => {
    const prev = chartHistoryRef.current[chartHistoryRef.current.length - 1];
    const t = chartWallClockMs(prev);
    const tick = createChartTick(prev, economics, gameIndex, t, "manual");
    chartHistoryRef.current = [...chartHistoryRef.current, tick];
    setChartHistory(chartHistoryRef.current);
    void appendLiveChartTick(tick, "player").catch(() => {});
  }, []);

  const triggerTargetCelebration = useCallback(
    (balance: number) => {
      if (!sessionTarget || targetHitRef.current || balance < sessionTarget) return;
      targetHitRef.current = true;
      const owedAmount = targetProfitAmount(sessionTarget, targetBaseline);
      setTargetCelebration({ owedAmount, targetBalance: sessionTarget });
      playTargetApplause();
    },
    [sessionTarget, targetBaseline],
  );

  const recordCompletedGame = useCallback(
    (economics: GameEconomics, result: ManualSessionResult) => {
      const nextGames = gamesPlayed + 1;
      setGamesPlayed(nextGames);
      pushChartTick(economics, nextChartGameIndex(chartHistoryRef.current));
      void recordPlayerRound({
        uid,
        userEmail,
        userName,
        outcome: result.outcome,
        economics,
        gridRows: effectiveGrid.rows,
        gridCols: effectiveGrid.cols,
      }).catch(() => {});
      const gridLabel =
        PLAYER_GRID_PRESETS.find((p) => p.id === gridPresetId)?.label ??
        `${effectiveGrid.cols}×${effectiveGrid.rows}`;
      const total = totalCells(effectiveGrid.rows, effectiveGrid.cols);
      const sessionRecord: PlayerSessionRecord = {
        id: `${Date.now()}-${nextGames}`,
        gameIndex: nextGames,
        outcome: result.outcome,
        stake: result.gameStake,
        payout: result.payout,
        netProfit: result.netProfit,
        endingBalance: result.endingAccountBalance,
        round: result.round,
        multiplier: result.multiplier,
        gridLabel,
        playedAt: new Date().toISOString(),
        bombCount: currentBombs,
        totalCells: total,
        houseEdge: config.houseEdge,
        bombIndices: Array.from(bombIndices),
      };
      setSessionHistory((prev) => appendPlayerSessionRecord(uid, sessionRecord, prev));
      onPlayerRoundComplete(uid, result.outcome, result.round, hadPenaltyThisGameRef.current);
      adaptiveStateRef.current = onAdaptiveRoundComplete(
        uid,
        result.outcome,
        result.round,
        adaptiveStateRef.current,
        hadQuickWithdrawPenaltyRef.current,
      );
      hadPenaltyThisGameRef.current = false;
      hadQuickWithdrawPenaltyRef.current = false;
      setPenaltyKeepFraction(null);
      setRoundMultiplierCap(null);
      persistWallet(result.endingAccountBalance, nextGames, economics.userStake, economics.userPayout);
      setLastResult(result);
      setRoundSettled(true);
      setGameStake(0);
    },
    [
      bombIndices,
      config.houseEdge,
      currentBombs,
      gamesPlayed,
      effectiveGrid.cols,
      effectiveGrid.rows,
      gridPresetId,
      persistWallet,
      pushChartTick,
      uid,
      userEmail,
      userName,
    ],
  );

  const animateBalanceTo = useCallback((from: number, to: number) => {
    if (balanceAnimFrameRef.current != null) cancelAnimationFrame(balanceAnimFrameRef.current);
    setBalanceAnimating(true);
    setDisplayBalance(from);
    const duration = 1200;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayBalance(from + (to - from) * eased);
      if (t < 1) {
        balanceAnimFrameRef.current = requestAnimationFrame(tick);
      } else {
        const normalized = Math.max(0, Math.round(to));
        setDisplayBalance(normalized);
        setAccountBalance(normalized);
        setBalanceAnimating(false);
        balanceAnimFrameRef.current = null;
        triggerTargetCelebration(normalized);
      }
    };
    balanceAnimFrameRef.current = requestAnimationFrame(tick);
  }, [triggerTargetCelebration]);

  useEffect(() => {
    if (!balanceAnimating) setDisplayBalance(accountBalance);
  }, [accountBalance, balanceAnimating]);

  const revealAllCells = useCallback((bombs: Set<number>, total: number) => {
    setCells(Array.from({ length: total }, (_, i) => (bombs.has(i) ? "bomb" : "safe")));
    setRevealed(new Set(Array.from({ length: total }, (_, i) => i)));
  }, []);

  const flashBombPop = useCallback((index: number) => {
    setBombPopCell(index);
    if (bombPopTimerRef.current != null) window.clearTimeout(bombPopTimerRef.current);
    bombPopTimerRef.current = window.setTimeout(() => {
      bombPopTimerRef.current = null;
      setBombPopCell((cur) => (cur === index ? null : cur));
    }, 130);
  }, []);

  const revealRemainingAfterBombHit = useCallback(
    (
      hitIndex: number,
      bombs: Set<number>,
      total: number,
      animated: boolean,
      cascadeGen: number,
      onComplete: () => void,
    ) => {
      const otherBombs = Array.from(bombs).filter((i) => i !== hitIndex);
      const isStale = () => bombCascadeGenRef.current !== cascadeGen;
      let finalized = false;

      const finalizeBoard = () => {
        if (finalized || isStale()) return;
        finalized = true;
        if (bombCascadeTimerRef.current != null) {
          window.clearTimeout(bombCascadeTimerRef.current);
          bombCascadeTimerRef.current = null;
        }
        clearBombRevealSoundTimers();
        revealAllCells(bombs, total);
        setExplosionCell(null);
        setBombPopCell(null);
        stopBombRevealTickSound();
        onComplete();
      };

      if (!animated) {
        finalizeBoard();
        return;
      }

      if (otherBombs.length === 0) {
        finalizeBoard();
        return;
      }

      const interval = bombStaggerIntervalMs(otherBombs.length, total);
      const batchSize = bombsPerStaggerStep(otherBombs.length, total);
      let step = 0;

      const revealNextBomb = () => {
        if (finalized || isStale()) return;
        if (step >= otherBombs.length) {
          finalizeBoard();
          return;
        }
        const end = Math.min(step + batchSize, otherBombs.length);
        for (let s = step; s < end; s++) {
          revealedRef.current.add(otherBombs[s]!);
        }
        setCells((prev) => {
          const next = [...prev];
          for (let s = step; s < end; s++) {
            next[otherBombs[s]!] = "bomb";
          }
          return next;
        });
        setRevealed((prev) => {
          const next = new Set(prev);
          for (let s = step; s < end; s++) next.add(otherBombs[s]!);
          return next;
        });
        for (let s = step; s < end; s++) {
          const idx = otherBombs[s]!;
          const soundDelay = (s - step) * Math.max(8, Math.floor(interval * 0.45));
          const timer = window.setTimeout(() => {
            if (finalized || isStale()) return;
            flashBombPop(idx);
            playBombRevealTickSound(interval);
          }, soundDelay);
          bombRevealSoundTimersRef.current.push(timer);
        }
        step = end;
        bombCascadeTimerRef.current = window.setTimeout(revealNextBomb, interval);
      };

      revealNextBomb();

      const safetyMs = Math.min(1200, 280 + otherBombs.length * 45);
      const safetyTimer = window.setTimeout(() => finalizeBoard(), safetyMs);
      bombRevealSoundTimersRef.current.push(safetyTimer);
    },
    [flashBombPop, revealAllCells, clearBombRevealSoundTimers],
  );

  const revealCell = useCallback((index: number, isBomb: boolean) => {
    revealedRef.current.add(index);
    setCells((prev) => {
      const next = [...prev];
      next[index] = isBomb ? "bomb" : "safe";
      return next;
    });
    setRevealed((prev) => new Set(prev).add(index));
    setSelectedIndex(index);
  }, []);

  const settleRound = useCallback(
    (
      outcome: ManualSessionResult["outcome"],
      payout: number,
      round: number,
      multiplier: number,
      gameStatus: GameStatus,
    ) => {
      const active = activeRoundRef.current;
      const stakeForRound = active?.gameStake ?? gameStake;
      const economics = finalizeManualGameEconomics(stakeForRound, payout);
      const ending = accountBalance + payout;
      setLastMultiplier(multiplier);
      setRoundBalance(payout);
      setStatus(gameStatus);
      activeRoundRef.current = null;
      const result: ManualSessionResult = {
        outcome,
        startingAccountBalance: accountBeforeGameRef.current,
        endingAccountBalance: ending,
        gameStake: stakeForRound,
        payout,
        netProfit: ending - accountBeforeGameRef.current,
        round,
        multiplier,
      };
      recordCompletedGame(economics, result);
      animateBalanceTo(accountBalance, ending);
    },
    [accountBalance, animateBalanceTo, gameStake, recordCompletedGame],
  );

  const startNewGame = useCallback((): boolean => {
      if (status === "playing" || balanceAnimating) return false;
      const s = Math.min(MAX_STAKE_KES, Math.max(MIN_STAKE_KES, stake));
      if (accountBalance < s) return false;

      unlockGameAudio();
      setTargetCelebration(null);

      setRoundSettled(false);
      setLastResult(null);
      accountBeforeGameRef.current = accountBalance;
      setAccountBalance((b) => b - s);
      setDisplayBalance((b) => b - s);
      setGameStake(s);
      const board = reshuffleBoard(effectiveGrid.rows, effectiveGrid.cols, gridPresetId, s);
      const { keepFraction } = preparePenaltyForNewGame(uid);
      hadPenaltyThisGameRef.current = keepFraction != null;
      hadQuickWithdrawPenaltyRef.current =
        adaptiveStateRef.current.quickWithdrawPenaltyGamesLeft > 0;
      setPenaltyKeepFraction(keepFraction);
      setRoundMultiplierCap(board.multiplierCap);
      activeRoundRef.current = {
        config: board.config,
        bombIndices: board.bombIndices,
        gameStake: s,
        currentRound: 0,
        penaltyKeepFraction: keepFraction,
        baseHouseEdge: board.baseHouseEdge,
        multiplierCap: board.multiplierCap,
      };
      setStatus("playing");
      return true;
    },
    [accountBalance, balanceAnimating, effectiveGrid.cols, effectiveGrid.rows, gridPresetId, reshuffleBoard, stake, status, uid],
  );

  const playAgain = useCallback((): boolean => {
    if (status === "playing") return false;
    setStatus("idle");
    return startNewGame();
  }, [startNewGame, status]);

  const resetAfterRound = useCallback(() => {
    if (balanceAnimating) return;
    const roundEnded =
      roundSettled || status === "lost" || status === "won" || status === "cashed_out";
    if (!roundEnded && !targetCelebration) return;

    setTargetCelebration(null);
    setRoundSettled(false);
    setLastResult(null);
    setExplosionCell(null);
    reshuffleBoard(effectiveGrid.rows, effectiveGrid.cols, gridPresetId);
    setStatus("idle");
  }, [
    balanceAnimating,
    effectiveGrid.cols,
    effectiveGrid.rows,
    reshuffleBoard,
    roundSettled,
    status,
    targetCelebration,
  ]);

  const setPlayerTarget = useCallback(
    (targetBalance: number): boolean => {
      if (!isValidTargetBalance(accountBalance, targetBalance)) return false;
      setSessionTarget(targetBalance);
      setTargetBaseline(accountBalance);
      targetHitRef.current = false;
      setTargetCelebration(null);
      savePlayerTarget({
        uid,
        targetBalance,
        baselineBalance: accountBalance,
        setAt: new Date().toISOString(),
      });
      return true;
    },
    [accountBalance, uid],
  );

  const clearPlayerTarget = useCallback(() => {
    setSessionTarget(null);
    setTargetBaseline(0);
    targetHitRef.current = false;
    setTargetCelebration(null);
    clearPlayerTargetStorage();
  }, []);

  const dismissTargetCelebration = useCallback(() => {
    setTargetCelebration(null);
    clearPlayerTarget();
  }, [clearPlayerTarget]);

  useEffect(() => {
    if (targetHitRef.current || !sessionTarget || balanceAnimating) return;
    if (status === "playing" && currentRound <= 0) return;
    if (status === "playing") {
      const active = activeRoundRef.current;
      const potential = active
        ? accountBalance +
          adaptivePlayerPayout(
            active.config,
            active.currentRound,
            active.gameStake,
            roundMultOptions(active),
          )
        : accountBalance +
          adaptivePlayerPayout(config, currentRound, gameStake, {
            baseHouseEdge: houseEdge,
            penaltyKeepFraction,
            multiplierCap: roundMultiplierCap,
          });
      if (potential < sessionTarget) return;
    } else if (displayBalance < sessionTarget) {
      return;
    }
    const active = activeRoundRef.current;
    const bal =
      status === "playing" && active
        ? accountBalance +
          adaptivePlayerPayout(
            active.config,
            active.currentRound,
            active.gameStake,
            roundMultOptions(active),
          )
        : displayBalance;
    triggerTargetCelebration(bal);
  }, [
    accountBalance,
    balanceAnimating,
    config,
    currentRound,
    displayBalance,
    gameStake,
    sessionTarget,
    status,
    penaltyKeepFraction,
    roundMultiplierCap,
    triggerTargetCelebration,
  ]);

  const cashOut = useCallback(() => {
    const active = activeRoundRef.current;
    if (!active || status !== "playing" || active.currentRound <= 0) return;
    const total = totalCells(active.config.rows, active.config.cols);
    revealAllCells(active.bombIndices, total);
    const payout = adaptivePlayerPayout(
      active.config,
      active.currentRound,
      active.gameStake,
      roundMultOptions(active),
    );
    const mult = active.gameStake > 0 ? payout / active.gameStake : 0;
    settleRound("cashed_out", payout, active.currentRound, mult, "cashed_out");
  }, [revealAllCells, settleRound, status]);

  const clickCell = useCallback(
    (index: number) => {
      const active = activeRoundRef.current;
      if (!active || statusRef.current !== "playing" || bombRevealPendingRef.current) return;
      if (revealedRef.current.has(index)) return;

      unlockGameAudio();

      adaptiveStateRef.current = recordAdaptivePick(adaptiveStateRef.current, index);
      savePlayerAdaptiveState(uid, adaptiveStateRef.current);

      const outcome = applyManualPick(
        active.config,
        active.bombIndices,
        index,
        active.currentRound,
        active.gameStake,
      );

      let multiplier = outcome.multiplier;
      let balanceAfter = outcome.balanceAfter;
      if (!outcome.isBomb) {
        multiplier = calculateAdaptivePlayerMultiplier(
          active.config,
          outcome.round,
          roundMultOptions(active),
        );
        balanceAfter = active.gameStake * multiplier;
      }

      if (outcome.isBomb) {
        const total = totalCells(active.config.rows, active.config.cols);
        const bombs = active.bombIndices;
        const stakeForRound = active.gameStake;
        const economics = outcome.economics;
        const animated = bombAnimationsRef.current;

        bombRevealPendingRef.current = true;
        setBombCascadeActive(true);
        bombCascadeGenRef.current += 1;
        const cascadeGen = bombCascadeGenRef.current;
        clearBombCascadeTimers();
        revealCell(index, true);
        playBombExplosionSound();
        if (animated) {
          flashBombPop(index);
          setExplosionCell(index);
        }
        setRoundBalance(0);
        setLastMultiplier(0);

        const finishBombRound = () => {
          bombRevealPendingRef.current = false;
          setBombCascadeActive(false);
          setStatus("lost");
          activeRoundRef.current = null;
          const result: ManualSessionResult = {
            outcome: "lost",
            startingAccountBalance: accountBeforeGameRef.current,
            endingAccountBalance: accountBalance,
            gameStake: stakeForRound,
            payout: 0,
            netProfit: accountBalance - accountBeforeGameRef.current,
            round: outcome.round,
            multiplier: 0,
          };
          recordCompletedGame(economics, result);
        };

        const runReveal = () => {
          revealRemainingAfterBombHit(index, bombs, total, animated, cascadeGen, finishBombRound);
        };

        const delay = bombHitEffectsDelayMs(animated, total);
        if (delay <= 0) {
          runReveal();
        } else {
          bombRevealTimerRef.current = window.setTimeout(() => {
            bombRevealTimerRef.current = null;
            runReveal();
          }, delay);
        }
        return;
      }

      revealCell(index, false);
      playSafeRevealSound();
      active.currentRound = outcome.round;
      setCurrentRound(outcome.round);
      setRoundBalance(balanceAfter);
      setLastMultiplier(multiplier);

      const total = totalCells(active.config.rows, active.config.cols);
      const maxSafeRounds = total - active.config.bombs;
      if (outcome.round >= maxSafeRounds) {
        settleRound("won", balanceAfter, outcome.round, multiplier, "won");
      }
    },
    [accountBalance, recordCompletedGame, revealCell, revealRemainingAfterBombHit, flashBombPop, settleRound, uid],
  );

  const setGridPreset = useCallback(
    (id: PlayerGridPresetId) => {
      if (status === "playing") return;
      setGridPresetId(id);
      const p = PLAYER_GRID_PRESETS.find((g) => g.id === id)!;
      const { rows, cols } = resolvePlayerGridDimensions(p, isPhone);
      reshuffleBoard(rows, cols, id);
      setStatus("idle");
      setRoundSettled(false);
    },
    [isPhone, reshuffleBoard, status],
  );

  const setGridColorTheme = useCallback((id: GridColorThemeId) => {
    if (status === "playing") return;
    setGridColorId(id);
  }, [status]);

  const setGridStyleTheme = useCallback((id: GridStyleThemeId) => {
    if (status === "playing") return;
    setGridStyleId(id);
  }, [status]);

  useEffect(() => {
    if (status === "playing") return;
    const next = normalizeGridPresetForPhone(gridPresetId, isPhone);
    if (next === gridPresetId) return;
    setGridPresetId(next);
    const p = PLAYER_GRID_PRESETS.find((g) => g.id === next)!;
    const { rows, cols } = resolvePlayerGridDimensions(p, isPhone);
    reshuffleBoard(rows, cols, next);
    setStatus("idle");
    setRoundSettled(false);
  }, [gridPresetId, isPhone, reshuffleBoard, status]);

  useEffect(() => {
    saveGridAppearancePrefs({
      gridPresetId,
      colorId: gridColorId,
      styleId: gridStyleId,
      bombAnimationsEnabled,
    });
  }, [gridColorId, gridPresetId, gridStyleId, bombAnimationsEnabled]);

  useEffect(() => {
    saveChartPanelMode(chartPanelMode);
  }, [chartPanelMode]);

  const showChartPanel = useCallback(() => setChartPanelMode("minimized"), []);
  const expandChartPanel = useCallback(() => setChartPanelMode("open"), []);
  const minimizeChartPanel = useCallback(() => setChartPanelMode("minimized"), []);
  const hideChartPanel = useCallback(() => setChartPanelMode("hidden"), []);

  const setStake = useCallback(
    (amount: number) => {
      if (status === "playing") return;
      setStakeState(Math.min(MAX_STAKE_KES, Math.max(MIN_STAKE_KES, amount)));
    },
    [status],
  );

  const setBombAnimationsEnabled = useCallback((enabled: boolean) => {
    setBombAnimationsEnabledState(enabled);
    bombAnimationsRef.current = enabled;
  }, []);

  const toggleSoundMuted = useCallback(() => {
    setSoundMuted((m) => {
      const next = !m;
      setBombSoundMuted(next);
      if (!next) unlockGameAudio();
      return next;
    });
  }, []);

  const requestFund = useCallback(
    (amount: number) => {
      const record: FundRequestRecord = {
        id: `fr_${Date.now().toString(36)}`,
        deviceId: uid,
        amount: Math.max(1, Math.round(amount)),
        status: "pending",
        requestedAt: new Date().toISOString(),
      };
      void createBlockGameFundRequest({
        uid,
        userEmail,
        userName,
        amount: record.amount,
      }).catch(() => {});
      return record;
    },
    [uid, userEmail, userName],
  );

  const chartTimeframeMs = useMemo(() => {
    const found = CHART_TIMEFRAMES.find((t) => t.id === chartTimeframeId);
    return found?.ms ?? CHART_TIMEFRAMES[0]!.ms;
  }, [chartTimeframeId]);

  useEffect(() => {
    setLiveCandles(buildTimeCandles(chartHistory, chartTimeframeMs, "user"));
    setLiveAdminCandles(buildTimeCandles(chartHistory, chartTimeframeMs, "admin"));
  }, [chartHistory, chartTimeframeMs]);

  const chartTimeframes = useMemo(() => {
    if (chartHistory.length < 1) return [CHART_TIMEFRAMES[0]!];
    return CHART_TIMEFRAMES.filter((tf) => tf.ms <= Math.max(chartHistory[chartHistory.length - 1]!.t - chartHistory[0]!.t, 1));
  }, [chartHistory]);

  const openChartInNewTab = useCallback(() => {
    openSimChartPageInNewTab();
  }, []);

  const canCashOut = status === "playing" && currentRound > 0;
  const canStartGame =
    status !== "playing" && !balanceAnimating && !roundSettled && accountBalance >= stake;
  const canPlayAgain =
    status !== "playing" && !balanceAnimating && roundSettled && accountBalance >= stake;
  const canResetAfterRound =
    !balanceAnimating &&
    (roundSettled ||
      status === "lost" ||
      status === "won" ||
      status === "cashed_out" ||
      targetCelebration != null);

  const value: BlockGamePlayerState = {
    config,
    gridPresetId,
    gridColorId,
    gridStyleId,
    cells,
    status,
    selectedIndex,
    currentRound,
    roundBalance,
    lastMultiplier,
    roundSettled,
    lastResult,
    accountBalance,
    displayBalance,
    balanceAnimating,
    stake,
    soundMuted,
    gamesPlayed,
    sessionHistory,
    chartHistory,
    liveCandles,
    liveAdminCandles,
    chartTimeframeId,
    chartTimeframes,
    chartPanelMode,
    liveMetrics,
    explosionCell,
    bombPopCell,
    bombAnimationsEnabled,
    bombCascadeActive,
    boardEpoch,
    canCashOut,
    canStartGame,
    canPlayAgain,
    canResetAfterRound,
    sessionTarget,
    targetCelebration,
    penaltyKeepFraction,
    roundMultiplierCap,
    formatKes,
    setGridPreset,
    setGridColorTheme,
    setGridStyleTheme,
    setStake,
    toggleSoundMuted,
    setBombAnimationsEnabled,
    startNewGame,
    resetAfterRound,
    playAgain,
    setPlayerTarget,
    clearPlayerTarget,
    cashOut,
    clickCell,
    requestFund,
    dismissTargetCelebration,
    openChartInNewTab,
    setChartTimeframe: setChartTimeframeId,
    showChartPanel,
    expandChartPanel,
    minimizeChartPanel,
    hideChartPanel,
  };

  return <BlockGamePlayerContext.Provider value={value}>{children}</BlockGamePlayerContext.Provider>;
}

export function useBlockGamePlayer() {
  const ctx = useContext(BlockGamePlayerContext);
  if (!ctx) throw new Error("useBlockGamePlayer must be used within BlockGamePlayerProvider");
  return ctx;
}

/** Current multiplier if player cashed out now (for UI). Applies adaptive house edge + penalties. */
export function useNextMultiplier(config: GameConfig, round: number): number {
  const ctx = useBlockGamePlayer();
  if (round <= 0) return 0;
  return calculateAdaptivePlayerMultiplier(config, round, {
    baseHouseEdge: config.houseEdge,
    penaltyKeepFraction: ctx?.penaltyKeepFraction ?? null,
    multiplierCap: ctx?.roundMultiplierCap ?? null,
  });
}

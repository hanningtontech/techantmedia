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
import { bombFullGridRevealDelayMs } from "@/lib/game/bombRevealTiming";
import {
  loadPlayerWallet,
  savePlayerWallet,
  type FundRequestRecord,
} from "@/lib/game/playerStorage";
import { resolveBombRangeForPreset, type GridBombRanges, defaultBombRanges } from "@/lib/game/bombRangeSettings";
import {
  onPlayerRoundComplete,
  playerCalculateMultiplier,
  playerCashOutPayout,
  preparePenaltyForNewGame,
} from "@/lib/game/earlyCashOutPenalty";
import { randomBombCountForGrid } from "@/lib/game/randomBombs";
import {
  applyManualPick,
  createBombIndices,
  finalizeManualGameEconomics,
} from "@/lib/simulation/engine";
import { isBombSoundMuted, playBombExplosionSound, playSafeRevealSound, preloadBombSound, setBombSoundMuted, unlockGameAudio } from "@/lib/simulation/bombEffects";
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
  startNewGame: () => boolean;
  resetAfterRound: () => void;
  setPlayerTarget: (targetBalance: number) => boolean;
  clearPlayerTarget: () => void;
  cashOut: () => void;
  penaltyKeepFraction: number | null;
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
}

interface BoardSnapshot {
  bombs: number;
  bombIndices: Set<number>;
  config: GameConfig;
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

  const chartHistoryRef = useRef<SimChartTick[]>([]);
  const accountBeforeGameRef = useRef(0);
  const balanceAnimFrameRef = useRef<number | null>(null);
  const targetHitRef = useRef(false);
  const statusRef = useRef<GameStatus>("idle");
  const revealedRef = useRef<Set<number>>(new Set());
  const activeRoundRef = useRef<ActiveRoundState | null>(null);
  const hadPenaltyThisGameRef = useRef(false);
  const bombRevealPendingRef = useRef(false);
  const bombRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gridPreset = PLAYER_GRID_PRESETS.find((p) => p.id === gridPresetId) ?? preset;
  const effectiveGrid = useMemo(
    () => resolvePlayerGridDimensions(gridPreset, isPhone),
    [gridPreset, isPhone],
  );

  const config = useMemo(
    () => basePlayerGameConfig(effectiveGrid.rows, effectiveGrid.cols, currentBombs, stake, houseEdge),
    [currentBombs, effectiveGrid.cols, effectiveGrid.rows, houseEdge, stake],
  );

  const reshuffleBoard = useCallback(
    (rows: number, cols: number, presetId: PlayerGridPresetId, stakeForConfig = stake): BoardSnapshot => {
      const range = resolveBombRangeForPreset(presetId, bombRanges);
      const bombs = randomBombCountForGrid(rows, cols, range.pctMin, range.pctMax);
      const total = rows * cols;
      const bombIndices = createBombIndices(total, bombs);
      const gameConfig = basePlayerGameConfig(rows, cols, bombs, stakeForConfig, houseEdge);

      setCurrentBombs(bombs);
      setBoardEpoch((n) => n + 1);
      setExplosionCell(null);
      if (bombRevealTimerRef.current != null) {
        window.clearTimeout(bombRevealTimerRef.current);
        bombRevealTimerRef.current = null;
      }
      bombRevealPendingRef.current = false;
      setCells(emptyCells(total));
      setBombIndices(bombIndices);
      setRevealed(new Set());
      revealedRef.current = new Set();
      setSelectedIndex(null);
      setCurrentRound(0);
      setRoundBalance(0);
      setLastMultiplier(0);
      activeRoundRef.current = null;

      return { bombs, bombIndices, config: gameConfig };
    },
    [bombRanges, houseEdge, stake],
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(
    () => () => {
      if (bombRevealTimerRef.current != null) {
        window.clearTimeout(bombRevealTimerRef.current);
        bombRevealTimerRef.current = null;
      }
      bombRevealPendingRef.current = false;
    },
    [],
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
      hadPenaltyThisGameRef.current = false;
      setPenaltyKeepFraction(null);
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
      setPenaltyKeepFraction(keepFraction);
      activeRoundRef.current = {
        config: board.config,
        bombIndices: board.bombIndices,
        gameStake: s,
        currentRound: 0,
        penaltyKeepFraction: keepFraction,
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
          playerCashOutPayout(
            active.config,
            active.currentRound,
            active.gameStake,
            active.penaltyKeepFraction,
          )
        : accountBalance +
          playerCashOutPayout(config, currentRound, gameStake, penaltyKeepFraction);
      if (potential < sessionTarget) return;
    } else if (displayBalance < sessionTarget) {
      return;
    }
    const active = activeRoundRef.current;
    const bal =
      status === "playing" && active
        ? accountBalance +
          playerCashOutPayout(
            active.config,
            active.currentRound,
            active.gameStake,
            active.penaltyKeepFraction,
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
    triggerTargetCelebration,
  ]);

  const cashOut = useCallback(() => {
    const active = activeRoundRef.current;
    if (!active || status !== "playing" || active.currentRound <= 0) return;
    const total = totalCells(active.config.rows, active.config.cols);
    revealAllCells(active.bombIndices, total);
    const payout = playerCashOutPayout(
      active.config,
      active.currentRound,
      active.gameStake,
      active.penaltyKeepFraction,
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

      const outcome = applyManualPick(
        active.config,
        active.bombIndices,
        index,
        active.currentRound,
        active.gameStake,
      );

      let multiplier = outcome.multiplier;
      let balanceAfter = outcome.balanceAfter;
      if (!outcome.isBomb && active.penaltyKeepFraction != null) {
        multiplier = playerCalculateMultiplier(
          active.config,
          outcome.round,
          active.penaltyKeepFraction,
        );
        balanceAfter = active.gameStake * multiplier;
      }

      if (outcome.isBomb) {
        const total = totalCells(active.config.rows, active.config.cols);
        const bombs = active.bombIndices;
        const stakeForRound = active.gameStake;
        const economics = outcome.economics;

        bombRevealPendingRef.current = true;
        revealCell(index, true);
        playBombExplosionSound();
        setExplosionCell(index);
        setRoundBalance(0);
        setLastMultiplier(0);

        const finishBombRound = () => {
          bombRevealTimerRef.current = null;
          revealAllCells(bombs, total);
          setStatus("lost");
          activeRoundRef.current = null;
          bombRevealPendingRef.current = false;
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

        const delay = bombFullGridRevealDelayMs();
        requestAnimationFrame(() => {
          bombRevealTimerRef.current = window.setTimeout(finishBombRound, delay);
        });
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
    [accountBalance, recordCompletedGame, revealAllCells, revealCell, settleRound],
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
    saveGridAppearancePrefs({ gridPresetId, colorId: gridColorId, styleId: gridStyleId });
  }, [gridColorId, gridPresetId, gridStyleId]);

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
    boardEpoch,
    canCashOut,
    canStartGame,
    canPlayAgain,
    canResetAfterRound,
    sessionTarget,
    targetCelebration,
    penaltyKeepFraction,
    formatKes,
    setGridPreset,
    setGridColorTheme,
    setGridStyleTheme,
    setStake,
    toggleSoundMuted,
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

/** Current multiplier if player cashed out now (for UI). Applies live early-cash-out penalty when active. */
export function useNextMultiplier(config: GameConfig, round: number): number {
  const ctx = useBlockGamePlayer();
  if (round <= 0) return 0;
  return playerCalculateMultiplier(config, round, ctx?.penaltyKeepFraction ?? null);
}

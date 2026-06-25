import type { SimCandle } from "./candleSeries";

export interface SimChartTick {
  t: number;
  gameIndex: number;
  userCumulative: number;
  adminCumulative: number;
  userDelta: number;
  adminDelta: number;
  volume: number;
  source: "manual" | "auto";
}

export interface ChartTimeframe {
  id: string;
  label: string;
  ms: number;
}

export const CHART_TIMEFRAMES: ChartTimeframe[] = [
  { id: "1s", label: "1s", ms: 1_000 },
  { id: "5s", label: "5s", ms: 5_000 },
  { id: "15s", label: "15s", ms: 15_000 },
  { id: "1m", label: "1m", ms: 60_000 },
  { id: "5m", label: "5m", ms: 300_000 },
  { id: "15m", label: "15m", ms: 900_000 },
  { id: "1h", label: "1H", ms: 3_600_000 },
  { id: "4h", label: "4H", ms: 14_400_000 },
  { id: "1d", label: "1D", ms: 86_400_000 },
  { id: "1w", label: "1W", ms: 604_800_000 },
  { id: "1mo", label: "1M", ms: 2_592_000_000 },
  { id: "1y", label: "1Y", ms: 31_536_000_000 },
];

const MAX_CANDLES = 500;

export function chartDataSpanMs(ticks: SimChartTick[]): number {
  if (ticks.length < 2) return 0;
  return ticks[ticks.length - 1]!.t - ticks[0]!.t;
}

/** Timeframes up to the data span (1s … days/weeks/months/year as span allows). */
export function availableTimeframes(ticks: SimChartTick[]): ChartTimeframe[] {
  if (ticks.length < 1) return [CHART_TIMEFRAMES[0]!];

  const span = Math.max(chartDataSpanMs(ticks), 1);
  return CHART_TIMEFRAMES.filter((tf) => tf.ms <= span);
}

export function pickDefaultTimeframeId(ticks: SimChartTick[]): string {
  const avail = availableTimeframes(ticks);
  if (avail.length === 0) return "1s";

  const span = Math.max(chartDataSpanMs(ticks), 1);
  let best = avail[0]!;
  let bestScore = Infinity;

  for (const tf of avail) {
    const buckets = Math.ceil(span / tf.ms);
    if (buckets > MAX_CANDLES) continue;
    const score = Math.abs(buckets - 48);
    if (score < bestScore) {
      bestScore = score;
      best = tf;
    }
  }
  return best.id;
}

/** Browser / PC local timezone (e.g. Africa/Nairobi). */
export function chartLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function formatTimeAxisLabel(ts: number, timeframeMs: number, timeZone = chartLocalTimeZone()): string {
  const d = new Date(ts);
  const loc = { timeZone } as const;
  if (timeframeMs >= 86_400_000 * 28) {
    return d.toLocaleDateString(undefined, { ...loc, month: "short", year: "2-digit" });
  }
  if (timeframeMs >= 86_400_000) {
    return d.toLocaleDateString(undefined, { ...loc, month: "short", day: "numeric" });
  }
  if (timeframeMs >= 3_600_000) {
    return d.toLocaleString(undefined, { ...loc, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (timeframeMs >= 60_000) {
    return d.toLocaleTimeString(undefined, { ...loc, hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleTimeString(undefined, { ...loc, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Wall-clock ms for the latest candle slot in live center-anchored charts. */
export function liveChartCenterTimeMs(
  lastCandle?: { timeEnd?: number; timeStart?: number },
  atMs = Date.now(),
): number {
  if (!lastCandle) return atMs;
  const end = lastCandle.timeEnd ?? lastCandle.timeStart;
  if (end == null) return atMs;
  // If data is fresh, anchor axis to wall clock; otherwise follow the latest candle bucket.
  return atMs - end < 120_000 ? atMs : end;
}

/** Time at a viewport slot when the latest candle sits at the center slot. */
export function liveChartTimeAtSlot(
  slot: number,
  visibleCount: number,
  timeframeMs: number,
  centerTimeMs = Date.now(),
): number {
  const centerSlot = Math.floor(visibleCount / 2);
  return centerTimeMs + (slot - centerSlot) * timeframeMs;
}

/** Wall-clock tick time — monotonic, uses PC local epoch ms. */
export function chartWallClockMs(prev?: SimChartTick): number {
  const now = Date.now();
  if (prev == null) return now;
  return Math.max(now, prev.t + 1);
}

/** Next monotonic game index when appending to the shared live chart. */
export function nextChartGameIndex(history: SimChartTick[]): number {
  const last = history[history.length - 1];
  return (last?.gameIndex ?? 0) + 1;
}

/**
 * Merge remote (Firestore) ticks into local — remote is canonical when ahead.
 * Keeps one continuous timeline for simulation + live chart + real players.
 */
export function mergeLiveChartTicks(local: SimChartTick[], remote: SimChartTick[]): SimChartTick[] {
  if (remote.length === 0) return local;
  if (local.length === 0) return remote;

  const localLast = local[local.length - 1]!;
  const remoteLast = remote[remote.length - 1]!;

  if (remoteLast.gameIndex > localLast.gameIndex) {
    if (local.length <= remote.length) {
      let prefix = true;
      for (let i = 0; i < local.length; i++) {
        if (local[i]!.gameIndex !== remote[i]!.gameIndex) {
          prefix = false;
          break;
        }
      }
      if (prefix) return remote;
    }
    const seen = new Set(local.map((t) => t.gameIndex));
    const extra = remote.filter((t) => !seen.has(t.gameIndex));
    return extra.length > 0 ? [...local, ...extra] : remote;
  }

  if (localLast.gameIndex > remoteLast.gameIndex) return local;
  return remote.length >= local.length ? remote : local;
}

export type ChartValueField = "user" | "admin";

function fieldValue(tick: SimChartTick, field: ChartValueField): number {
  return field === "user" ? tick.userCumulative : tick.adminCumulative;
}

export function buildTimeCandles(
  ticks: SimChartTick[],
  timeframeMs: number,
  field: ChartValueField,
): SimCandle[] {
  if (ticks.length === 0) return [];

  const buckets = new Map<number, SimChartTick[]>();

  for (const tick of ticks) {
    const key = Math.floor(tick.t / timeframeMs);
    const list = buckets.get(key) ?? [];
    list.push(tick);
    buckets.set(key, list);
  }

  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const candles: SimCandle[] = [];
  let prevClose = 0;

  for (const key of keys) {
    const pts = buckets.get(key)!;
    const bucketStart = key * timeframeMs;
    const bucketEnd = bucketStart + timeframeMs;

    const open = candles.length === 0 ? 0 : prevClose;
    let high = open;
    let low = open;
    for (const p of pts) {
      const v = fieldValue(p, field);
      const delta = field === "user" ? p.userDelta : p.adminDelta;
      const before = v - delta;
      high = Math.max(high, v, before);
      low = Math.min(low, v, before);
    }
    const close = fieldValue(pts[pts.length - 1]!, field);
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);

    const volume = pts.reduce((s, p) => s + p.volume, 0);
    const partial = pts[pts.length - 1]!.t < bucketEnd - 1;

    candles.push({
      id: candles.length,
      label: formatTimeAxisLabel(bucketStart, timeframeMs) + (partial ? "*" : ""),
      open,
      high,
      low,
      close,
      gameStart: pts[0]!.gameIndex,
      gameEnd: pts[pts.length - 1]!.gameIndex,
      volume,
      bullish: close >= open,
      timeStart: bucketStart,
      timeEnd: bucketEnd,
    });
    prevClose = close;
  }

  return candles;
}

export function createChartTick(
  prev: SimChartTick | undefined,
  economics: { userProfit: number; adminRevenue: number; userStake: number },
  gameIndex: number,
  t: number,
  source: "manual" | "auto",
): SimChartTick {
  const userCumulative = (prev?.userCumulative ?? 0) + economics.userProfit;
  const adminCumulative = (prev?.adminCumulative ?? 0) + economics.adminRevenue;
  return {
    t,
    gameIndex,
    userCumulative,
    adminCumulative,
    userDelta: economics.userProfit,
    adminDelta: economics.adminRevenue,
    volume: economics.userStake,
    source,
  };
}

/** Simulated clock step when many games run faster than wall clock. */
export function chartTimeStep(speedMs: number, batch = false): number {
  if (speedMs > 0) return speedMs;
  return batch ? 25 : 1;
}

export interface CandlePeriodStats {
  gamesPlayed: number;
  gameStart: number;
  gameEnd: number;
  manualGames: number;
  autoGames: number;
  periodUserNet: number;
  periodAdminNet: number;
  totalVolume: number;
  userWins: number;
  userLosses: number;
  userBreakEven: number;
  avgStake: number;
  periodRtp: number;
  partial: boolean;
}

export function ticksInCandle(ticks: SimChartTick[], candle: SimCandle): SimChartTick[] {
  return ticks.filter((t) => t.gameIndex >= candle.gameStart && t.gameIndex <= candle.gameEnd);
}

export function summarizeCandlePeriod(ticks: SimChartTick[], candle: SimCandle): CandlePeriodStats {
  const pts = ticksInCandle(ticks, candle);
  let manualGames = 0;
  let autoGames = 0;
  let userWins = 0;
  let userLosses = 0;
  let userBreakEven = 0;
  let periodUserNet = 0;
  let periodAdminNet = 0;
  let totalVolume = 0;

  for (const p of pts) {
    if (p.source === "manual") manualGames++;
    else autoGames++;
    periodUserNet += p.userDelta;
    periodAdminNet += p.adminDelta;
    totalVolume += p.volume;
    if (p.userDelta > 0) userWins++;
    else if (p.userDelta < 0) userLosses++;
    else userBreakEven++;
  }

  const gamesPlayed = pts.length;
  const periodRtp = totalVolume > 0 ? (totalVolume + periodUserNet) / totalVolume : 0;

  return {
    gamesPlayed,
    gameStart: candle.gameStart,
    gameEnd: candle.gameEnd,
    manualGames,
    autoGames,
    periodUserNet,
    periodAdminNet,
    totalVolume,
    userWins,
    userLosses,
    userBreakEven,
    avgStake: gamesPlayed > 0 ? totalVolume / gamesPlayed : 0,
    periodRtp,
    partial: candle.label.endsWith("*"),
  };
}

export function formatCandleTimeRange(candle: SimCandle): string | null {
  if (candle.timeStart == null || candle.timeEnd == null) return null;
  const tz = chartLocalTimeZone();
  const fmt = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  return `${fmt(candle.timeStart)} → ${fmt(candle.timeEnd)}`;
}

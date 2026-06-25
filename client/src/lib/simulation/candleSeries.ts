import type { GameEconomics } from "./types";

export interface SimCandle {
  id: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  gameStart: number;
  gameEnd: number;
  volume: number;
  bullish: boolean;
  /** Epoch ms — present on time-based candles */
  timeStart?: number;
  timeEnd?: number;
}

export function candleBatchSize(totalGames: number, maxCandles = 72): number {
  return Math.max(1, Math.ceil(totalGames / maxCandles));
}

export function buildCandlesFromGames(games: GameEconomics[], batchSize: number): SimCandle[] {
  if (games.length === 0) return [];

  const candles: SimCandle[] = [];
  let running = 0;
  let batchStart = 1;
  let open = 0;
  let high = 0;
  let low = 0;
  let volume = 0;

  for (let i = 0; i < games.length; i++) {
    const g = games[i]!;
    running += g.userProfit;
    volume += g.userStake;

    if (i % batchSize === 0) {
      open = i === 0 ? 0 : candles[candles.length - 1]!.close;
      high = running;
      low = running;
      batchStart = i + 1;
      volume = g.userStake;
    } else {
      high = Math.max(high, running);
      low = Math.min(low, running);
      volume += g.userStake;
    }

    const isLastInBatch = (i + 1) % batchSize === 0 || i === games.length - 1;
    if (isLastInBatch) {
      const close = running;
      const id = candles.length;
      candles.push({
        id,
        label: `G${batchStart}${batchStart === i + 1 ? "" : `–${i + 1}`}`,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        gameStart: batchStart,
        gameEnd: i + 1,
        volume,
        bullish: close >= open,
      });
    }
  }

  return candles;
}

export interface LiveCandleBuilder {
  batchSize: number;
  runningProfit: number;
  gamesInBatch: number;
  batchStart: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export function createLiveCandleBuilder(totalGames: number): LiveCandleBuilder {
  return {
    batchSize: candleBatchSize(totalGames),
    runningProfit: 0,
    gamesInBatch: 0,
    batchStart: 1,
    open: 0,
    high: 0,
    low: 0,
    volume: 0,
  };
}

export function pushGameToCandleSeries(
  builder: LiveCandleBuilder,
  candles: SimCandle[],
  gameIndex: number,
  profitDelta: number,
  stake: number,
): { builder: LiveCandleBuilder; candles: SimCandle[] } {
  const next = { ...builder };
  next.runningProfit += profitDelta;

  if (next.gamesInBatch === 0) {
    next.open = candles.length > 0 ? candles[candles.length - 1]!.close : 0;
    next.high = next.runningProfit;
    next.low = next.runningProfit;
    next.batchStart = gameIndex;
    next.volume = stake;
  } else {
    next.high = Math.max(next.high, next.runningProfit);
    next.low = Math.min(next.low, next.runningProfit);
    next.volume += stake;
  }

  next.gamesInBatch++;

  const batchFull = next.gamesInBatch >= next.batchSize;

  if (batchFull) {
    const close = next.runningProfit;
    const candle: SimCandle = {
      id: candles.length,
      label:
        next.batchStart === gameIndex
          ? `G${gameIndex}`
          : `G${next.batchStart}–${gameIndex}`,
      open: next.open,
      high: Math.max(next.high, next.open, close),
      low: Math.min(next.low, next.open, close),
      close,
      gameStart: next.batchStart,
      gameEnd: gameIndex,
      volume: next.volume,
      bullish: close >= next.open,
    };
    return {
      builder: {
        ...next,
        gamesInBatch: 0,
        volume: 0,
      },
      candles: [...candles, candle],
    };
  }

  return { builder: next, candles };
}

export function pushGameToLiveCandles(
  builder: LiveCandleBuilder,
  candles: SimCandle[],
  gameIndex: number,
  economics: GameEconomics,
): { builder: LiveCandleBuilder; candles: SimCandle[] } {
  return pushGameToCandleSeries(builder, candles, gameIndex, economics.userProfit, economics.userStake);
}

/** Finalize a partial in-progress candle for live display. */
export function flushLiveCandle(builder: LiveCandleBuilder, candles: SimCandle[]): SimCandle[] {
  if (builder.gamesInBatch === 0) return candles;
  const close = builder.runningProfit;
  const gameEnd = builder.batchStart + builder.gamesInBatch - 1;
  const partial: SimCandle = {
    id: candles.length,
    label: `G${builder.batchStart}–${gameEnd}*`,
    open: builder.open,
    high: Math.max(builder.high, builder.open, close),
    low: Math.min(builder.low, builder.open, close),
    close,
    gameStart: builder.batchStart,
    gameEnd,
    volume: builder.volume,
    bullish: close >= builder.open,
  };
  return [...candles, partial];
}

export function displayCandles(candles: SimCandle[], builder: LiveCandleBuilder | null): SimCandle[] {
  if (!builder || builder.gamesInBatch === 0) return candles;
  const close = builder.runningProfit;
  const gameEnd = builder.batchStart + builder.gamesInBatch - 1;
  const partial: SimCandle = {
    id: candles.length,
    label: `G${builder.batchStart}–${gameEnd}*`,
    open: builder.open,
    high: Math.max(builder.high, builder.open, close),
    low: Math.min(builder.low, builder.open, close),
    close,
    gameStart: builder.batchStart,
    gameEnd,
    volume: builder.volume,
    bullish: close >= builder.open,
  };
  return [...candles, partial];
}

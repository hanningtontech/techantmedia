/** Time (X) scale — slot-aligned labels with anti-overlap (TradingView-style). */

import type { SimCandle } from "./candleSeries";
import { estimateTextWidthPx } from "./chartLayout";
import {
  formatTimeAxisLabel,
  liveChartCenterTimeMs,
  liveChartTimeAtSlot,
} from "./timeChartHistory";

export interface TimeAxisLabel {
  x: number;
  label: string;
  idx: number;
  slot: number;
}

export interface PlacedCandleTime {
  candle: SimCandle;
  globalIndex: number;
  slot: number;
}

/** Pick candidate slots for time labels (evenly spaced + always last candle). */
export function timeLabelCandidates(
  placed: PlacedCandleTime[],
  plotWidth: number,
  minGapPx: number,
  fontSize: number,
): PlacedCandleTime[] {
  if (placed.length === 0) return [];

  const avgLabelW = fontSize * 5;
  const maxLabels = Math.max(2, Math.floor(plotWidth / Math.max(minGapPx, avgLabelW)));
  const step = Math.max(1, Math.ceil(placed.length / maxLabels));

  const picks: PlacedCandleTime[] = [];
  for (let i = 0; i < placed.length; i += step) {
    picks.push(placed[i]!);
  }

  const last = placed[placed.length - 1]!;
  if (picks[picks.length - 1]?.globalIndex !== last.globalIndex) {
    picks.push(last);
  }
  return picks;
}

function candleTimeMs(candle: SimCandle): number {
  return candle.timeStart ?? candle.timeEnd ?? 0;
}

/** Build X-axis labels from candle timestamps; drop labels that would overlap. */
export function buildTimeAxisLabels(
  placed: PlacedCandleTime[],
  plotLeft: number,
  slotW: number,
  timeframeMs: number,
  minGapPx: number,
  fontSize: number,
): TimeAxisLabel[] {
  if (placed.length === 0 || slotW <= 0) return [];

  const plotWidth = slotW * Math.max(1, placed[placed.length - 1]!.slot + 1);
  const candidates = timeLabelCandidates(placed, plotWidth, minGapPx, fontSize);

  const labels: TimeAxisLabel[] = [];
  let lastRight = -Infinity;

  for (const { candle, globalIndex, slot } of candidates) {
    const timeMs = candleTimeMs(candle);
    const label =
      timeMs > 0
        ? formatTimeAxisLabel(timeMs, timeframeMs)
        : candle.label.replace("*", "");
    const x = plotLeft + (slot + 0.5) * slotW;
    const halfW = estimateTextWidthPx(label, fontSize) / 2;
    const left = x - halfW;

    if (labels.length === 0 || left >= lastRight + minGapPx) {
      labels.push({ x, label, idx: globalIndex, slot });
      lastRight = x + halfW;
    }
  }

  const lastPlaced = placed[placed.length - 1]!;
  if (labels.length === 0 || labels[labels.length - 1]!.idx !== lastPlaced.globalIndex) {
    const candle = lastPlaced.candle;
    const timeMs = candleTimeMs(candle);
    const label =
      timeMs > 0
        ? formatTimeAxisLabel(timeMs, timeframeMs)
        : candle.label.replace("*", "");
    const x = plotLeft + (lastPlaced.slot + 0.5) * slotW;
    const halfW = estimateTextWidthPx(label, fontSize) / 2;

    while (labels.length > 0) {
      const prev = labels[labels.length - 1]!;
      const prevHalf = estimateTextWidthPx(prev.label, fontSize) / 2;
      if (x - halfW >= prev.x + prevHalf + minGapPx) break;
      labels.pop();
    }
    labels.push({ x, label, idx: lastPlaced.globalIndex, slot: lastPlaced.slot });
  }

  return labels;
}

/**
 * Live center-anchored X axis — fixed time slots (history left, live center, future right).
 * Labels use wall-clock time for the selected candle interval.
 */
export function buildCenterAnchoredTimeLabels(
  visibleCount: number,
  plotLeft: number,
  slotW: number,
  timeframeMs: number,
  centerTimeMs: number,
  minGapPx: number,
  fontSize: number,
): TimeAxisLabel[] {
  if (visibleCount <= 0 || slotW <= 0) return [];

  const plotWidth = slotW * visibleCount;
  const maxLabels = Math.max(2, Math.floor(plotWidth / Math.max(minGapPx, fontSize * 5)));
  const step = Math.max(1, Math.ceil(visibleCount / maxLabels));

  const labels: TimeAxisLabel[] = [];
  let lastRight = -Infinity;

  for (let slot = 0; slot < visibleCount; slot += step) {
    const label = formatTimeAxisLabel(
      liveChartTimeAtSlot(slot, visibleCount, timeframeMs, centerTimeMs),
      timeframeMs,
    );
    const x = plotLeft + (slot + 0.5) * slotW;
    const halfW = estimateTextWidthPx(label, fontSize) / 2;
    if (labels.length === 0 || x - halfW >= lastRight + minGapPx) {
      labels.push({ x, label, idx: slot, slot });
      lastRight = x + halfW;
    }
  }

  const lastSlot = visibleCount - 1;
  if (labels[labels.length - 1]?.slot !== lastSlot) {
    const label = formatTimeAxisLabel(
      liveChartTimeAtSlot(lastSlot, visibleCount, timeframeMs, centerTimeMs),
      timeframeMs,
    );
    const x = plotLeft + (lastSlot + 0.5) * slotW;
    const halfW = estimateTextWidthPx(label, fontSize) / 2;
    while (labels.length > 0) {
      const prev = labels[labels.length - 1]!;
      const prevHalf = estimateTextWidthPx(prev.label, fontSize) / 2;
      if (x - halfW >= prev.x + prevHalf + minGapPx) break;
      labels.pop();
    }
    labels.push({ x, label, idx: lastSlot, slot: lastSlot });
  }

  return labels;
}

export function liveCenterTimeMsFromCandles(
  candles: SimCandle[],
  atMs = Date.now(),
): number {
  const last = candles[candles.length - 1];
  return liveChartCenterTimeMs(last, atMs);
}

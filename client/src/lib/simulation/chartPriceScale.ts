/** Price (Y) scale — auto-range and nice tick steps like TradingView. */

import type { SimCandle } from "./candleSeries";
import { estimateTextWidthPx } from "./chartLayout";

export type ChartSeriesMode = "candles" | "bars" | "line" | "area";

export interface PriceRange {
  min: number;
  max: number;
}

export interface PriceScaleState {
  range: PriceRange;
  ticks: number[];
  panOffset: number;
}

/** Collect OHLC extremes from visible candles. */
export function visiblePriceExtents(candles: SimCandle[], mode: ChartSeriesMode): PriceRange | null {
  if (candles.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    min = Math.min(min, c.low, c.open, c.close);
    max = Math.max(max, c.high, c.open, c.close);
    if (mode !== "candles" && mode !== "bars") {
      min = Math.min(min, c.close);
      max = Math.max(max, c.close);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    const pad = Math.max(8, Math.abs(min) * 0.1 || 20);
    return { min: min - pad, max: max + pad };
  }
  return { min, max };
}

/** Pad range for breathing room above/below wicks. */
export function expandPriceRange(range: PriceRange, paddingRatio = 0.12): PriceRange {
  const span = range.max - range.min;
  const pad = Math.max(8, span * paddingRatio);
  return { min: range.min - pad, max: range.max + pad };
}

function niceStep(roughStep: number): number {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(roughStep));
  const norm = roughStep / pow;
  if (norm <= 1.5) return pow;
  if (norm <= 3) return 2 * pow;
  if (norm <= 7) return 5 * pow;
  return 10 * pow;
}

/** Round tick positions for a readable Y axis. */
export function nicePriceTicks(min: number, max: number, targetCount = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min > max) [min, max] = [max, min];

  const span = max - min;
  if (span <= 0) return [min];

  const step = niceStep(span / Math.max(2, targetCount - 1));
  const tickMin = Math.floor(min / step) * step;
  const tickMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let v = tickMin; v <= tickMax + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(10)));
    if (ticks.length > 24) break;
  }
  return ticks.length > 0 ? ticks : [min, max];
}

export function applyPricePan(range: PriceRange, panRatio: number): PriceRange {
  const span = range.max - range.min;
  const shift = panRatio * span;
  return { min: range.min - shift, max: range.max - shift };
}

export function buildPriceScale(
  candles: SimCandle[],
  mode: ChartSeriesMode,
  plotHeight: number,
  pricePan: number,
): PriceScaleState {
  const raw = visiblePriceExtents(candles, mode);
  const base = raw ? expandPriceRange(raw) : { min: -10, max: 10 };
  const range = applyPricePan(base, pricePan);
  const targetTicks = Math.max(3, Math.min(8, Math.floor(plotHeight / 56)));
  const ticks = nicePriceTicks(range.min, range.max, targetTicks);
  return { range, ticks, panOffset: pricePan };
}

export function priceToY(value: number, range: PriceRange, plotTop: number, plotBottom: number): number {
  const span = range.max - range.min;
  if (span <= 0) return (plotTop + plotBottom) / 2;
  return plotTop + ((range.max - value) / span) * (plotBottom - plotTop);
}

export function yToPrice(y: number, range: PriceRange, plotTop: number, plotBottom: number): number {
  const span = range.max - range.min;
  const plotH = plotBottom - plotTop;
  if (plotH <= 0) return range.min;
  const t = (y - plotTop) / plotH;
  return range.max - t * span;
}

export function formatPriceAxis(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  if (Math.abs(n) < 0.005) return "0.00";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${abs.toFixed(digits)}`;
}

export function formatPriceDisplay(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${abs.toFixed(digits)}`;
}

export function formatOhlc(n: number): string {
  return formatPriceDisplay(n);
}

/** Width needed for the current-price badge on the Y axis. */
export function currentPriceBadgeWidth(price: number, fontSize: number): number {
  const text = formatPriceAxis(price);
  return Math.max(44, estimateTextWidthPx(text, fontSize) + 12);
}

export function maxPriceLabelChars(ticks: number[]): number {
  if (ticks.length === 0) return 7;
  return ticks.reduce((m, t) => Math.max(m, formatPriceAxis(t).length), 0);
}

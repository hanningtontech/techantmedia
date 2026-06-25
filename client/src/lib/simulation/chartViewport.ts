/** Chart viewport math (Interaction / Controller layer). */

export interface ChartViewport {
  visibleCount: number;
  /** 0 = anchor position; higher = scrolled into older history */
  scrollOffset: number;
}

export interface VisibleRange {
  start: number;
  count: number;
  offset: number;
  maxOffset: number;
}

export interface PlacedCandle<T> {
  item: T;
  globalIndex: number;
  slot: number;
}

export function centerSlotIndex(visibleCount: number): number {
  return Math.floor(visibleCount / 2);
}

export function maxPanOffsetCenter(total: number, visibleCount: number): number {
  if (total <= 0) return 0;
  const center = centerSlotIndex(visibleCount);
  return Math.max(0, total - 1 - center);
}

/** Live mode: latest candle at center when panOffset=0; empty slots to the right = future. */
export function layoutCandlesCenter<T>(
  items: T[],
  visibleCount: number,
  panOffset: number,
): PlacedCandle<T>[] {
  const total = items.length;
  if (total === 0) return [];
  const center = centerSlotIndex(visibleCount);
  const placed: PlacedCandle<T>[] = [];
  for (let i = 0; i < total; i++) {
    const slot = center - (total - 1 - i) + panOffset;
    if (slot >= 0 && slot < visibleCount) {
      placed.push({ item: items[i]!, globalIndex: i, slot });
    }
  }
  return placed;
}

/** Historical mode: candles fill width, newest on the right. */
export function layoutCandlesRight<T>(
  items: T[],
  visibleCount: number,
  scrollOffset: number,
): PlacedCandle<T>[] {
  const total = items.length;
  if (total === 0) return [];
  const count = Math.min(visibleCount, total);
  const maxOffset = Math.max(0, total - count);
  const offset = Math.min(Math.max(0, scrollOffset), maxOffset);
  const start = Math.max(0, total - count - offset);
  const placed: PlacedCandle<T>[] = [];
  for (let j = 0; j < count; j++) {
    placed.push({ item: items[start + j]!, globalIndex: start + j, slot: j });
  }
  return placed;
}

export function visibleCountForWidth(width: number, zoom: number): number {
  const plotW = Math.max(100, width - 76);
  const atZoom1 = Math.max(16, Math.floor(plotW / 6));
  return Math.max(3, Math.round(atZoom1 / Math.max(0.25, zoom)));
}

/** Candle width scales with zoom: wide when few visible, thin when many. */
export function computeCandleGeometry(plotWidth: number, slotCount: number) {
  const slotW = plotWidth / Math.max(slotCount, 1);
  const gapPx =
    slotCount <= 6 ? 1.5 : slotCount <= 16 ? Math.max(1, slotW * 0.04) : slotCount <= 48 ? slotW * 0.08 : slotW * 0.14;
  const bodyW = Math.max(1, slotW - gapPx);
  const wickW = Math.max(1, bodyW <= 2 ? 1 : bodyW <= 6 ? 1.15 : 1.35);
  return { slotW, bodyW, gapPx, wickW };
}

export function computeVisibleRange(total: number, viewport: ChartViewport): VisibleRange {
  if (total === 0) {
    return { start: 0, count: 0, offset: 0, maxOffset: 0 };
  }
  const count = Math.min(viewport.visibleCount, total);
  const maxOffset = Math.max(0, total - count);
  const offset = Math.min(Math.max(0, viewport.scrollOffset), maxOffset);
  const start = Math.max(0, total - count - offset);
  return { start, count, offset, maxOffset };
}

export function panByPixels(
  offset: number,
  deltaPx: number,
  slotWidth: number,
  maxOffset: number,
  minOffset = 0,
): number {
  if (slotWidth <= 0) return offset;
  const candleDelta = Math.round(deltaPx / slotWidth);
  return Math.min(maxOffset, Math.max(minOffset, offset + candleDelta));
}

export function panByWheelSteps(offset: number, delta: number, maxOffset: number, step = 2, minOffset = 0): number {
  const dir = delta > 0 ? step : -step;
  return Math.min(maxOffset, Math.max(minOffset, offset + dir));
}

export function nearestCandleIndex(
  mouseX: number,
  plotLeft: number,
  slotWidth: number,
  visibleStart: number,
  visibleCount: number,
): number {
  if (slotWidth <= 0 || visibleCount === 0) return visibleStart;
  const i = Math.floor((mouseX - plotLeft) / slotWidth);
  const clamped = Math.min(visibleCount - 1, Math.max(0, i));
  return visibleStart + clamped;
}

export function nearestPlacedCandleIndex(
  mouseX: number,
  plotLeft: number,
  slotWidth: number,
  placed: PlacedCandle<unknown>[],
): number | null {
  if (slotWidth <= 0 || placed.length === 0) return null;
  const slot = Math.floor((mouseX - plotLeft) / slotWidth);
  let best: PlacedCandle<unknown> | null = null;
  let bestDist = Infinity;
  for (const p of placed) {
    const dist = Math.abs(p.slot - slot);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best?.globalIndex ?? null;
}

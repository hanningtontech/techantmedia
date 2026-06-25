/** Firestore chart archive helpers (functions runtime). */

export interface LiveChartTick {
  t: number;
  gameIndex: number;
  userCumulative: number;
  adminCumulative: number;
  userDelta: number;
  adminDelta: number;
  volume: number;
  source: "manual" | "auto";
}

export const CHART_PAGE_SIZE = 1500;
export const CHART_TAIL_SIZE = 600;

export interface ChartHistoryPageDoc {
  pageIndex: number;
  ticks: LiveChartTick[];
  startGameIndex: number;
  endGameIndex: number;
}

export function appendTickToBuffer(buffer: LiveChartTick[], tick: LiveChartTick): LiveChartTick[] {
  const last = buffer[buffer.length - 1];
  if (last?.gameIndex === tick.gameIndex) return buffer;
  const next = [...buffer, tick];
  return next.length > CHART_TAIL_SIZE ? next.slice(-CHART_TAIL_SIZE) : next;
}

export function appendTicksToPage(page: LiveChartTick[], ticks: LiveChartTick[]): LiveChartTick[] {
  const out = [...page];
  for (const tick of ticks) {
    const last = out[out.length - 1];
    if (last?.gameIndex === tick.gameIndex) continue;
    out.push(tick);
  }
  return out;
}

export function splitOverflowPages(
  pageIndex: number,
  pageTicks: LiveChartTick[],
): { pages: ChartHistoryPageDoc[]; latestPageIndex: number; remainder: LiveChartTick[] } {
  const pages: ChartHistoryPageDoc[] = [];
  let idx = pageIndex;
  let buf = [...pageTicks];

  while (buf.length > CHART_PAGE_SIZE) {
    const chunk = buf.slice(0, CHART_PAGE_SIZE);
    pages.push({
      pageIndex: idx,
      ticks: chunk,
      startGameIndex: chunk[0]!.gameIndex,
      endGameIndex: chunk[chunk.length - 1]!.gameIndex,
    });
    idx += 1;
    buf = buf.slice(CHART_PAGE_SIZE);
  }

  return { pages, latestPageIndex: idx, remainder: buf };
}

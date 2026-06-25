/** Firestore chart archive — page size constants and merge helpers (client + functions). */

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

/** Ticks per Firestore page — keeps each doc well under 1 MB. */
export const CHART_PAGE_SIZE = 1500;

/** Recent tail on `blockGame/liveChart` for realtime listeners. */
export const CHART_TAIL_SIZE = 600;

export interface ChartHistoryPageDoc {
  pageIndex: number;
  ticks: LiveChartTick[];
  startGameIndex: number;
  endGameIndex: number;
}

/** Merge paged archive + live tail into one continuous timeline (deduped by gameIndex). */
export function mergePagedChartHistory(pageTicks: LiveChartTick[], tail: LiveChartTick[]): LiveChartTick[] {
  if (pageTicks.length === 0) return [...tail];
  if (tail.length === 0) return [...pageTicks];

  const lastPageGame = pageTicks[pageTicks.length - 1]!.gameIndex;
  const tailStart = tail.findIndex((t) => t.gameIndex > lastPageGame);
  const tailSlice = tailStart >= 0 ? tail.slice(tailStart) : tail;
  if (tailSlice.length === 0) return [...pageTicks];

  const firstTailGame = tailSlice[0]!.gameIndex;
  const trimmedPages = pageTicks.filter((t) => t.gameIndex < firstTailGame);
  return [...trimmedPages, ...tailSlice];
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

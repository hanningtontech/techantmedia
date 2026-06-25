import { loadFullLiveChartHistory } from "./blockGameFirestore";
import { mergeLiveChartTicks, type SimChartTick } from "@/lib/simulation/timeChartHistory";

const STORAGE_KEY = "block-game-live-chart-archive-v2";
const META_KEY = "block-game-live-chart-archive-meta-v2";

/** How long a full archive fetch stays valid when the tail has not grown. */
export const LIVE_CHART_ARCHIVE_TTL_MS = 45 * 60_000;

/** Max ticks persisted locally (fast cold start without blowing quota). */
const LOCAL_STORAGE_MAX_TICKS = 4000;

export interface LiveChartArchiveMeta {
  lastGameIndex: number;
  tickCount: number;
  fetchedAt: number;
}

interface StoredPayload {
  ticks: SimChartTick[];
  meta: LiveChartArchiveMeta;
}

let memoryArchive: SimChartTick[] | null = null;
let memoryMeta: LiveChartArchiveMeta | null = null;
let inflightFullLoad: Promise<SimChartTick[]> | null = null;

function lastGameIndex(history: SimChartTick[]): number {
  return history.length > 0 ? history[history.length - 1]!.gameIndex : 0;
}

function readLocalStorage(): StoredPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const metaRaw = localStorage.getItem(META_KEY);
    if (!raw || !metaRaw) return null;
    const ticks = JSON.parse(raw) as SimChartTick[];
    const meta = JSON.parse(metaRaw) as LiveChartArchiveMeta;
    if (!Array.isArray(ticks) || ticks.length === 0) return null;
    return { ticks, meta };
  } catch {
    return null;
  }
}

function writeLocalStorage(ticks: SimChartTick[], meta: LiveChartArchiveMeta): void {
  if (typeof window === "undefined") return;
  try {
    const slice = ticks.length > LOCAL_STORAGE_MAX_TICKS ? ticks.slice(-LOCAL_STORAGE_MAX_TICKS) : ticks;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
    localStorage.setItem(META_KEY, JSON.stringify({ ...meta, tickCount: slice.length }));
  } catch {
    /* quota */
  }
}

function commitArchive(ticks: SimChartTick[], fetchedAt = Date.now()): SimChartTick[] {
  memoryArchive = ticks;
  memoryMeta = {
    lastGameIndex: lastGameIndex(ticks),
    tickCount: ticks.length,
    fetchedAt,
  };
  writeLocalStorage(ticks, memoryMeta);
  return ticks;
}

/** Synchronous warm read — memory, then localStorage. */
export function peekLiveChartArchiveCache(): SimChartTick[] {
  if (memoryArchive && memoryArchive.length > 0) return memoryArchive;
  const stored = readLocalStorage();
  if (!stored) return [];
  memoryArchive = stored.ticks;
  memoryMeta = stored.meta;
  return stored.ticks;
}

export function peekLiveChartArchiveMeta(): LiveChartArchiveMeta | null {
  if (memoryMeta) return memoryMeta;
  peekLiveChartArchiveCache();
  return memoryMeta;
}

export function shouldRefreshFullLiveChartArchive(tailGameIndex: number): boolean {
  const meta = peekLiveChartArchiveMeta();
  const archive = peekLiveChartArchiveCache();
  if (!meta || archive.length === 0) return true;
  if (tailGameIndex > meta.lastGameIndex) return true;
  if (Date.now() - meta.fetchedAt > LIVE_CHART_ARCHIVE_TTL_MS) return true;
  return false;
}

/**
 * Full paged archive — heavily cached in memory + localStorage.
 * Network fetch only when tail grows, cache is empty, or TTL expired.
 */
export async function getFullLiveChartHistoryCached(opts?: {
  force?: boolean;
  tailGameIndex?: number;
}): Promise<SimChartTick[]> {
  const tailGameIndex = opts?.tailGameIndex ?? peekLiveChartArchiveMeta()?.lastGameIndex ?? 0;
  const cached = peekLiveChartArchiveCache();

  if (!opts?.force && cached.length > 0 && !shouldRefreshFullLiveChartArchive(tailGameIndex)) {
    return cached;
  }

  if (inflightFullLoad) return inflightFullLoad;

  inflightFullLoad = loadFullLiveChartHistory()
    .then((full) => {
      if (full.length === 0) return cached.length > 0 ? cached : full;
      const merged =
        cached.length > 0 ? mergeLiveChartTicks(cached, full) : full;
      return commitArchive(merged);
    })
    .finally(() => {
      inflightFullLoad = null;
    });

  return inflightFullLoad;
}

/** Merge live tail into cached archive without a full refetch when possible. */
export function mergeTailIntoArchiveCache(tail: SimChartTick[]): SimChartTick[] {
  if (tail.length === 0) return peekLiveChartArchiveCache();
  const cached = peekLiveChartArchiveCache();
  const merged = cached.length > 0 ? mergeLiveChartTicks(cached, tail) : tail;
  if (merged.length === cached.length && cached.length > 0) return cached;
  return commitArchive(merged);
}

export function clearLiveChartArchiveCache(): void {
  memoryArchive = null;
  memoryMeta = null;
  inflightFullLoad = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}

import type { AutoPlayProgress } from "./types";
import type { SimChartTick } from "./timeChartHistory";

export const SIM_CHART_SESSION_KEY = "block-sim-chart-session-v1";
export const SIM_CHART_PAGE_PATH = "/game/chart";

const BROADCAST_CHANNEL = "block-sim-chart-session-v1";

export interface SimChartSessionSnapshot {
  updatedAt: number;
  chartHistory: SimChartTick[];
  chartTimeframeId: string;
  liveMetrics: { games: number; userProfit: number; adminRevenue: number };
  autoProgress: AutoPlayProgress;
  sessionName: string;
  houseEdge: number;
  userStake: number;
}

function getBroadcastChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(BROADCAST_CHANNEL) : null;
  } catch {
    return null;
  }
}

export function writeSimChartSessionSnapshot(snapshot: SimChartSessionSnapshot): void {
  try {
    sessionStorage.setItem(SIM_CHART_SESSION_KEY, JSON.stringify(snapshot));
    notifySimChartSessionUpdated();
    getBroadcastChannel()?.postMessage(snapshot);
  } catch {
    /* sessionStorage full or unavailable */
  }
}

export function readSimChartSessionSnapshot(): SimChartSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SIM_CHART_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SimChartSessionSnapshot;
  } catch {
    return null;
  }
}

export function notifySimChartSessionUpdated(): void {
  window.dispatchEvent(new Event("sim-chart-session-updated"));
}

export function subscribeSimChartSessionSnapshot(
  listener: (snapshot: SimChartSessionSnapshot | null) => void,
): () => void {
  const refresh = () => listener(readSimChartSessionSnapshot());
  const onStorage = (e: StorageEvent) => {
    if (e.key === SIM_CHART_SESSION_KEY) refresh();
  };
  const channel = getBroadcastChannel();
  const onBroadcast = (e: MessageEvent) => {
    if (e.data && typeof e.data === "object") {
      listener(e.data as SimChartSessionSnapshot);
    }
  };

  refresh();
  window.addEventListener("storage", onStorage);
  window.addEventListener("sim-chart-session-updated", refresh);
  channel?.addEventListener("message", onBroadcast);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("sim-chart-session-updated", refresh);
    channel?.removeEventListener("message", onBroadcast);
    channel?.close();
  };
}

export function openSimChartPageInNewTab(): void {
  window.open(`${window.location.origin}${SIM_CHART_PAGE_PATH}`, "_blank", "noopener,noreferrer");
}

/** Prefer the sim snapshot with more ticks or newer update (same-tab + cross-tab). */
export function pickSimChartSession(
  a: SimChartSessionSnapshot | null,
  b: SimChartSessionSnapshot | null,
): SimChartSessionSnapshot | null {
  if (!a) return b;
  if (!b) return a;
  if (a.chartHistory.length !== b.chartHistory.length) {
    return a.chartHistory.length > b.chartHistory.length ? a : b;
  }
  return a.updatedAt >= b.updatedAt ? a : b;
}

import { CHART_TIMEFRAMES } from "@/lib/simulation/timeChartHistory";

const INTERVAL_KEY = "block-game-chart-interval-v1";

export function loadChartInterval(): string | null {
  try {
    const raw = localStorage.getItem(INTERVAL_KEY);
    if (!raw) return null;
    return CHART_TIMEFRAMES.some((t) => t.id === raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveChartInterval(id: string): void {
  try {
    if (CHART_TIMEFRAMES.some((t) => t.id === id)) {
      localStorage.setItem(INTERVAL_KEY, id);
    }
  } catch {
    /* ignore */
  }
}

export function hasSavedChartInterval(): boolean {
  return loadChartInterval() != null;
}

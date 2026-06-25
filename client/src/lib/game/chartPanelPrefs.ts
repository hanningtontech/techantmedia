export type ChartPanelMode = "hidden" | "minimized" | "open";

export const DEFAULT_CHART_PANEL_MODE: ChartPanelMode = "minimized";

const PREFS_KEY = "block-game-chart-panel-v1";

export function loadChartPanelMode(): ChartPanelMode {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw === "hidden" || raw === "minimized" || raw === "open") return raw;
    return DEFAULT_CHART_PANEL_MODE;
  } catch {
    return DEFAULT_CHART_PANEL_MODE;
  }
}

export function saveChartPanelMode(mode: ChartPanelMode): void {
  try {
    localStorage.setItem(PREFS_KEY, mode);
  } catch {
    /* ignore */
  }
}

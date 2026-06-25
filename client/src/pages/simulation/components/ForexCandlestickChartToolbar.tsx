import { Minus, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { ChartSeriesMode } from "@/lib/simulation/chartPriceScale";
import { chartLocalTimeZone, intervalBucketDescription } from "@/lib/simulation/timeChartHistory";
import type { ChartLayout } from "@/lib/simulation/chartLayout";
import { cn } from "@/lib/utils";
import type { ChartLiveStats } from "./ForexCandlestickChart";
import { ChartTimeframeSelect } from "./ChartTimeframeSelect";

type ChartDisplayMode = ChartSeriesMode;

const CHART_MODES: { id: ChartDisplayMode; label: string }[] = [
  { id: "candles", label: "Candles" },
  { id: "bars", label: "Bars" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];

export function ForexCandlestickChartToolbar({
  series,
  activeId,
  onSeriesChange,
  displayMode,
  onDisplayModeChange,
  timeframeId,
  onTimeframeChange,
  live,
  layout,
  followLatest,
  onGoToLatest,
  onZoomIn,
  onZoomOut,
  liveStats,
  totalCandles,
}: {
  series: { id: string; shortLabel: string }[];
  activeId: string;
  onSeriesChange: (id: string) => void;
  displayMode: ChartDisplayMode;
  onDisplayModeChange: (mode: ChartDisplayMode) => void;
  timeframeId: string;
  onTimeframeChange?: (id: string) => void;
  live?: boolean;
  layout: ChartLayout;
  followLatest: boolean;
  onGoToLatest: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  liveStats?: ChartLiveStats;
  totalCandles?: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { compact, showLiveStats, showTimezone } = layout.toolbar;
  const fs = layout.fonts.toolbar;
  const btn = layout.zoomButtonSize;

  return (
    <div
      className="flex shrink-0 items-center gap-1 border-b px-1.5 py-1 sm:px-2"
      style={{ borderColor: "#2a2e39", background: "#131722" }}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-0.5">
        {series.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSeriesChange(s.id)}
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 font-medium transition-colors sm:px-2",
              activeId === s.id ? "text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc]",
            )}
            style={{ fontSize: fs }}
          >
            {compact ? s.shortLabel.split("/")[0] : s.shortLabel}
          </button>
        ))}
      </div>

      <ChartTimeframeSelect
        timeframeId={timeframeId}
        onChange={onTimeframeChange}
        compact={compact}
        fontSize={fs}
        className="mx-0.5"
      />

      {!compact && (
        <>
          <span className="mx-0.5 shrink-0 text-[#2a2e39]">|</span>
          <div className="flex shrink-0 gap-0.5">
            {CHART_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onDisplayModeChange(m.id)}
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-medium transition-colors",
                  displayMode === m.id ? "text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc]",
                )}
                style={{ fontSize: fs }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}

      {live && (
        <span
          className="ml-0.5 shrink-0 rounded px-1 py-0.5 font-bold uppercase tracking-wider text-[#26a69a]"
          style={{ fontSize: Math.max(8, fs - 2) }}
        >
          ● Live
        </span>
      )}

      {live && showTimezone && (
        <span
          className="ml-0.5 hidden shrink-0 text-[#787b86] lg:inline"
          style={{ fontSize: Math.max(8, fs - 2) }}
          title={intervalBucketDescription(timeframeId)}
        >
          {chartLocalTimeZone()}
        </span>
      )}

      {!followLatest && (
        <button
          type="button"
          onClick={onGoToLatest}
          className="ml-0.5 flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[#2962ff] hover:bg-[#2a2e39]"
          style={{ fontSize: Math.max(9, fs - 1) }}
          title="Center on live candle"
        >
          <RotateCcw className="h-3 w-3" />
          {!compact && <span>Live</span>}
        </button>
      )}

      {liveStats && showLiveStats && (
        <span
          className="ml-1 hidden shrink-0 tabular-nums text-[#787b86] sm:inline"
          style={{ fontSize: Math.max(9, fs - 1) }}
        >
          G {liveStats.games.toLocaleString()}
        </span>
      )}

      {totalCandles != null && totalCandles > 0 && (
        <span
          className="hidden shrink-0 tabular-nums text-[#434651] md:inline"
          style={{ fontSize: Math.max(8, fs - 2) }}
          title="Candles in selected interval"
        >
          {totalCandles.toLocaleString()} bars
        </span>
      )}

      {compact && (
        <div className="relative ml-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center justify-center rounded text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
            style={{ width: btn, height: btn }}
            aria-label="More chart options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-md border py-1 shadow-lg"
                style={{ borderColor: "#2a2e39", background: "#1c2030" }}
              >
                {CHART_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={cn(
                      "flex w-full px-3 py-1.5 text-left hover:bg-[#2a2e39]",
                      displayMode === m.id ? "text-[#2962ff]" : "text-[#d1d4dc]",
                    )}
                    style={{ fontSize: fs }}
                    onClick={() => {
                      onDisplayModeChange(m.id);
                      setMenuOpen(false);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onZoomOut}
          className="flex items-center justify-center rounded text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
          style={{ width: btn, height: btn }}
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="flex items-center justify-center rounded text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
          style={{ width: btn, height: btn }}
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

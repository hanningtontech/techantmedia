import { ForexCandlestickChart } from "./ForexCandlestickChart";
import { useUniversalLiveChart } from "@/hooks/useUniversalLiveChart";
import { cn } from "@/lib/utils";

/**
 * Single chart for simulation + live game — `ForexCandlestickChart` with universal Firestore/session feed.
 * Used by /simulation results, /game/chart, and in-game chart panel.
 */
export function BlockGameUniversalChart({ className }: { className?: string }) {
  const {
    chartHistory,
    chartSeries,
    chartTimeframes,
    timeframeId,
    setTimeframeId,
    liveStats,
    isLive,
  } = useUniversalLiveChart();

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col bg-[#131722] text-[#d1d4dc]", className)}>
      <ForexCandlestickChart
        className="min-h-0 flex-1"
        series={chartSeries}
        live={isLive}
        defaultSeriesId="user"
        liveStats={liveStats}
        timeframes={chartTimeframes}
        timeframeId={timeframeId}
        onTimeframeChange={setTimeframeId}
        chartHistory={chartHistory}
      />
    </div>
  );
}

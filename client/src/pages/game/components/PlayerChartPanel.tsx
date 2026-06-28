import {
  BarChart3,
  ChevronDown,
  ExternalLink,
  EyeOff,
  PanelRightClose,
} from "lucide-react";
import { useLocation } from "wouter";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { useShortLaptopGameLayout } from "@/hooks/useShortLaptopGameLayout";
import { SIM_CHART_PAGE_PATH } from "@/lib/simulation/chartSessionSync";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlayerInlineChart } from "./PlayerInlineChart";

function ChartPanelToolbar({
  onMinimize,
  onHide,
  onOpenTab,
  className,
}: {
  onMinimize: () => void;
  onHide: () => void;
  onOpenTab: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 border-b border-[#2a2e39] bg-[#1c2030] px-2 py-1.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5 shrink-0 text-[#2962ff]" />
        <span className="truncate text-xs font-medium text-[#d1d4dc]">Live chart</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-[#787b86] hover:text-[#d1d4dc]"
          onClick={onOpenTab}
          aria-label="Open chart in new tab"
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-[#787b86] hover:text-[#d1d4dc]"
          onClick={onMinimize}
          aria-label="Minimize chart"
          title="Minimize"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-[#787b86] hover:text-[#d1d4dc]"
          onClick={onHide}
          aria-label="Hide charts"
          title="Hide charts"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function PlayerChartPanel({ className }: { className?: string }) {
  const { chartPanelMode, minimizeChartPanel, hideChartPanel, openChartInNewTab } =
    useBlockGamePlayer();

  if (chartPanelMode !== "open") return null;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#2a2e39]",
        className,
      )}
    >
      <ChartPanelToolbar
        onMinimize={minimizeChartPanel}
        onHide={hideChartPanel}
        onOpenTab={openChartInNewTab}
      />
      <PlayerInlineChart className="min-h-0 flex-1 rounded-none border-0" />
    </div>
  );
}

export function ChartPanelToggleButton({ className }: { className?: string }) {
  const { chartPanelMode, expandChartPanel, minimizeChartPanel } = useBlockGamePlayer();
  const isShortLaptop = useShortLaptopGameLayout();
  const [, setLocation] = useLocation();

  const openChartPage = () => setLocation(SIM_CHART_PAGE_PATH);

  if (isShortLaptop) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          "h-9 border-[#2962ff]/40 text-xs text-zinc-200",
          className,
        )}
        onClick={openChartPage}
        aria-label="Open live chart page"
        title="Open live chart"
      >
        <BarChart3 className="mr-1 h-3.5 w-3.5" />
        Chart
      </Button>
    );
  }

  if (chartPanelMode !== "open") {
    return (
      <>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("h-9 w-9 text-zinc-400 hover:text-zinc-100 lg:hidden", className)}
          onClick={expandChartPanel}
          aria-label="Show chart"
          title="Show chart"
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("hidden h-9 border-[#2962ff]/40 text-xs text-zinc-200 lg:inline-flex", className)}
          onClick={expandChartPanel}
        >
          <PanelRightClose className="mr-1 h-3.5 w-3.5" />
          Show chart
        </Button>
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn("h-9 w-9 text-zinc-400 hover:text-zinc-100 lg:hidden", className)}
        onClick={minimizeChartPanel}
        aria-label="Minimize chart"
        title="Minimize chart"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn("hidden h-9 border-white/15 text-xs text-zinc-400 lg:inline-flex", className)}
        onClick={minimizeChartPanel}
      >
        <ChevronDown className="mr-1 h-3.5 w-3.5" />
        Minimize
      </Button>
    </>
  );
}

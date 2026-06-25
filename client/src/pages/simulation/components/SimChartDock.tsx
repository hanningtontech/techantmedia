import { BarChart3, ExternalLink, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmtPrice(n: number) {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${abs.toFixed(digits)}`;
}

export function SimChartDock({
  visible,
  isLive,
  games,
  target,
  progressPct,
  userNet,
  sessionGames,
  onExpand,
  onDismiss,
  onOpenNewTab,
}: {
  visible: boolean;
  isLive: boolean;
  games: number;
  target: number;
  progressPct: number;
  userNet: number;
  sessionGames: number;
  onExpand: () => void;
  onDismiss: () => void;
  onOpenNewTab: () => void;
}) {
  if (!visible) return null;

  const progress = target > 0 ? (games / target) * 100 : 0;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))]",
        "rounded-lg border border-[#2a2e39] bg-[#131722] shadow-2xl shadow-black/50",
      )}
      role="region"
      aria-label="Session chart dock"
    >
      <div className="flex items-center gap-2 border-b border-[#2a2e39] px-3 py-2">
        <BarChart3 className="h-3.5 w-3.5 shrink-0 text-[#2962ff]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#d1d4dc]">
            {isLive ? (
              <>
                <span className="text-[#26a69a]">● Live</span>
                <span className="text-[#787b86]"> · </span>
                G {games.toLocaleString()}/{target.toLocaleString()}
              </>
            ) : (
              <>Session chart · {sessionGames.toLocaleString()} games</>
            )}
          </p>
          <p className="truncate text-[10px] tabular-nums text-[#787b86]">
            {isLive ? (
              <>
                {progressPct}% · Net{" "}
                <span style={{ color: userNet >= 0 ? "#26a69a" : "#ef5350" }}>{fmtPrice(userNet)}</span>
              </>
            ) : (
              <>
                Net <span style={{ color: userNet >= 0 ? "#26a69a" : "#ef5350" }}>{fmtPrice(userNet)}</span>
                <span className="text-[#434651]"> · click expand for chart</span>
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-[10px] text-[#2962ff] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
          onClick={onExpand}
        >
          <Maximize2 className="mr-1 h-3 w-3" />
          Expand
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
          aria-label="Open chart in new tab"
          title="Open in new tab"
          onClick={onOpenNewTab}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
          aria-label="Hide chart dock"
          onClick={onDismiss}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {isLive && (
        <div className="px-3 pb-2.5 pt-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1e222d]">
            <div
              className="h-full bg-gradient-to-r from-[#2962ff] to-[#26a69a] transition-all duration-150"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

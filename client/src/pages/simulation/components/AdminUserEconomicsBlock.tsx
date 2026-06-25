import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { cn } from "@/lib/utils";
import { simHint, type SimViewVariant } from "../simulationStyles";

function fmtMoney(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

export function AdminUserEconomicsBlock({ variant }: { variant: SimViewVariant }) {
  const {
    sessionEconomics,
    currentGameEconomics,
    config,
    autoProgress,
    status,
    summary,
  } = useBlockGameSimulation();

  const expanded = variant === "expanded";
  const compact = !expanded;
  const inProgress = status === "playing" && currentGameEconomics;
  const pad = compact ? "p-3" : "p-4";
  const netText = compact ? "text-base" : "text-lg";

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
      <p className={cn("font-medium text-zinc-400", compact ? "text-xs uppercase tracking-wide" : "text-sm text-zinc-300")}>
        User vs admin
      </p>

      {autoProgress.running && (
        <p
          className={cn(
            simHint,
            "rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-200",
            compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2",
          )}
        >
          P{(autoProgress.activePlayer + 1).toLocaleString()}/{autoProgress.totalPlayers.toLocaleString()} ·{" "}
          {autoProgress.completed.toLocaleString()}/{autoProgress.target.toLocaleString()} games
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className={cn("rounded-xl border border-emerald-500/30 bg-emerald-500/10", pad)}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">User</p>
          <div className={cn("mt-2 space-y-1", compact ? "text-xs" : "text-sm")}>
            <div className="flex justify-between gap-1">
              <span className="text-emerald-200/70">Staked</span>
              <span className="font-medium text-emerald-100">
                ${sessionEconomics.userTotalStaked.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-1">
              <span className="text-emerald-200/70">Returned</span>
              <span className="font-medium text-emerald-100">
                ${sessionEconomics.userTotalPayout.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-1 border-t border-emerald-500/20 pt-1">
              <span className="text-emerald-200/80">Profit</span>
              <span className={cn("font-bold text-emerald-300", netText)}>
                {fmtMoney(sessionEconomics.userNetProfit)}
              </span>
            </div>
          </div>
        </div>

        <div className={cn("rounded-xl border border-red-500/30 bg-red-500/10", pad)}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Admin</p>
          <div className={cn("mt-2 space-y-1", compact ? "text-xs" : "text-sm")}>
            <div className="flex justify-between gap-1">
              <span className="text-red-200/70">Collected</span>
              <span className="font-medium text-red-100">
                ${sessionEconomics.userTotalStaked.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-1">
              <span className="text-red-200/70">Paid out</span>
              <span className="font-medium text-red-100">
                ${sessionEconomics.userTotalPayout.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-1 border-t border-red-500/20 pt-1">
              <span className="text-red-200/80">Revenue</span>
              <span className={cn("font-bold text-red-300", netText)}>
                {fmtMoney(sessionEconomics.adminNetRevenue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg border border-white/10 bg-black/25 px-1 py-1.5">
          <p className="text-[9px] uppercase text-zinc-500">Games</p>
          <p className={cn("font-semibold text-zinc-100", compact ? "text-xs" : "text-sm")}>
            {sessionEconomics.gamesPlayed.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 px-1 py-1.5">
          <p className="text-[9px] uppercase text-zinc-500">Players</p>
          <p className={cn("font-semibold text-zinc-100", compact ? "text-xs" : "text-sm")}>
            {sessionEconomics.playerCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 px-1 py-1.5">
          <p className="text-[9px] uppercase text-zinc-500">Edge</p>
          <p className={cn("font-semibold text-zinc-100", compact ? "text-xs" : "text-sm")}>
            {(sessionEconomics.realizedHouseEdge * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {summary && summary.playerCount > 1 && (
        <p className={cn("text-center", compact ? "text-[10px] text-zinc-500" : "text-xs text-zinc-400")}>
          <span className="text-emerald-400">{summary.playersWinners} winners</span>
          {" · "}
          <span className="text-red-400">{summary.playersLosers} losers</span>
          {summary.playersBreakEven > 0 && (
            <>
              {" · "}
              <span className="text-zinc-500">{summary.playersBreakEven} even</span>
            </>
          )}
        </p>
      )}

      {inProgress && (
        <p className="text-[10px] text-emerald-300/60">
          Live game · potential {fmtMoney(currentGameEconomics!.userProfit)}
        </p>
      )}

      {expanded && (
        <p className={simHint}>
          User profit + admin revenue = 0. Target RTP ≈ {(100 - config.houseEdge * 100).toFixed(1)}%.
        </p>
      )}
    </div>
  );
}

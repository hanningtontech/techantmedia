import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { consecutiveWinProbability, totalCells } from "@/lib/simulation/math";
import { cn } from "@/lib/utils";
import { simPanel, type SimViewVariant } from "../simulationStyles";
import { SimExpandablePanel } from "./SimExpandablePanel";
import { AdminUserEconomicsBlock } from "./AdminUserEconomicsBlock";

function OutcomeBlocksInner({ variant }: { variant: SimViewVariant }) {
  const { config, lastOutcome, cells, selectedIndex, payoutTable } = useBlockGameSimulation();
  const total = totalCells(config.rows, config.cols);
  const targetWinP = consecutiveWinProbability(total, config.bombs, config.simulationRounds);
  const theoreticalEv =
    payoutTable[payoutTable.length - 1]?.expectedValue ??
    config.stake * (targetWinP - config.houseEdge);

  const expanded = variant === "expanded";
  const previewCells = expanded ? cells.length : Math.min(cells.length, 49);
  const previewCols = expanded ? config.cols : Math.min(config.cols, 7);
  const px = expanded ? 24 : 16;

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("rounded-xl border border-white/10 bg-black/25", expanded ? "p-5" : "p-4")}>
        <p className="text-sm font-medium text-zinc-300">Last play outcome</p>
        {lastOutcome ? (
          <div className="mt-3 space-y-3">
            <div className="flex justify-center overflow-auto">
              <div
                className="inline-grid"
                style={{
                  gridTemplateColumns: `repeat(${previewCols}, ${px}px)`,
                  gap: "3px",
                }}
              >
                {cells.slice(0, previewCells).map((cell, i) => (
                  <div
                    key={i}
                    style={{ width: px, height: px }}
                    className={cn(
                      "flex items-center justify-center rounded-md border text-xs",
                      cell === "hidden" && "border-white/10 bg-zinc-800/50",
                      cell === "safe" && "border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
                      cell === "bomb" && "border-red-500/40 bg-red-500/25 text-red-300",
                      selectedIndex === i && "ring-2 ring-violet-400",
                    )}
                  >
                    {cell !== "hidden" ? (cell === "safe" ? "✓" : "💣") : ""}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-sm">
              <span className={lastOutcome.isBomb ? "text-red-400" : "text-emerald-400"}>
                {lastOutcome.isBomb ? "Bomb — user loses stake" : `Safe — round ${lastOutcome.round}`}
              </span>
              {" · "}
              <span className="text-emerald-400">
                User: {lastOutcome.economics.userProfit >= 0 ? "+" : ""}$
                {lastOutcome.economics.userProfit.toFixed(2)}
              </span>
              {" · "}
              <span className="text-red-400">
                Admin: {lastOutcome.economics.adminRevenue >= 0 ? "+" : ""}$
                {lastOutcome.economics.adminRevenue.toFixed(2)}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-center text-sm text-zinc-600">Pick a cell or run auto-play</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Target win %</p>
          <p className={cn("font-bold text-emerald-300", expanded ? "text-3xl" : "text-2xl")}>
            {(targetWinP * 100).toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {config.simulationRounds}× on {config.rows}×{config.cols}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Theoretical EV</p>
          <p
            className={cn(
              "font-bold",
              expanded ? "text-3xl" : "text-2xl",
              theoreticalEv >= 0 ? "text-emerald-300" : "text-red-300",
            )}
          >
            ${theoreticalEv.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Edge {(config.houseEdge * 100).toFixed(1)}%</p>
        </div>
      </div>

      <AdminUserEconomicsBlock variant={variant} />
    </div>
  );
}

export function OutcomeBlocks() {
  return (
    <SimExpandablePanel
      title="Outcome vs theory"
      description="Play results, theory, and live user vs admin economics."
      panelClassName={simPanel}
      dialogClassName="sm:max-w-3xl"
      expandedContent={<OutcomeBlocksInner variant="expanded" />}
    >
      <OutcomeBlocksInner variant="inline" />
    </SimExpandablePanel>
  );
}

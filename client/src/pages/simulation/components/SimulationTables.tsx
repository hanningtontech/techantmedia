import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { simHint, simPanel } from "../simulationStyles";
import type { SimViewVariant } from "../simulationStyles";
import { SimExpandablePanel } from "./SimExpandablePanel";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number, expanded: boolean) {
  return `${(n * 100).toFixed(expanded ? 2 : 1)}%`;
}

function PayoutTableInner({ variant }: { variant: SimViewVariant }) {
  const { payoutTable } = useBlockGameSimulation();
  const expanded = variant === "expanded";
  const text = "text-sm";
  const head = "text-sm";

  return (
    <div className={cn(expanded ? "max-h-none" : "max-h-56 overflow-auto")}>
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className={cn("px-2", head)}>Round</TableHead>
            <TableHead className={cn("px-2 text-right", head)}>Win prob.</TableHead>
            <TableHead className={cn("px-2 text-right", head)}>Multiplier</TableHead>
            <TableHead className={cn("px-2 text-right", head)}>User payout</TableHead>
            <TableHead className={cn("px-2 text-right", head)}>User EV</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payoutTable.map((row) => (
            <TableRow key={row.round} className="border-white/10 hover:bg-white/[0.02]">
              <TableCell className={cn("px-2 py-1.5", text)}>{row.round}</TableCell>
              <TableCell className={cn("px-2 py-1.5 text-right", text)}>
                {fmtPct(row.winProbability, expanded)}
              </TableCell>
              <TableCell className={cn("px-2 py-1.5 text-right", text)}>
                {row.multiplier.toFixed(expanded ? 3 : 2)}×
              </TableCell>
              <TableCell className={cn("px-2 py-1.5 text-right text-emerald-300/90", text)}>
                {fmtMoney(row.potentialBalance)}
              </TableCell>
              <TableCell
                className={cn(
                  "px-2 py-1.5 text-right",
                  text,
                  row.expectedValue >= 0 ? "text-emerald-300/90" : "text-red-300/90",
                )}
              >
                {fmtMoney(row.expectedValue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryInner({ variant }: { variant: SimViewVariant }) {
  const { summary } = useBlockGameSimulation();
  const expanded = variant === "expanded";

  if (!summary) {
    return (
      <p className={cn(simHint, expanded ? "text-sm" : "mt-1")}>
        Run auto-simulation to compare user profit vs admin revenue across many players.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn("grid gap-2", expanded ? "grid-cols-2 sm:grid-cols-4 gap-3" : "grid-cols-2 sm:grid-cols-4")}>
        {[
          ["Total games", summary.gamesPlayed.toLocaleString()],
          ["Players", summary.playerCount.toLocaleString()],
          ["Session winners", summary.playersWinners.toLocaleString(), "text-emerald-300"],
          ["Session losers", summary.playersLosers.toLocaleString(), "text-red-300"],
          ["Total deposited", fmtMoney(summary.totalDeposited)],
          ["Total ending", fmtMoney(summary.totalEndingBalance)],
          ["User net (games)", fmtMoney(summary.userNetProfit), summary.userNetProfit >= 0 ? "text-emerald-300" : "text-red-300"],
          ["Admin revenue", fmtMoney(summary.adminNetRevenue), summary.adminNetRevenue >= 0 ? "text-red-300" : "text-emerald-300"],
          ["RTP", fmtPct(summary.rtp, expanded)],
          ["Wins / losses", `${summary.totalWins.toLocaleString()} / ${summary.totalLosses.toLocaleString()}`],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className={cn(
              "rounded-lg border border-white/5 bg-black/25",
              expanded ? "px-3 py-2.5" : "px-2 py-1.5",
            )}
          >
            <p className={cn("uppercase text-zinc-500", expanded ? "text-xs" : "text-[10px]")}>{label}</p>
            <p className={cn("truncate font-semibold text-zinc-100", expanded ? "text-lg" : "text-sm", color)}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {expanded && summary.playerStats.length > 0 && summary.playerStats.length <= 20 && (
        <div className="max-h-64 overflow-auto rounded-lg border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-sm">Player</TableHead>
                <TableHead className="text-right text-sm">Games</TableHead>
                <TableHead className="text-right text-sm">Wins</TableHead>
                <TableHead className="text-right text-sm text-emerald-400">Net profit</TableHead>
                <TableHead className="text-right text-sm text-red-400">Admin revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.playerStats.map((p) => (
                <TableRow key={p.playerId} className="border-white/10">
                  <TableCell className="text-sm">#{p.playerId + 1}</TableCell>
                  <TableCell className="text-right text-sm">{p.gamesPlayed}</TableCell>
                  <TableCell className="text-right text-sm">{p.wins}</TableCell>
                  <TableCell className="text-right text-sm text-emerald-300">{fmtMoney(p.netProfit)}</TableCell>
                  <TableCell className="text-right text-sm text-red-300">{fmtMoney(-p.netProfit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function SimulationTables() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <SimExpandablePanel
        title="Payout table"
        description="Per-round win probability, multiplier, user payout, and expected value."
        panelClassName={simPanel}
        dialogClassName="sm:max-w-3xl"
        expandedContent={
          <div className="space-y-3">
            <PayoutTableInner variant="expanded" />
            <p className="text-sm text-zinc-500">
              EV = stake × (P(win)×multiplier − 1). Fair linear multipliers target RTP ≈ 1 − house edge.
            </p>
          </div>
        }
      >
        <PayoutTableInner variant="inline" />
      </SimExpandablePanel>

      <SimExpandablePanel
        title="Auto-play summary"
        description="User vs admin results across all simulated players and games."
        panelClassName={simPanel}
        dialogClassName="sm:max-w-3xl"
        expandedContent={<SummaryInner variant="expanded" />}
      >
        <SummaryInner variant="inline" />
      </SimExpandablePanel>
    </section>
  );
}

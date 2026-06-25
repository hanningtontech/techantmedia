import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, ChevronDown } from "lucide-react";
import { AdminCollapsiblePanel } from "@/components/admin/shared/AdminCollapsiblePanel";
import { AdminField } from "@/components/admin/shared/AdminField";
import { Button } from "@/components/ui/button";
import { analyzeAdminPlayerRounds } from "@/lib/game/adminPlayerRoundAnalysis";
import { formatKes } from "@/lib/game/formatKes";
import {
  subscribePlayerRoundsAdmin,
  type BlockGamePlayerRoundDoc,
} from "@/lib/game/playerRevenueFirestore";
import {
  getPlayerRevenuePeriodBounds,
  PLAYER_REVENUE_PERIODS,
  type PlayerRevenuePeriodId,
} from "@/lib/game/playerRevenuePeriods";
import { cn } from "@/lib/utils";

const HEAVY_ROUND_COUNT = 200;

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          tone === "good" && "text-emerald-400",
          tone === "bad" && "text-red-400",
          tone !== "good" && tone !== "bad" && "text-zinc-100",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function UserRoundTable({ rounds }: { rounds: BlockGamePlayerRoundDoc[] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="sticky top-0 bg-zinc-950/95 text-[10px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Outcome</th>
            <th className="px-3 py-2">Grid</th>
            <th className="px-3 py-2 text-right">Stake</th>
            <th className="px-3 py-2 text-right">Payout</th>
            <th className="px-3 py-2 text-right">Player</th>
            <th className="px-3 py-2 text-right">House</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
              <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-400">
                {new Date(r.playedAtMs).toLocaleString()}
              </td>
              <td className="px-3 py-2 capitalize text-zinc-300">{r.outcome.replace("_", " ")}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">
                {r.gridRows}×{r.gridCols}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                {formatKes(r.userStake)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                {formatKes(r.userPayout)}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right tabular-nums",
                  r.userProfit >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {formatKes(r.userProfit)}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right tabular-nums font-medium",
                  r.adminRevenue >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {formatKes(r.adminRevenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  initialPeriod?: PlayerRevenuePeriodId;
  onBack: () => void;
};

export function BlockGamePlayerRoundsAnalysisPanel({
  initialPeriod = "day",
  onBack,
}: Props) {
  const [period, setPeriod] = useState<PlayerRevenuePeriodId>(initialPeriod);
  const [rounds, setRounds] = useState<BlockGamePlayerRoundDoc[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const bounds = useMemo(() => getPlayerRevenuePeriodBounds(period, now), [period, now]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(
    () => subscribePlayerRoundsAdmin(setRounds, bounds.start),
    [bounds.start],
  );

  const analysis = useMemo(
    () => analyzeAdminPlayerRounds(rounds, bounds.start, bounds.end),
    [rounds, bounds.start, bounds.end],
  );

  const { aggregate, outcomes, userBuckets, uniquePlayers } = analysis;
  const heavyList = outcomes.totalRounds >= HEAVY_ROUND_COUNT;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-zinc-100"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to revenue
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <BarChart3 className="h-3.5 w-3.5 text-violet-400" />
          Full round analysis · real players only
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {PLAYER_REVENUE_PERIODS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={period === p.id ? "default" : "outline"}
            className={cn(
              period === p.id
                ? "bg-violet-600 hover:bg-violet-500"
                : "border-white/15 bg-transparent text-zinc-300",
            )}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <p className="text-sm text-zinc-400">
        {bounds.label}: {outcomes.totalRounds.toLocaleString()} rounds ·{" "}
        {uniquePlayers.toLocaleString()} player{uniquePlayers === 1 ? "" : "s"}
      </p>

      {heavyList && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          Large list ({outcomes.totalRounds.toLocaleString()} rounds). Use <strong>Hour</strong> or{" "}
          <strong>Day</strong> for faster loads — only data from the selected window is fetched from
          Firestore.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Player wins"
          value={outcomes.wins.toLocaleString()}
          sub="Full grid cleared"
          tone="good"
        />
        <StatCard
          label="Player losses"
          value={outcomes.losses.toLocaleString()}
          sub="Hit a bomb"
          tone="bad"
        />
        <StatCard
          label="Cash-outs"
          value={outcomes.cashedOut.toLocaleString()}
          sub={outcomes.stopped > 0 ? `${outcomes.stopped} stopped early` : "Withdrawn mid-round"}
          tone="neutral"
        />
        <StatCard
          label="Players net"
          value={formatKes(outcomes.userNet)}
          sub={`House ${formatKes(aggregate.adminNet)}`}
          tone={outcomes.userNet >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total staked"
          value={formatKes(outcomes.totalStaked)}
          sub={`${outcomes.totalRounds} rounds`}
        />
        <StatCard
          label="Total paid out"
          value={formatKes(outcomes.totalPayout)}
          sub="Player withdrawals + wins"
        />
        <StatCard
          label="House round record"
          value={`${aggregate.houseWinRounds}W · ${aggregate.houseLossRounds}L`}
          sub={
            aggregate.breakEvenRounds > 0
              ? `${aggregate.breakEvenRounds} break-even`
              : "By house P&L per round"
          }
        />
      </div>

      <AdminField label={`Players · ${bounds.label}`} fieldSize="full">
        {userBuckets.length === 0 ? (
          <p className="text-sm text-zinc-500">No rounds in this time window.</p>
        ) : (
          <div className="space-y-2">
            {userBuckets.map((bucket) => {
              const { stats } = bucket;
              const playerUp = stats.userNet >= 0;
              return (
                <AdminCollapsiblePanel
                  key={bucket.uid}
                  title={bucket.displayName}
                  subtitle={
                    bucket.userEmail && bucket.userName
                      ? bucket.userEmail
                      : bucket.uid.slice(0, 12)
                  }
                  badge={`${stats.totalRounds} round${stats.totalRounds === 1 ? "" : "s"}`}
                  accent={playerUp ? "teal" : "orange"}
                >
                  <div className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[10px] uppercase text-zinc-500">Wins / losses</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">
                          <span className="text-emerald-400">{stats.wins}</span>
                          <span className="text-zinc-600"> / </span>
                          <span className="text-red-400">{stats.losses}</span>
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[10px] uppercase text-zinc-500">Cash-outs</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">
                          {stats.cashedOut}
                          {stats.stopped > 0 ? (
                            <span className="ml-1 text-xs font-normal text-zinc-500">
                              (+{stats.stopped} stopped)
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[10px] uppercase text-zinc-500">Player net</p>
                        <p
                          className={cn(
                            "mt-0.5 text-sm font-semibold tabular-nums",
                            playerUp ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {formatKes(stats.userNet)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[10px] uppercase text-zinc-500">Staked</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">
                          {formatKes(stats.totalStaked)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1 text-xs font-medium text-zinc-400">
                        <ChevronDown className="h-3.5 w-3.5" />
                        Round-by-round progress
                      </p>
                      <UserRoundTable rounds={bucket.rounds} />
                    </div>
                  </div>
                </AdminCollapsiblePanel>
              );
            })}
          </div>
        )}
      </AdminField>
    </div>
  );
}

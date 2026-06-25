import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus, Radio } from "lucide-react";
import { BlockGamePlayerRoundsAnalysisPanel } from "./BlockGamePlayerRoundsAnalysisPanel";
import { AdminField } from "@/components/admin/shared/AdminField";
import { Button } from "@/components/ui/button";
import { formatKes } from "@/lib/game/formatKes";
import {
  aggregatePlayerRounds,
  subscribePlayerRevenueSummary,
  subscribePlayerRoundsAdmin,
  type BlockGamePlayerRoundDoc,
  type PlayerRevenueSummaryDoc,
} from "@/lib/game/playerRevenueFirestore";
import {
  getPlayerRevenuePeriodBounds,
  PLAYER_REVENUE_PERIODS,
  type PlayerRevenuePeriodId,
} from "@/lib/game/playerRevenuePeriods";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "up" | "down" | "neutral";
}) {
  const toneClass =
    tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-300";
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", toneClass)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function houseTone(net: number): "up" | "down" | "neutral" {
  if (net > 0) return "up";
  if (net < 0) return "down";
  return "neutral";
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
        <Minus className="h-3 w-3" /> No change vs prior period
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        up ? "text-emerald-400" : "text-red-400",
      )}
    >
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {formatKes(delta)} vs prior period
    </span>
  );
}

export function BlockGamePlayerRevenuePanel() {
  const [period, setPeriod] = useState<PlayerRevenuePeriodId>("day");
  const [compare, setCompare] = useState(true);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [rounds, setRounds] = useState<BlockGamePlayerRoundDoc[]>([]);
  const [summary, setSummary] = useState<PlayerRevenueSummaryDoc | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const bounds = useMemo(() => getPlayerRevenuePeriodBounds(period, now), [period, now]);

  useEffect(
    () => subscribePlayerRoundsAdmin(setRounds, bounds.start),
    [bounds.start],
  );
  useEffect(() => subscribePlayerRevenueSummary(setSummary), []);

  const current = useMemo(
    () => aggregatePlayerRounds(rounds, bounds.start, bounds.end),
    [rounds, bounds.start, bounds.end],
  );

  const previous = useMemo(
    () => aggregatePlayerRounds(rounds, bounds.prevStart, bounds.prevEnd),
    [rounds, bounds.prevStart, bounds.prevEnd],
  );

  const recentInPeriod = useMemo(
    () =>
      rounds
        .filter((r) => r.playedAtMs >= bounds.start && r.playedAtMs <= bounds.end)
        .slice(0, 40),
    [rounds, bounds.start, bounds.end],
  );

  const houseAhead = current.adminNet >= 0;

  if (showFullAnalysis) {
    return (
      <BlockGamePlayerRoundsAnalysisPanel
        initialPeriod={period}
        onBack={() => setShowFullAnalysis(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          <Radio className="h-3 w-3 animate-pulse" />
          Live · real players only
        </span>
        {summary && (
          <span className="text-xs text-zinc-500">
            All-time house net:{" "}
            <span
              className={cn(
                "font-semibold tabular-nums",
                summary.totalAdminRevenue >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {formatKes(summary.totalAdminRevenue)}
            </span>
            {" · "}
            {summary.totalGames.toLocaleString()} rounds
          </span>
        )}
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
        <Button
          type="button"
          size="sm"
          variant={compare ? "secondary" : "outline"}
          className="border-white/15"
          onClick={() => setCompare((c) => !c)}
        >
          {compare ? "Comparing periods" : "Compare periods"}
        </Button>
      </div>

      <div
        className={cn(
          "rounded-xl border px-4 py-3",
          houseAhead
            ? "border-emerald-500/25 bg-emerald-500/5"
            : "border-red-500/25 bg-red-500/5",
        )}
      >
        <p className="text-sm font-medium text-zinc-200">
          {bounds.label}:{" "}
          {houseAhead ? (
            <span className="text-emerald-300">House is ahead</span>
          ) : current.adminNet < 0 ? (
            <span className="text-red-300">House is behind (players winning)</span>
          ) : (
            <span className="text-zinc-400">Break even</span>
          )}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
          {formatKes(current.adminNet)}
          <span className="ml-2 text-sm font-normal text-zinc-500">house net</span>
        </p>
        {compare && <div className="mt-2"><DeltaBadge current={current.adminNet} previous={previous.adminNet} /></div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="House net"
          value={formatKes(current.adminNet)}
          sub={`${current.houseWinRounds} winning · ${current.houseLossRounds} losing rounds`}
          tone={houseTone(current.adminNet)}
        />
        <StatCard
          label="Players net"
          value={formatKes(current.userNet)}
          sub="Opposite of house for the period"
          tone={houseTone(-current.userNet)}
        />
        <StatCard
          label="Rounds played"
          value={current.rounds.toLocaleString()}
          sub={`${formatKes(current.totalStaked)} staked`}
          tone="neutral"
        />
        {compare && (
          <StatCard
            label={bounds.prevLabel}
            value={formatKes(previous.adminNet)}
            sub={`${previous.rounds} rounds · house ${previous.adminNet >= 0 ? "ahead" : "behind"}`}
            tone={houseTone(previous.adminNet)}
          />
        )}
      </div>

      {compare && (
        <AdminField label="Period comparison" fieldSize="full">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs font-medium text-zinc-400">{bounds.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
                {formatKes(current.adminNet)}
              </p>
              <p className="text-xs text-zinc-500">
                {current.rounds} rounds · players {formatKes(current.userNet)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs font-medium text-zinc-400">{bounds.prevLabel}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
                {formatKes(previous.adminNet)}
              </p>
              <p className="text-xs text-zinc-500">
                {previous.rounds} rounds · players {formatKes(previous.userNet)}
              </p>
            </div>
          </div>
        </AdminField>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-300">Recent rounds · {bounds.label}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
            onClick={() => setShowFullAnalysis(true)}
          >
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Full list analysis
          </Button>
        </div>
        {recentInPeriod.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No real-player rounds in this period yet. Revenue appears when signed-in users finish games at{" "}
            <a href="/game" className="text-violet-400 hover:underline" target="_blank" rel="noreferrer">
              /game
            </a>
            . Simulation is excluded.
          </p>
        ) : (
          <div className="max-h-80 overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-zinc-950/95 text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Outcome</th>
                  <th className="px-3 py-2 text-right">Stake</th>
                  <th className="px-3 py-2 text-right">Player</th>
                  <th className="px-3 py-2 text-right">House</th>
                </tr>
              </thead>
              <tbody>
                {recentInPeriod.map((r) => {
                  const houseLost = r.adminRevenue < 0;
                  return (
                    <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-400">
                        {new Date(r.playedAtMs).toLocaleString()}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-zinc-300">
                        {r.userName || r.userEmail || r.uid.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 capitalize text-zinc-400">{r.outcome.replace("_", " ")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                        {formatKes(r.userStake)}
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
                          houseLost ? "text-red-400" : "text-emerald-400",
                        )}
                      >
                        {formatKes(r.adminRevenue)}
                        {houseLost && (
                          <span className="ml-1 text-[10px] font-normal text-red-300/80">loss</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

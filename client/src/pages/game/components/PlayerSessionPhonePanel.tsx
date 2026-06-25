import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import {
  outcomeLabel,
  PLAYER_SESSION_ANALYSIS_PATH,
  type PlayerSessionRecord,
} from "@/lib/game/playerSessionHistory";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SessionHistorySummary({ className }: { className?: string }) {
  const { sessionHistory, formatKes, gamesPlayed } = useBlockGamePlayer();
  const sessionNet = sessionHistory.reduce((s, r) => s + r.netProfit, 0);

  return (
    <div className={cn("rounded-xl border border-white/10 bg-black/30 px-3 py-2.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-100">
          {gamesPlayed.toLocaleString()} round{gamesPlayed === 1 ? "" : "s"}
        </p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            sessionNet >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          Net {sessionNet >= 0 ? "+" : ""}
          {formatKes(sessionNet)}
        </p>
      </div>
    </div>
  );
}

function formatPhoneTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function SessionRoundCard({
  record,
  formatKes,
}: {
  record: PlayerSessionRecord;
  formatKes: (n: number, opts?: { compact?: boolean }) => string;
}) {
  const positive = record.netProfit >= 0;

  return (
    <article className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">Round #{record.gameIndex}</p>
          <p className="text-[11px] text-zinc-500">{formatPhoneTime(record.playedAt)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold capitalize",
            positive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
          )}
        >
          {outcomeLabel(record.outcome)}
        </span>
      </div>

      <p className="mb-2 text-[11px] text-zinc-500">
        {record.gridLabel} · R{record.round} · ×{record.multiplier.toFixed(2)}
        {record.bombCount != null ? ` · ${record.bombCount} bombs` : ""}
      </p>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/5 bg-black/25 p-2">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-zinc-600">Stake</p>
          <p className="text-xs font-semibold tabular-nums text-zinc-300">{formatKes(record.stake)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-zinc-600">Payout</p>
          <p className="text-xs font-semibold tabular-nums text-zinc-300">{formatKes(record.payout)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-zinc-600">Net</p>
          <p
            className={cn(
              "text-xs font-semibold tabular-nums",
              positive ? "text-emerald-300" : "text-red-300",
            )}
          >
            {record.netProfit >= 0 ? "+" : ""}
            {formatKes(record.netProfit)}
          </p>
        </div>
      </div>

      <p className="mt-2 text-right text-[11px] text-zinc-500">
        Balance after{" "}
        <span className="font-semibold tabular-nums text-zinc-300">
          {formatKes(record.endingBalance)}
        </span>
      </p>
    </article>
  );
}

/** Phone-optimized session history — stacked cards, full scroll. */
export function PlayerSessionPhonePanel() {
  const { sessionHistory, formatKes } = useBlockGamePlayer();
  const [, setLocation] = useLocation();
  const rows = [...sessionHistory].reverse();

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <SessionHistorySummary />
        <div className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-zinc-500">
          No rounds yet. Play a round to see your payout history here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SessionHistorySummary />
      <Button
        type="button"
        variant="outline"
        className="w-full border-violet-500/25 text-violet-200"
        onClick={() => setLocation(PLAYER_SESSION_ANALYSIS_PATH)}
      >
        Open full analysis
      </Button>
      <div className="space-y-2.5">
        {rows.map((record) => (
          <SessionRoundCard key={record.id} record={record} formatKes={formatKes} />
        ))}
      </div>
    </div>
  );
}

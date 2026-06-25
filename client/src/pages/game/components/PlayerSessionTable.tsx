import { useMemo } from "react";
import { useLocation } from "wouter";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import {
  DESKTOP_PREVIEW_ROWS,
  outcomeLabel,
  PLAYER_SESSION_ANALYSIS_PATH,
  PLAYER_SESSION_HISTORY_PATH,
  type PlayerSessionRecord,
} from "@/lib/game/playerSessionHistory";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function SessionRow({
  record,
  rowH,
  formatKes,
}: {
  record: PlayerSessionRecord | null;
  rowH: number;
  formatKes: (n: number, opts?: { compact?: boolean }) => string;
}) {
  if (!record) {
    return (
      <div
        className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2 border-b border-white/5 px-2 text-zinc-700"
        style={{ minHeight: rowH }}
      >
        <span>—</span>
        <span>—</span>
        <span>—</span>
        <span>—</span>
      </div>
    );
  }

  const positive = record.netProfit >= 0;
  return (
    <div
      className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2 border-b border-white/5 px-2 text-zinc-300"
      style={{ minHeight: rowH }}
    >
      <span className="text-[11px] tabular-nums text-zinc-500">#{record.gameIndex}</span>
      <span
        className={cn(
          "truncate text-[11px] font-medium capitalize",
          positive ? "text-emerald-300" : "text-red-300",
        )}
      >
        {outcomeLabel(record.outcome)}
      </span>
      <span className="truncate text-right text-[11px] tabular-nums">
        {record.netProfit >= 0 ? "+" : ""}
        {formatKes(record.netProfit, { compact: true })}
      </span>
      <span className="truncate text-right text-[11px] tabular-nums text-zinc-400">
        {formatKes(record.endingBalance, { compact: true })}
      </span>
    </div>
  );
}

/** Desktop payout preview — height tracks the grid column. */
export function PlayerSessionTable({ targetHeight }: { targetHeight: number }) {
  const { sessionHistory, formatKes, gamesPlayed } = useBlockGamePlayer();
  const [, setLocation] = useLocation();

  const preview = useMemo(
    () => sessionHistory.slice(-DESKTOP_PREVIEW_ROWS).reverse(),
    [sessionHistory],
  );

  const rowSlots = Math.max(DESKTOP_PREVIEW_ROWS, 6);
  const headerH = 52;
  const footerH = 44;
  const bodyH = Math.max(120, targetHeight - headerH - footerH);
  const rowH = Math.max(26, Math.min(56, Math.floor(bodyH / rowSlots)));

  const rows: (PlayerSessionRecord | null)[] = [];
  for (let i = 0; i < rowSlots; i++) {
    rows.push(preview[i] ?? null);
  }

  const sessionNet = sessionHistory.reduce((s, r) => s + r.netProfit, 0);

  return (
    <div
      className="flex h-full min-h-[200px] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-black/80 shadow-lg"
      style={{ minHeight: targetHeight }}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Session table</p>
          <p className="text-sm font-semibold text-zinc-100">
            {gamesPlayed.toLocaleString()} round{gamesPlayed === 1 ? "" : "s"}
          </p>
          <p
            className={cn(
              "text-xs tabular-nums",
              sessionNet >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            Net {sessionNet >= 0 ? "+" : ""}
            {formatKes(sessionNet)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-white/15 text-xs text-zinc-300"
            onClick={() => setLocation(PLAYER_SESSION_HISTORY_PATH)}
          >
            Full history
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-violet-500/25 text-xs text-violet-200"
            onClick={() => setLocation(PLAYER_SESSION_ANALYSIS_PATH)}
          >
            Analysis
          </Button>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-[2.5rem_1fr_1fr_1fr] gap-2 border-b border-white/10 px-2 py-1.5 text-[9px] font-medium uppercase tracking-wide text-zinc-600">
        <span>#</span>
        <span>Result</span>
        <span className="text-right">Net</span>
        <span className="text-right">Balance</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((record, i) => (
          <SessionRow key={record?.id ?? `empty-${i}`} record={record} rowH={rowH} formatKes={formatKes} />
        ))}
      </div>

      {preview[0] && (
        <p className="shrink-0 border-t border-white/5 px-3 py-2 text-[10px] text-zinc-600">
          Latest {formatTime(preview[0].playedAt)} · {preview[0].gridLabel} · R{preview[0].round}
        </p>
      )}
    </div>
  );
}

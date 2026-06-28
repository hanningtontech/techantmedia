import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AdaptiveKesAmount } from "@/components/game/AdaptiveKesAmount";
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
  compact,
}: {
  record: PlayerSessionRecord | null;
  rowH: number;
  compact?: boolean;
}) {
  const text = compact ? "text-[9px]" : "text-[11px]";
  const cols = compact ? "grid-cols-[1.75rem_1fr_1fr_1fr]" : "grid-cols-[2.5rem_1fr_1fr_1fr]";

  if (!record) {
    return (
      <div
        className={cn("grid items-center gap-1 border-b border-white/5 px-1.5 text-zinc-700", cols)}
        style={{ height: rowH }}
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
      className={cn("grid items-center gap-1 border-b border-white/5 px-1.5 text-zinc-300", cols)}
      style={{ height: rowH }}
    >
      <span className={cn(text, "tabular-nums text-zinc-500")}>#{record.gameIndex}</span>
      <span
        className={cn(
          "truncate font-medium capitalize",
          text,
          positive ? "text-emerald-300" : "text-red-300",
        )}
      >
        {outcomeLabel(record.outcome)}
      </span>
      <span className={cn("truncate text-right tabular-nums", text)}>
        <AdaptiveKesAmount amount={record.netProfit} signed omitCurrency={compact} className="inline" />
      </span>
      <span className={cn("truncate text-right tabular-nums text-zinc-400", text)}>
        <AdaptiveKesAmount amount={record.endingBalance} omitCurrency={compact} className="inline" />
      </span>
    </div>
  );
}

/** Desktop payout preview — height tracks the grid column, or fills parent when compact. */
export function PlayerSessionTable({
  targetHeight,
  compact = false,
  fixedHeight,
  fillParent = false,
  className,
}: {
  targetHeight?: number;
  compact?: boolean;
  /** Pin table height to match the play board tray (short-laptop layout). */
  fixedHeight?: number;
  /** Flex child: measure parent height and size rows to fill (desktop sidebar). */
  fillParent?: boolean;
  className?: string;
}) {
  const { sessionHistory, gamesPlayed } = useBlockGamePlayer();
  const [, setLocation] = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(0);

  useEffect(() => {
    if (fixedHeight != null || (!compact && !fillParent)) return;
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setContainerH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, fillParent, fixedHeight]);

  const preview = useMemo(
    () => sessionHistory.slice(-DESKTOP_PREVIEW_ROWS).reverse(),
    [sessionHistory],
  );

  const rowSlots = compact ? 5 : Math.max(DESKTOP_PREVIEW_ROWS, 6);
  const headerH = compact ? 34 : 52;
  const colHeaderH = compact ? 18 : 28;
  const footerH = compact ? 0 : 44;
  const resolvedHeight =
    fixedHeight != null
      ? fixedHeight
      : compact || fillParent
        ? containerH
        : (targetHeight ?? 320);
  const bodyH = Math.max(compact ? 48 : 120, resolvedHeight - headerH - colHeaderH - footerH);
  const rowH = Math.max(compact ? 18 : 26, Math.min(compact ? 28 : 56, Math.floor(bodyH / rowSlots)));

  const rows: (PlayerSessionRecord | null)[] = [];
  for (let i = 0; i < rowSlots; i++) {
    rows.push(preview[i] ?? null);
  }

  const sessionNet = sessionHistory.reduce((s, r) => s + r.netProfit, 0);

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-black/80 shadow-lg",
        fixedHeight != null
          ? "shrink-0"
          : compact || fillParent
            ? "h-full min-h-0"
            : "h-full min-h-[200px]",
        className,
      )}
      style={
        fixedHeight != null
          ? { height: fixedHeight }
          : compact || fillParent
            ? undefined
            : { minHeight: targetHeight }
      }
    >
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-1.5 border-b border-white/10",
          compact ? "px-2 py-1.5" : "px-3 py-2.5",
        )}
      >
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">Session table</p>
          <p className={cn("font-semibold text-zinc-100", compact ? "text-[11px] leading-tight" : "text-sm")}>
            {gamesPlayed.toLocaleString()} round{gamesPlayed === 1 ? "" : "s"}
            {compact && preview[0] ? (
              <span className="ml-1 font-normal text-zinc-500">· {formatTime(preview[0].playedAt)}</span>
            ) : null}
          </p>
          <p
            className={cn(
              "tabular-nums",
              compact ? "text-[10px]" : "text-xs",
              sessionNet >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            Net{" "}
            <AdaptiveKesAmount
              amount={sessionNet}
              signed
              omitCurrency={compact}
              className={cn(sessionNet >= 0 ? "text-emerald-400" : "text-red-400")}
            />
          </p>
        </div>
        <div className={cn("flex shrink-0", compact ? "flex-row gap-1" : "flex-col gap-1")}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "shrink-0 border-white/15 text-zinc-300",
              compact ? "h-6 px-1.5 text-[9px]" : "h-8 text-xs",
            )}
            onClick={() => setLocation(PLAYER_SESSION_HISTORY_PATH)}
          >
            History
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "shrink-0 border-violet-500/25 text-violet-200",
              compact ? "h-6 px-1.5 text-[9px]" : "h-8 text-xs",
            )}
            onClick={() => setLocation(PLAYER_SESSION_ANALYSIS_PATH)}
          >
            Analysis
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 grid gap-1 border-b border-white/10 px-1.5 font-medium uppercase tracking-wide text-zinc-600",
          compact ? "grid-cols-[1.75rem_1fr_1fr_1fr] py-1 text-[8px]" : "grid-cols-[2.5rem_1fr_1fr_1fr] py-1.5 text-[9px]",
        )}
      >
        <span>#</span>
        <span>Result</span>
        <span className="text-right">Net</span>
        <span className="text-right">Balance</span>
      </div>

      <div className={cn("min-h-0 flex-1", compact ? "overflow-hidden" : "overflow-y-auto")}>
        {rows.map((record, i) => (
          <SessionRow
            key={record?.id ?? `empty-${i}`}
            record={record}
            rowH={rowH}
            compact={compact}
          />
        ))}
      </div>

      {!compact && preview[0] && (
        <p className="shrink-0 border-t border-white/5 px-3 py-2 text-[10px] text-zinc-600">
          Latest {formatTime(preview[0].playedAt)} · {preview[0].gridLabel} · R{preview[0].round}
        </p>
      )}
    </div>
  );
}

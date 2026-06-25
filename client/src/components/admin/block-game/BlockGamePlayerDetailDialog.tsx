import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { computePlayerOutcomeStats } from "@/lib/game/adminPlayerRoundAnalysis";
import {
  fetchPlayerRoundsForPeriod,
  fetchPlayerRoundsPage,
  type BlockGamePlayerDoc,
} from "@/lib/game/blockGamePlayersFirestore";
import { formatKes } from "@/lib/game/formatKes";
import type { BlockGamePlayerRoundDoc } from "@/lib/game/playerRevenueFirestore";
import { filterRoundsByPeriod } from "@/lib/game/playerRoundSchema";
import {
  getPlayerRevenuePeriodBounds,
  PLAYER_DETAIL_PERIODS,
  type PlayerRevenuePeriodId,
} from "@/lib/game/playerRevenuePeriods";
import { cn } from "@/lib/utils";
import type { QueryDocumentSnapshot } from "firebase/firestore";

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "good" && "text-emerald-400",
          tone === "bad" && "text-red-400",
          tone !== "good" && tone !== "bad" && "text-zinc-100",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RoundsTable({ rounds }: { rounds: BlockGamePlayerRoundDoc[] }) {
  if (rounds.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No rounds in this period.</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
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
  player: BlockGamePlayerDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPeriod?: PlayerRevenuePeriodId;
};

export function BlockGamePlayerDetailDialog({
  player,
  open,
  onOpenChange,
  initialPeriod = "all",
}: Props) {
  const [period, setPeriod] = useState<PlayerRevenuePeriodId>(initialPeriod);
  const [loadedRounds, setLoadedRounds] = useState<BlockGamePlayerRoundDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const bounds = useMemo(() => getPlayerRevenuePeriodBounds(period, now), [period, now]);

  const periodRounds = useMemo(
    () => filterRoundsByPeriod(loadedRounds, bounds.start, bounds.end),
    [loadedRounds, bounds.start, bounds.end],
  );

  const periodStats = useMemo(() => computePlayerOutcomeStats(periodRounds), [periodRounds]);

  const lifetimeStats = useMemo(() => {
    if (!player) return null;
    const s = player.stats;
    return {
      rounds: s.rounds,
      wins: s.wins,
      losses: s.losses,
      userNet: s.userProfit,
      staked: s.staked,
      adminNet: s.adminRevenue,
    };
  }, [player]);

  const displayStats =
    period === "all" && lifetimeStats && periodRounds.length === 0 && !loading
      ? {
          totalRounds: lifetimeStats.rounds,
          wins: lifetimeStats.wins,
          losses: lifetimeStats.losses,
          userNet: lifetimeStats.userNet,
          totalStaked: lifetimeStats.staked,
          adminNet: lifetimeStats.adminNet,
          fromProfile: true,
        }
      : {
          totalRounds: periodStats.totalRounds,
          wins: periodStats.wins,
          losses: periodStats.losses,
          userNet: periodStats.userNet,
          totalStaked: periodStats.totalStaked,
          adminNet: periodStats.adminNet,
          fromProfile: false,
        };

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (open) setPeriod(initialPeriod);
  }, [open, initialPeriod]);

  const loadInitial = useCallback(async () => {
    if (!player) return;
    setLoading(true);
    setFetchError(null);
    setLoadedRounds([]);
    setLastDoc(null);
    setHasMore(false);
    try {
      if (period === "all") {
        const result = await fetchPlayerRoundsPage(player.uid, {});
        setLoadedRounds(result.rounds);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } else {
        const result = await fetchPlayerRoundsForPeriod(player.uid, bounds.start, bounds.end);
        setLoadedRounds(result.rounds);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load rounds.");
    } finally {
      setLoading(false);
    }
  }, [player, period, bounds.start, bounds.end]);

  const loadMore = useCallback(async () => {
    if (!player || !hasMore) return;
    setLoadingMore(true);
    setFetchError(null);
    try {
      const result = await fetchPlayerRoundsPage(player.uid, { afterDoc: lastDoc });
      setLoadedRounds((prev) => [...prev, ...result.rounds]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load more rounds.");
    } finally {
      setLoadingMore(false);
    }
  }, [player, hasMore, lastDoc]);

  useEffect(() => {
    if (!open || !player) return;
    void loadInitial();
  }, [open, player?.uid, period, bounds.start, bounds.end, loadInitial]);

  const displayName = player?.userName || player?.userEmail || player?.uid.slice(0, 12) || "Player";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/70"
        className={cn(
          "flex max-h-[90vh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden",
          "border-white/10 bg-[#0a0a0f] p-0 text-zinc-100 sm:max-w-[90vw]",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-4 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl text-zinc-50">{displayName}</DialogTitle>
              <DialogDescription className="mt-1 text-zinc-500">
                {player?.userEmail || player?.uid}
                {player?.registeredAt
                  ? ` · Registered ${new Date(player.registeredAt).toLocaleDateString()}`
                  : null}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-zinc-400 hover:text-zinc-100"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {player && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-4 border-b border-white/10 px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {PLAYER_DETAIL_PERIODS.map((p) => (
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

              <p className="text-xs text-zinc-500">
                {bounds.label} · Lifetime {player.stats.rounds.toLocaleString()} rounds · Player net{" "}
                <span className={player.stats.userProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {formatKes(player.stats.userProfit)}
                </span>
                {" · "}House net{" "}
                <span className={player.stats.adminRevenue >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {formatKes(player.stats.adminRevenue)}
                </span>
              </p>

              {displayStats.fromProfile && (
                <p className="text-xs text-amber-400/90">
                  Round documents are not in Firestore yet — showing lifetime totals from the player profile
                  (synced from wallet). New games will appear here as individual rounds.
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <StatChip label="Rounds" value={displayStats.totalRounds.toLocaleString()} />
                <StatChip
                  label="Wins / losses"
                  value={`${displayStats.wins} / ${displayStats.losses}`}
                />
                <StatChip
                  label="Player net"
                  value={formatKes(displayStats.userNet)}
                  tone={displayStats.userNet >= 0 ? "good" : "bad"}
                />
                <StatChip
                  label="House net"
                  value={formatKes(displayStats.adminNet)}
                  tone={displayStats.adminNet >= 0 ? "good" : "bad"}
                />
                <StatChip label="Staked" value={formatKes(displayStats.totalStaked)} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
              {fetchError && (
                <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {fetchError}
                </p>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-16 text-violet-400">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <RoundsTable rounds={periodRounds} />
                  {hasMore && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/15 text-zinc-300"
                        disabled={loadingMore}
                        onClick={() => void loadMore()}
                      >
                        {loadingMore ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Load more rounds
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

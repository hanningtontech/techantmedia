import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Loader2, Search, Users } from "lucide-react";
import { Link, useSearch } from "wouter";
import { BlockGamePlayerDetailDialog } from "@/components/admin/block-game/BlockGamePlayerDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BLOCK_GAME_PLAYERS_ANALYSIS_PATH,
  fetchBlockGamePlayersPage,
  type BlockGamePlayerDoc,
} from "@/lib/game/blockGamePlayersFirestore";
import { formatKes } from "@/lib/game/formatKes";
import {
  getPlayerRevenuePeriodBounds,
  PLAYER_REVENUE_PERIODS,
  type PlayerRevenuePeriodId,
} from "@/lib/game/playerRevenuePeriods";
import { canAccessNavId } from "@/lib/admin/adminPermissions";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { cn } from "@/lib/utils";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import "@/styles/admin-portfolio.css";

export default function BlockGamePlayersAnalysisPage() {
  const { user, profile, loading: authLoading, firebaseReady } = useFirebaseAuth();
  const searchParams = useSearch();
  const initialPeriod = useMemo((): PlayerRevenuePeriodId => {
    const raw = new URLSearchParams(searchParams).get("period");
    if (raw === "hour" || raw === "day" || raw === "week" || raw === "month") return raw;
    return "month";
  }, [searchParams]);
  const [period, setPeriod] = useState<PlayerRevenuePeriodId>(initialPeriod);
  const [players, setPlayers] = useState<BlockGamePlayerDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BlockGamePlayerDoc | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setPeriod(initialPeriod);
  }, [initialPeriod]);

  const allowed = canAccessNavId("offpages.blockGame", profile, user?.email);
  const bounds = useMemo(() => getPlayerRevenuePeriodBounds(period, now), [period, now]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const loadPlayers = useCallback(async (reset: boolean) => {
    if (reset) {
      setLoading(true);
      setPlayers([]);
      setLastDoc(null);
      setHasMore(false);
    } else {
      setLoadingMore(true);
    }
    try {
      const result = await fetchBlockGamePlayersPage({
        afterDoc: reset ? null : lastDoc,
      });
      setPlayers((prev) => (reset ? result.players : [...prev, ...result.players]));
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastDoc]);

  useEffect(() => {
    if (!allowed || authLoading) return;
    void loadPlayers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, authLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.userName.toLowerCase().includes(q) ||
        p.userEmail.toLowerCase().includes(q) ||
        p.uid.toLowerCase().includes(q),
    );
  }, [players, search]);

  const openPlayer = (player: BlockGamePlayerDoc) => {
    setSelected(player);
    setDetailOpen(true);
  };

  if (!firebaseReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06060a] text-zinc-500">
        Firebase is not configured.
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06060a] text-violet-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || profile?.role !== "admin" || !allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#06060a] p-6 text-zinc-400">
        <p>Admin access required.</p>
        <Link href="/admin">
          <a className="text-violet-400 hover:underline">Back to admin</a>
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-portfolio-root min-h-screen bg-[#06060a] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08080c]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin">
              <a className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
                <ArrowLeft className="h-4 w-4" />
                Admin
              </a>
            </Link>
            <div className="hidden h-4 w-px bg-white/10 sm:block" />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
                <BarChart3 className="h-5 w-5 text-violet-400" />
                Block game · Player analysis
              </h1>
              <p className="text-xs text-zinc-500">
                All registered players and gaming history · {bounds.label}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-300">
            <Users className="h-3 w-3" />
            {players.length}
            {hasMore ? "+" : ""} loaded
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
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
          Click a player to open their full record. Round history loads in small pages — use{" "}
          <strong className="font-medium text-zinc-300">Load more</strong> inside the detail view.
        </p>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or UID…"
            className="border-white/10 bg-black/40 pl-9 text-zinc-100"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-violet-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-zinc-950/80 px-6 py-16 text-center text-zinc-500">
            {search.trim()
              ? "No players match your search on the loaded pages."
              : "No registered block-game players yet. Players appear when they sign up at /game."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/50">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-zinc-950/95 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3">Last played</th>
                    <th className="px-4 py-3 text-right">Rounds</th>
                    <th className="px-4 py-3 text-right">Staked</th>
                    <th className="px-4 py-3 text-right">Player net</th>
                    <th className="px-4 py-3 text-right">House net</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const playerUp = p.totalUserProfit >= 0;
                    return (
                      <tr
                        key={p.uid}
                        className="cursor-pointer border-t border-white/5 transition-colors hover:bg-violet-500/[0.06]"
                        onClick={() => openPlayer(p)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-100">
                            {p.userName || p.userEmail || `${p.uid.slice(0, 10)}…`}
                          </p>
                          <p className="text-xs text-zinc-500">{p.userEmail || p.uid}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">
                          {p.registeredAt ? new Date(p.registeredAt).toLocaleString() : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">
                          {p.lastPlayedAt ? new Date(p.lastPlayedAt).toLocaleString() : "Never"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {p.totalRounds.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                          {formatKes(p.totalStaked)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right tabular-nums font-medium",
                            playerUp ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {formatKes(p.totalUserProfit)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right tabular-nums font-medium",
                            p.totalAdminRevenue >= 0 ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {formatKes(p.totalAdminRevenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasMore && !search.trim() && (
          <div className="flex justify-center pb-8">
            <Button
              type="button"
              variant="outline"
              className="border-white/15 text-zinc-300"
              disabled={loadingMore}
              onClick={() => void loadPlayers(false)}
            >
              {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Load more players
            </Button>
          </div>
        )}
      </main>

      <BlockGamePlayerDetailDialog
        player={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        initialPeriod={period}
      />
    </div>
  );
}

export { BLOCK_GAME_PLAYERS_ANALYSIS_PATH };

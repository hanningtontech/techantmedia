import { ArrowLeft, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PageSeo } from "@/components/seo/PageSeo";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { BlockGamePlayerProvider, useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import {
  outcomeLabel,
  PLAYER_SESSION_ANALYSIS_PATH,
  PLAYER_SESSION_HISTORY_PATH,
} from "@/lib/game/playerSessionHistory";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { GameAuthGate } from "./components/GameAuthGate";

function SessionHistoryContent() {
  const { sessionHistory, formatKes, gamesPlayed } = useBlockGamePlayer();
  const [, setLocation] = useLocation();
  const rows = [...sessionHistory].reverse();
  const sessionNet = sessionHistory.reduce((s, r) => s + r.netProfit, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 text-zinc-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            className="mb-2 -ml-2 text-zinc-400 hover:text-zinc-100"
            onClick={() => setLocation("/game")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to game
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Session history</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {gamesPlayed.toLocaleString()} rounds · Session net{" "}
            <span className={cn(sessionNet >= 0 ? "text-emerald-400" : "text-red-400")}>
              {sessionNet >= 0 ? "+" : ""}
              {formatKes(sessionNet)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-violet-500/30 text-violet-200"
            onClick={() => setLocation(PLAYER_SESSION_ANALYSIS_PATH)}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Full analysis
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 px-6 py-16 text-center text-zinc-500">
          No rounds yet. Play a round on the game board to build your history.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-500">#</TableHead>
                <TableHead className="text-zinc-500">Time</TableHead>
                <TableHead className="text-zinc-500">Grid</TableHead>
                <TableHead className="text-right text-zinc-500">Bombs</TableHead>
                <TableHead className="text-zinc-500">Result</TableHead>
                <TableHead className="text-right text-zinc-500">Stake</TableHead>
                <TableHead className="text-right text-zinc-500">Payout</TableHead>
                <TableHead className="text-right text-zinc-500">Net</TableHead>
                <TableHead className="text-right text-zinc-500">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-white/5">
                  <TableCell className="tabular-nums text-zinc-400">{r.gameIndex}</TableCell>
                  <TableCell className="text-zinc-400">
                    {new Date(r.playedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-zinc-300">{r.gridLabel}</TableCell>
                  <TableCell className="text-right tabular-nums text-zinc-400">
                    {r.bombCount != null ? r.bombCount : "—"}
                  </TableCell>
                  <TableCell className="capitalize text-zinc-300">{outcomeLabel(r.outcome)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKes(r.stake)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKes(r.payout)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums font-medium",
                      r.netProfit >= 0 ? "text-emerald-300" : "text-red-300",
                    )}
                  >
                    {r.netProfit >= 0 ? "+" : ""}
                    {formatKes(r.netProfit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-zinc-300">
                    {formatKes(r.endingBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function HistoryRoot() {
  const { user } = useFirebaseAuth();
  if (!user) return null;

  return (
    <BlockGamePlayerProvider
      uid={user.uid}
      userEmail={user.email ?? ""}
      userName={user.displayName ?? user.email ?? "Player"}
    >
      <SessionHistoryContent />
    </BlockGamePlayerProvider>
  );
}

export default function PlayerSessionHistoryPage() {
  return (
    <TechMediaLayout fullBleedMain hideChrome>
      <PageSeo
        config={{
          title: "Session History | Block Game",
          description: "Full round and payout history for your block game session.",
          path: PLAYER_SESSION_HISTORY_PATH,
        }}
      />
      <div className="min-h-svh w-full bg-[#06060a]">
        <GameAuthGate>
          <HistoryRoot />
        </GameAuthGate>
      </div>
    </TechMediaLayout>
  );
}

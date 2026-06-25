import { ArrowLeft, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PageSeo } from "@/components/seo/PageSeo";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { BlockGamePlayerProvider, useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import {
  PLAYER_SESSION_ANALYSIS_PATH,
  PLAYER_SESSION_HISTORY_PATH,
} from "@/lib/game/playerSessionHistory";
import { analyzeSessionHistory } from "@/lib/game/sessionAnalysis";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GameAuthGate } from "./components/GameAuthGate";

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

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
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4">
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
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function BombHeatmap({ cellHits, totalCells }: { cellHits: number[]; totalCells: number }) {
  const max = Math.max(1, ...cellHits);
  const cols = Math.ceil(Math.sqrt(totalCells));

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cellHits.map((hits, i) => {
        const intensity = hits / max;
        return (
          <div
            key={i}
            title={`Cell ${i + 1}: ${hits} bomb${hits === 1 ? "" : "s"}`}
            className="aspect-square rounded-sm border border-white/5"
            style={{
              backgroundColor: `rgba(239, 68, 68, ${0.12 + intensity * 0.75})`,
            }}
          />
        );
      })}
    </div>
  );
}

function SessionAnalysisContent() {
  const { sessionHistory, formatKes } = useBlockGamePlayer();
  const [, setLocation] = useLocation();

  const analysis = useMemo(() => analyzeSessionHistory(sessionHistory), [sessionHistory]);
  const { economics, bombBuckets, placementGroups } = analysis;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 text-zinc-100">
      <div className="mb-6">
        <Button
          type="button"
          variant="ghost"
          className="mb-2 -ml-2 text-zinc-400 hover:text-zinc-100"
          onClick={() => setLocation(PLAYER_SESSION_HISTORY_PATH)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to history
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <BarChart3 className="h-6 w-6 text-violet-400" />
              Session analysis
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              House edge, bomb counts, and how randomly bombs were placed across your rounds.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 text-zinc-300"
            onClick={() => setLocation("/game")}
          >
            Back to game
          </Button>
        </div>
      </div>

      {sessionHistory.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-zinc-500">
          Play rounds to unlock analysis — bomb placement maps and edge stats need session data.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Realized house edge"
              value={pct(economics.realizedHouseEdge)}
              sub={
                economics.targetHouseEdge != null
                  ? `Target ${pct(economics.targetHouseEdge)} · ${economics.rounds} rounds`
                  : `${economics.rounds} rounds`
              }
              tone={economics.realizedHouseEdge <= (economics.targetHouseEdge ?? 0.05) ? "neutral" : "bad"}
            />
            <StatCard
              label="Session net"
              value={`${economics.netProfit >= 0 ? "+" : ""}${formatKes(economics.netProfit)}`}
              sub={`Staked ${formatKes(economics.totalStaked)} · Paid ${formatKes(economics.totalPayout)}`}
              tone={economics.netProfit >= 0 ? "good" : "bad"}
            />
            <StatCard
              label="Avg bomb density"
              value={analysis.avgBombPct != null ? `${analysis.avgBombPct}%` : "—"}
              sub={
                analysis.minBombs != null && analysis.maxBombs != null
                  ? `${analysis.minBombs}–${analysis.maxBombs} bombs per round`
                  : "Play more rounds with bomb data"
              }
            />
            <StatCard
              label="Outcomes"
              value={`${economics.wins}W · ${economics.withdrawals}W/D · ${economics.losses}L`}
              sub={`${analysis.recordsWithBombData} rounds with placement data`}
            />
          </section>

          {bombBuckets.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-200">Bomb count distribution</h2>
              <div className="space-y-2">
                {bombBuckets.map((b) => (
                  <div key={b.bombs} className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 tabular-nums text-zinc-400">{b.bombs} bombs</span>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full bg-red-500/70"
                          style={{ width: `${Math.min(100, b.pctOfRounds)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right tabular-nums text-zinc-500">
                      {b.count} ({b.pctOfRounds}%)
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Production picks a random bomb count between 30% and 55% of grid cells each round. A spread
                across values suggests normal RNG.
              </p>
            </section>
          )}

          {placementGroups.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-200">Bomb placement randomness</h2>
              {placementGroups.map((g) => (
                <div
                  key={g.totalCells}
                  className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-100">
                        {g.gridLabel} · {g.totalCells} cells · {g.rounds} rounds
                      </p>
                      <p className="text-xs text-zinc-500">{g.interpretation}</p>
                    </div>
                    <div className="text-right text-xs tabular-nums text-zinc-500">
                      <p>Uniformity {g.uniformityScore}</p>
                      <p>χ² {g.chiSquare}</p>
                    </div>
                  </div>
                  <BombHeatmap cellHits={g.cellHits} totalCells={g.totalCells} />
                  <p className="mt-2 text-[10px] text-zinc-600">
                    Darker red = more bombs landed on that cell across rounds. Expected ~{g.expectedPerCell} per
                    cell if placement is uniform.
                  </p>
                </div>
              ))}
            </section>
          )}

          {analysis.recordsWithBombData === 0 && sessionHistory.length > 0 && (
            <p className="text-sm text-amber-400/90">
              Older rounds lack bomb placement data. Play new rounds to fill the randomness heatmaps.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisRoot() {
  const { user } = useFirebaseAuth();
  if (!user) return null;

  return (
    <BlockGamePlayerProvider
      uid={user.uid}
      userEmail={user.email ?? ""}
      userName={user.displayName ?? user.email ?? "Player"}
    >
      <SessionAnalysisContent />
    </BlockGamePlayerProvider>
  );
}

export default function PlayerSessionAnalysisPage() {
  return (
    <TechMediaLayout fullBleedMain hideChrome>
      <PageSeo
        config={{
          title: "Session Analysis | Block Game",
          description: "Analyze house edge, bomb counts, and placement randomness for your block game session.",
          path: PLAYER_SESSION_ANALYSIS_PATH,
        }}
      />
      <div className="min-h-svh w-full overflow-y-auto bg-[#06060a]">
        <GameAuthGate>
          <AnalysisRoot />
        </GameAuthGate>
      </div>
    </TechMediaLayout>
  );
}

import {
  Square,
  RotateCcw,
  StepForward,
  Zap,
  Hand,
  Play,
  Banknote,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlayMode } from "@/lib/simulation/types";
import { AutoSimDialog } from "./AutoSimDialog";

export function GridPlayControls() {
  const {
    playMode,
    setPlayMode,
    autoProgress,
    userWallet,
    accountBalance,
    canCashOut,
    startNewGame,
    cashOut,
    stopAutoPlay,
    resetGame,
    stepRandomPick,
    status,
    balance,
    currentRound,
    revealed,
    roundSettled,
    balanceAnimating,
    openChartDialog,
    openChartInNewTab,
    playAgainAfterRound,
    liveMetrics,
    sessionEconomics,
  } = useBlockGameSimulation();

  const btn = "h-9 px-3 text-sm transition-all";
  const modeActive =
    "border-amber-400 bg-amber-500/30 text-amber-100 ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]";
  const canStart =
    status !== "playing" &&
    !roundSettled &&
    !balanceAnimating &&
    playMode !== "auto" &&
    accountBalance >= userWallet.stake;

  const modes: { id: PlayMode; label: string; icon: typeof Hand }[] = [
    { id: "manual", label: "Manual", icon: Hand },
    { id: "step", label: "Step", icon: StepForward },
    { id: "auto", label: "Auto sim", icon: Zap },
  ];

  return (
    <div className="flex w-full min-w-[240px] max-w-md flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 w-full border-[#2962ff]/40 bg-[#2962ff]/10 text-sm text-[#d1d4dc] hover:bg-[#2962ff]/20"
          onClick={openChartDialog}
        >
          <BarChart3 className="mr-1.5 h-4 w-4" />
          Session chart
          {(liveMetrics.games > 0 || sessionEconomics.gamesPlayed > 0) && (
            <span className="ml-1.5 text-[10px] tabular-nums text-[#787b86]">
              ({(liveMetrics.games || sessionEconomics.gamesPlayed).toLocaleString()} g)
            </span>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 w-full border-white/15 bg-black/30 text-sm"
          onClick={openChartInNewTab}
          title="Open chart in new tab"
        >
          <ExternalLink className="mr-1.5 h-4 w-4" />
          New tab
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {modes.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant="outline"
            className={cn(btn, "border-white/15 bg-black/30", playMode === id && modeActive)}
            onClick={() => setPlayMode(id)}
          >
            <Icon className="mr-1.5 h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      {(playMode === "manual" || playMode === "step") && canStart && (
        <Button
          type="button"
          size="sm"
          className="h-10 w-full bg-violet-600 text-sm hover:bg-violet-500"
          onClick={() => startNewGame()}
        >
          <Play className="mr-1.5 h-4 w-4" />
          Start game (${userWallet.stake.toFixed(2)})
        </Button>
      )}

      {playMode === "step" && status === "playing" && (
        <Button
          type="button"
          size="sm"
          className="h-10 w-full bg-violet-600 text-sm hover:bg-violet-500"
          onClick={stepRandomPick}
        >
          <StepForward className="mr-1.5 h-4 w-4" />
          Step (random pick)
        </Button>
      )}

      {canCashOut && (playMode === "manual" || playMode === "step") && (
        <Button
          type="button"
          size="sm"
          className="h-10 w-full bg-amber-600 text-sm hover:bg-amber-500"
          onClick={cashOut}
        >
          <Banknote className="mr-1.5 h-4 w-4" />
          Withdraw (${balance.toFixed(2)})
        </Button>
      )}

      {balanceAnimating && (
        <p className="text-center text-sm font-medium text-emerald-400 animate-pulse">
          Adding payout to your account…
        </p>
      )}

      {roundSettled && !balanceAnimating && (playMode === "manual" || playMode === "step") && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-zinc-500">Round complete — view results or play again</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 border-white/15 bg-black/30 text-sm"
              onClick={openChartDialog}
            >
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Results
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={accountBalance < userWallet.stake}
              className="h-10 bg-violet-600 text-sm hover:bg-violet-500"
              onClick={() => playAgainAfterRound()}
            >
              <Play className="mr-1.5 h-4 w-4" />
              Play again
            </Button>
          </div>
        </div>
      )}

      {(playMode === "manual" || playMode === "step") && status === "playing" && currentRound > 0 && (
        <p className="text-center text-xs text-zinc-500">
          Round {currentRound} · {revealed.size} cell{revealed.size === 1 ? "" : "s"} revealed · keep playing or
          withdraw
        </p>
      )}

      {playMode === "auto" &&
        (autoProgress.running ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-10 w-full text-sm"
            onClick={stopAutoPlay}
          >
            <Square className="mr-1.5 h-4 w-4" />
            Stop simulation
          </Button>
        ) : (
          <AutoSimDialog buttonClassName="h-10 w-full justify-center text-sm" />
        ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 w-full border-white/15 text-sm"
        onClick={resetGame}
      >
        <RotateCcw className="mr-1.5 h-4 w-4" />
        Reset
      </Button>

      {autoProgress.running && (
        <div className="pt-1">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>
              P{(autoProgress.activePlayer + 1).toLocaleString()}/
              {autoProgress.totalPlayers.toLocaleString()}
            </span>
            <span>
              {autoProgress.completed.toLocaleString()}/{autoProgress.target.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-red-500 via-zinc-500 to-emerald-400 transition-all duration-150"
              style={{
                width: `${(autoProgress.completed / Math.max(1, autoProgress.target)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

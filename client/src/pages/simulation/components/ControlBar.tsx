import { Wallet, Banknote } from "lucide-react";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { simPanel, type SimViewVariant } from "../simulationStyles";
import { SimExpandablePanel } from "./SimExpandablePanel";
import { EditableNumberInput } from "./EditableNumberInput";

function ControlBarInner({ variant }: { variant: SimViewVariant }) {
  const {
    userWallet,
    setUserWallet,
    applyDeposit,
    displayBalance,
    balanceAnimating,
    gameStake,
    status,
    currentRound,
    balance,
    lastAction,
    lastMultiplier,
    config,
    currentGameEconomics,
  } = useBlockGameSimulation();

  const expanded = variant === "expanded";

  return (
    <div className={cn("flex flex-col gap-4", expanded && "space-y-1")}>
      <div
        className={cn(
          "rounded-xl border border-emerald-500/20 bg-emerald-500/5",
          expanded ? "space-y-3 p-5" : "space-y-2 p-4",
        )}
      >
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <Wallet className="h-4 w-4" />
          User account
        </p>
        <div className={cn("grid gap-3", expanded ? "sm:grid-cols-3" : "grid-cols-2")}>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Deposit ($)</Label>
            <EditableNumberInput
              min={0}
              step={1}
              fallback={0}
              disabled={status === "playing"}
              value={userWallet.deposit}
              onCommit={(deposit) => setUserWallet({ deposit })}
              className="h-9 border-white/10 bg-black/40 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-500">Stake per game ($)</Label>
            <EditableNumberInput
              min={1}
              step={1}
              fallback={1}
              disabled={status === "playing"}
              value={userWallet.stake}
              onCommit={(stake) => setUserWallet({ stake })}
              className="h-9 border-white/10 bg-black/40 text-sm"
            />
          </div>
          <div className={cn("flex flex-col justify-end", !expanded && "col-span-2 sm:col-span-1")}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={status === "playing"}
              className="h-9 border-white/15 bg-black/30 text-sm"
              onClick={applyDeposit}
            >
              <Banknote className="mr-1.5 h-4 w-4" />
              Fund account
            </Button>
          </div>
        </div>
        <p className="text-sm">
          <span className="text-zinc-500">Balance: </span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              balanceAnimating ? "text-emerald-400 animate-pulse" : "text-emerald-300",
            )}
          >
            ${displayBalance.toFixed(2)}
          </span>
          {status === "playing" && gameStake > 0 && (
            <span className="text-zinc-600"> · ${gameStake.toFixed(2)} in play</span>
          )}
          {balanceAnimating && (
            <span className="ml-2 text-xs text-emerald-500/80">↑ crediting…</span>
          )}
        </p>
      </div>

      <dl
        className={cn(
          "grid gap-3 rounded-xl border border-white/10 bg-black/30 text-sm text-zinc-400",
          expanded ? "grid-cols-2 p-5 sm:grid-cols-3" : "grid-cols-2 p-4",
        )}
      >
        {[
          ["Round", currentRound],
          ["Cashout value", status === "playing" ? `$${balance.toFixed(2)}` : "—", "text-emerald-300"],
          ["Stake (game)", gameStake > 0 ? `$${gameStake.toFixed(2)}` : `$${config.stake.toFixed(2)}`],
          ["Multiplier", `×${lastMultiplier.toFixed(3)}`],
          [
            "Last action",
            lastAction,
            lastAction === "win" ? "text-emerald-400" : lastAction === "loss" ? "text-red-400" : "text-zinc-200",
          ],
          ["Status", status, "capitalize text-zinc-200"],
          ...(currentGameEconomics && status === "playing"
            ? [
                [
                  "If stopped now",
                  `${currentGameEconomics.userProfit >= 0 ? "+" : ""}$${currentGameEconomics.userProfit.toFixed(2)}`,
                  currentGameEconomics.userProfit >= 0 ? "text-emerald-400" : "text-red-400",
                ],
              ]
            : []),
        ].map(([label, value, color]) => (
          <div key={String(label)} className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className={cn("text-base font-semibold text-zinc-100", color)}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ControlBar() {
  return (
    <SimExpandablePanel
      title="Wallet & game state"
      description="Fund your account, set stake, and track live round stats."
      panelClassName={simPanel}
      dialogClassName="sm:max-w-2xl"
      expandedContent={<ControlBarInner variant="expanded" />}
    >
      <ControlBarInner variant="inline" />
    </SimExpandablePanel>
  );
}

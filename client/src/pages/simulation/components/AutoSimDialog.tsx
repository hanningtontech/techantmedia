import { useEffect, useState } from "react";
import { Play, Settings2, Users, Wallet } from "lucide-react";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import type { AutoSimSettings } from "@/lib/simulation/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { EditableNumberInput } from "./EditableNumberInput";

type AutoSimDialogProps = {
  buttonClassName?: string;
  disabled?: boolean;
  onRun?: () => void;
};

function normalizeDraft(prev: AutoSimSettings, patch: Partial<AutoSimSettings>): AutoSimSettings {
  const next: AutoSimSettings = { ...prev, ...patch };
  next.gamesPerPlayerMin = Math.min(1_000_000, Math.max(1, Math.floor(next.gamesPerPlayerMin)));
  next.gamesPerPlayerMax = Math.min(1_000_000, Math.max(1, Math.floor(next.gamesPerPlayerMax)));
  if (next.gamesPerPlayerMin > next.gamesPerPlayerMax) {
    if (patch.gamesPerPlayerMin != null) next.gamesPerPlayerMax = next.gamesPerPlayerMin;
    else next.gamesPerPlayerMin = next.gamesPerPlayerMax;
  }
  next.gamesPerPlayer = next.gamesPerPlayerMax;
  next.playerCount = Math.min(10_000, Math.max(1, Math.floor(next.playerCount)));
  next.speedMs = Math.min(2000, Math.max(0, Math.floor(next.speedMs)));
  next.depositMin = Math.max(1, next.depositMin);
  next.depositMax = Math.max(1, next.depositMax);
  if (next.depositMin > next.depositMax) {
    if (patch.depositMin != null) next.depositMax = next.depositMin;
    else next.depositMin = next.depositMax;
  }
  next.stakeMin = Math.max(1, next.stakeMin);
  next.stakeMax = Math.max(1, next.stakeMax);
  if (next.stakeMin > next.stakeMax) {
    if (patch.stakeMin != null) next.stakeMax = next.stakeMin;
    else next.stakeMin = next.stakeMax;
  }
  return next;
}

export function AutoSimDialog({ buttonClassName, disabled, onRun }: AutoSimDialogProps) {
  const { autoSimSettings, setAutoSimSettings, startAutoPlay, autoProgress, userWallet } =
    useBlockGameSimulation();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AutoSimSettings>(autoSimSettings);

  useEffect(() => {
    if (open) {
      setDraft({
        ...autoSimSettings,
        gamesPerPlayerMin: autoSimSettings.gamesPerPlayerMin ?? autoSimSettings.gamesPerPlayer,
        gamesPerPlayerMax: autoSimSettings.gamesPerPlayerMax ?? autoSimSettings.gamesPerPlayer,
      });
    }
  }, [open, autoSimSettings]);

  const patchDraft = (patch: Partial<AutoSimSettings>) => {
    setDraft((prev) => normalizeDraft(prev, patch));
  };

  const totalGamesMin = draft.gamesPerPlayerMin * draft.playerCount;
  const totalGamesMax = draft.gamesPerPlayerMax * draft.playerCount;
  const totalGamesLabel =
    totalGamesMin === totalGamesMax
      ? totalGamesMin.toLocaleString()
      : `${totalGamesMin.toLocaleString()}–${totalGamesMax.toLocaleString()}`;
  const showWalletRanges = draft.playerCount > 1;

  const handleRun = () => {
    const normalized = normalizeDraft(draft, {});
    setAutoSimSettings(normalized);
    setDraft(normalized);
    setOpen(false);
    onRun?.();
    startAutoPlay(normalized);
  };

  const running = autoProgress.running;
  const numInputCls = "h-10 border-white/10 bg-black/40";
  const numInputSmCls = "h-9 border-white/10 bg-black/40 text-sm";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={disabled || running}
          className={cn("h-9 bg-emerald-600 px-3 text-sm hover:bg-emerald-500", buttonClassName)}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Auto sim…
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/15 bg-[#0a0a0f] text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Users className="h-5 w-5 text-violet-400" />
            Multi-player auto simulation
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Players stop when broke or after their game quota. Results popup when finished.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs text-zinc-400">Games per player (min – max)</Label>
              <div className="flex gap-2">
                <EditableNumberInput
                  id="auto-games-per-player-min"
                  integer
                  min={1}
                  max={1_000_000}
                  step={1}
                  fallback={1}
                  value={draft.gamesPerPlayerMin}
                  onCommit={(gamesPerPlayerMin) => patchDraft({ gamesPerPlayerMin })}
                  className={numInputCls}
                  placeholder="Min"
                />
                <EditableNumberInput
                  id="auto-games-per-player-max"
                  integer
                  min={1}
                  max={1_000_000}
                  step={1}
                  fallback={1}
                  value={draft.gamesPerPlayerMax}
                  onCommit={(gamesPerPlayerMax) => patchDraft({ gamesPerPlayerMax })}
                  className={numInputCls}
                  placeholder="Max"
                />
              </div>
              <p className="text-[10px] text-zinc-600">Each player gets a random count in this range.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-player-count" className="text-xs text-zinc-400">
                Number of players
              </Label>
              <EditableNumberInput
                id="auto-player-count"
                integer
                min={1}
                max={10_000}
                step={1}
                fallback={1}
                value={draft.playerCount}
                onCommit={(playerCount) => patchDraft({ playerCount })}
                className={numInputCls}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">
              Speed: {draft.speedMs === 0 ? "Max (batch)" : `${draft.speedMs}ms per game`}
            </Label>
            <Slider
              min={0}
              max={500}
              step={5}
              value={[draft.speedMs]}
              onValueChange={([v]) => patchDraft({ speedMs: v ?? 0 })}
            />
          </div>

          {draft.playerCount === 1 ? (
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-400">
              <Wallet className="mb-1 inline h-4 w-4 text-emerald-400" /> Uses your wallet: $
              {userWallet.deposit.toFixed(2)} deposit · ${userWallet.stake.toFixed(2)} stake
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-400">Randomize deposit & stake per player</Label>
                <Switch
                  checked={draft.randomizeWallets}
                  onCheckedChange={(v) => patchDraft({ randomizeWallets: v })}
                />
              </div>
              {draft.randomizeWallets ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-zinc-500">Deposit min–max ($)</Label>
                    <div className="flex gap-2">
                      <EditableNumberInput
                        min={1}
                        step={1}
                        fallback={1}
                        value={draft.depositMin}
                        onCommit={(depositMin) => patchDraft({ depositMin })}
                        className={numInputSmCls}
                      />
                      <EditableNumberInput
                        min={1}
                        step={1}
                        fallback={1}
                        value={draft.depositMax}
                        onCommit={(depositMax) => patchDraft({ depositMax })}
                        className={numInputSmCls}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-zinc-500">Stake min–max ($)</Label>
                    <div className="flex gap-2">
                      <EditableNumberInput
                        min={1}
                        step={1}
                        fallback={1}
                        value={draft.stakeMin}
                        onCommit={(stakeMin) => patchDraft({ stakeMin })}
                        className={numInputSmCls}
                      />
                      <EditableNumberInput
                        min={1}
                        step={1}
                        fallback={1}
                        value={draft.stakeMax}
                        onCommit={(stakeMax) => patchDraft({ stakeMax })}
                        className={numInputSmCls}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  All players use your wallet settings ($
                  {userWallet.deposit.toFixed(2)} / ${userWallet.stake.toFixed(2)} stake).
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm">
            <span className="text-zinc-500">Total game slots: </span>
            <span className="font-semibold text-zinc-100">{totalGamesLabel}</span>
            {totalGamesMin !== totalGamesMax && (
              <span className="text-zinc-500"> (random per player)</span>
            )}
            {showWalletRanges && draft.randomizeWallets && (
              <p className="mt-1 text-xs text-zinc-600">Each player gets a random deposit & stake in range.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-transparent"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-500" onClick={handleRun}>
            <Play className="mr-1.5 h-4 w-4" />
            Run {totalGamesLabel} games
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

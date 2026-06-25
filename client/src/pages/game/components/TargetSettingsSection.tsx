import { Pencil, Target, X } from "lucide-react";
import { useState } from "react";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { Button } from "@/components/ui/button";
import { TargetSetupDialog } from "./TargetSetupDialog";
import { TargetSetupForm } from "./TargetSetupForm";

/** Session target controls — shown in Settings. */
export function TargetSettingsSection() {
  const {
    sessionTarget,
    accountBalance,
    displayBalance,
    setPlayerTarget,
    clearPlayerTarget,
    formatKes,
    status,
  } = useBlockGamePlayer();

  const isPhone = usePhoneGameLayout();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inlineForm, setInlineForm] = useState(false);
  const [dialogMode, setDialogMode] = useState<"set" | "adjust">("set");
  const playing = status === "playing";

  const progress =
    sessionTarget != null && sessionTarget > 0
      ? Math.min(100, Math.round((displayBalance / sessionTarget) * 100))
      : 0;

  const openSet = () => {
    setDialogMode("set");
    if (isPhone) {
      setInlineForm(true);
      return;
    }
    setDialogOpen(true);
  };

  const openAdjust = () => {
    setDialogMode("adjust");
    if (isPhone) {
      setInlineForm(true);
      return;
    }
    setDialogOpen(true);
  };

  const closeInline = () => setInlineForm(false);

  return (
    <>
      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Session target</p>
        <p className="mb-3 text-xs text-zinc-500">
          Optional goal for this session. Set once and play until you reach it — you can change or remove it anytime.
        </p>

        {sessionTarget == null ? (
          <Button
            type="button"
            variant="outline"
            className="w-full border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
            disabled={playing}
            onClick={openSet}
          >
            <Target className="mr-2 h-4 w-4" />
            Set target (optional)
          </Button>
        ) : (
          <div className="overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/5">
            <div className="flex items-start gap-3 px-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <Target className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-amber-400/80">Active target</p>
                <p className="text-lg font-bold tabular-nums text-amber-100">{formatKes(sessionTarget)}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Now {formatKes(displayBalance)} · {progress}% there
                </p>
              </div>
            </div>
            <div className="h-1 bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex gap-2 border-t border-amber-500/15 p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-white/10 text-zinc-200"
                disabled={playing}
                onClick={openAdjust}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Adjust
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                disabled={playing}
                onClick={() => clearPlayerTarget()}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        )}

        {isPhone && inlineForm && (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-black/30 p-3">
            <p className="mb-2 text-sm font-medium text-amber-100">
              {dialogMode === "adjust" ? "Adjust target" : "Set target"}
            </p>
            <TargetSetupForm
              currentBalance={accountBalance}
              mode={dialogMode}
              initialTarget={sessionTarget ?? undefined}
              onConfirm={(target) => {
                setPlayerTarget(target);
                closeInline();
              }}
              onSkip={dialogMode === "set" ? closeInline : undefined}
              onClear={dialogMode === "adjust" ? () => { clearPlayerTarget(); closeInline(); } : undefined}
              onCancel={closeInline}
            />
          </div>
        )}
      </div>

      {!isPhone && (
        <TargetSetupDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          currentBalance={accountBalance}
          mode={dialogMode}
          initialTarget={sessionTarget ?? undefined}
          onConfirm={(target) => setPlayerTarget(target)}
          onSkip={dialogMode === "set" ? () => setDialogOpen(false) : undefined}
          onClear={dialogMode === "adjust" ? () => clearPlayerTarget() : undefined}
        />
      )}
    </>
  );
}

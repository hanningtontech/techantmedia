import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scrollInputIntoView } from "@/hooks/usePhoneKeyboardInset";
import { formatKes } from "@/lib/game/formatKes";
import { isValidTargetBalance, minTargetBalance } from "@/lib/game/targetMode";

export function TargetSetupForm({
  currentBalance,
  mode = "set",
  initialTarget,
  onConfirm,
  onSkip,
  onClear,
  onCancel,
}: {
  currentBalance: number;
  mode?: "set" | "adjust";
  initialTarget?: number;
  onConfirm: (targetBalance: number) => void;
  onSkip?: () => void;
  onClear?: () => void;
  onCancel?: () => void;
}) {
  const minTarget = minTargetBalance(currentBalance);
  const [target, setTarget] = useState(String(initialTarget ?? minTarget));
  const isAdjust = mode === "adjust";

  useEffect(() => {
    setTarget(String(initialTarget ?? minTargetBalance(currentBalance)));
  }, [currentBalance, initialTarget]);

  const parsed = Math.round(Number(target));
  const valid = isValidTargetBalance(currentBalance, parsed);

  const submit = () => {
    if (!valid) return;
    onConfirm(parsed);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Current balance:{" "}
        <span className="font-semibold text-emerald-300">{formatKes(currentBalance)}</span>
      </p>
      <div>
        <Label htmlFor="target-balance" className="text-zinc-400">
          Target balance (KES)
        </Label>
        <Input
          id="target-balance"
          type="number"
          inputMode="numeric"
          min={minTarget}
          step={10}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onFocus={(e) => scrollInputIntoView(e.currentTarget)}
          className="mt-1 border-white/10 bg-black/40 text-lg font-semibold tabular-nums"
        />
        {!valid && target.trim() !== "" && (
          <p className="mt-1.5 text-xs text-amber-400">
            Minimum target is {formatKes(minTarget)} (at least double your balance).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {onSkip && (
            <Button type="button" variant="ghost" className="text-zinc-400 hover:text-zinc-200" onClick={onSkip}>
              Skip for now
            </Button>
          )}
          {onClear && (
            <Button
              type="button"
              variant="outline"
              className="border-red-500/30 text-red-300 hover:bg-red-500/10"
              onClick={onClear}
            >
              Remove target
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" className="border-white/15" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            className="bg-violet-600 hover:bg-violet-500"
            disabled={!valid}
            onClick={submit}
          >
            {isAdjust ? "Save target" : "Set target"}
          </Button>
        </div>
      </div>
    </div>
  );
}

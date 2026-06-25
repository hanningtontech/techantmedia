import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { MAX_STAKE_KES, MIN_STAKE_KES } from "@/lib/game/constants";
import { Button } from "@/components/ui/button";
import { scrollInputIntoView } from "@/hooks/usePhoneKeyboardInset";
import { cn } from "@/lib/utils";

const STEP = 5;

type Props = {
  stake: number;
  accountBalance: number;
  setStake: (amount: number) => void;
  className?: string;
  compact?: boolean;
};

export function StakeAdjustControl({
  stake,
  accountBalance,
  setStake,
  className,
  compact = false,
}: Props) {
  const maxAffordable = Math.min(MAX_STAKE_KES, Math.max(0, Math.floor(accountBalance)));
  const minAllowed = Math.min(MIN_STAKE_KES, maxAffordable);
  const [val, setVal] = useState(() => String(Math.min(stake, maxAffordable)));

  useEffect(() => {
    setVal(String(Math.min(stake, maxAffordable)));
  }, [stake, maxAffordable]);

  const parsed = Math.round(Number(val));
  const current = Number.isFinite(parsed) ? parsed : Math.min(stake, maxAffordable);

  const commit = () => {
    if (!Number.isFinite(parsed)) {
      setVal(String(Math.min(stake, maxAffordable)));
      return;
    }
    const next = Math.min(maxAffordable, Math.max(minAllowed, parsed));
    setVal(String(next));
    setStake(next);
  };

  const bump = (delta: number) => {
    const next = Math.min(maxAffordable, Math.max(minAllowed, current + delta));
    setVal(String(next));
    setStake(next);
  };

  const btnH = compact ? "h-9" : "h-10 sm:h-12";
  const iconBtn = compact ? "h-9 w-8" : "h-10 w-9 sm:h-12 sm:w-10";

  return (
    <div className={cn("flex w-full items-center gap-1.5", className)}>
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 disabled:opacity-40",
          iconBtn,
        )}
        disabled={current <= minAllowed}
        onClick={() => bump(-STEP)}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={val}
        min={minAllowed}
        max={maxAffordable}
        step={STEP}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onFocus={(e) => scrollInputIntoView(e.currentTarget)}
        className={cn(
          "min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 text-center text-sm font-semibold tabular-nums text-violet-200 outline-none focus:border-violet-500/60",
          btnH,
          compact ? "text-sm" : "text-base",
        )}
      />
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 disabled:opacity-40",
          iconBtn,
        )}
        disabled={current >= maxAffordable}
        onClick={() => bump(STEP)}
      >
        <Plus className="h-4 w-4" />
      </button>
      <Button
        type="button"
        className={cn("shrink-0 bg-violet-600 p-0 hover:bg-violet-500", iconBtn)}
        onClick={commit}
      >
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function needsStakeAdjust(accountBalance: number, stake: number): boolean {
  return accountBalance >= MIN_STAKE_KES && stake > accountBalance;
}

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
  /** Phone bottom bar — wider stake field for 4-digit amounts. */
  phoneBar?: boolean;
};

export function StakeAdjustControl({
  stake,
  accountBalance,
  setStake,
  className,
  compact = false,
  phoneBar = false,
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

  const btnH = phoneBar ? "h-8" : compact ? "h-9" : "h-10 sm:h-12";
  const iconBtn = phoneBar ? "h-8 w-7" : compact ? "h-9 w-8" : "h-10 w-9 sm:h-12 sm:w-10";
  const checkBtn = phoneBar ? "h-8 w-8" : iconBtn;

  return (
    <div className={cn("flex w-full min-w-0 items-center", phoneBar ? "gap-1" : "gap-1.5", className)}>
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 disabled:opacity-40",
          iconBtn,
        )}
        disabled={current <= minAllowed}
        onClick={() => bump(-STEP)}
      >
        <Minus className={phoneBar ? "h-3.5 w-3.5" : "h-4 w-4"} />
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
          "min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 text-center font-semibold tabular-nums text-violet-200 outline-none focus:border-violet-500/60",
          phoneBar ? "min-w-[4.25rem] px-1 text-sm tracking-tight" : "px-2 text-center text-sm",
          btnH,
          !phoneBar && (compact ? "text-sm" : "text-base"),
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
        <Plus className={phoneBar ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
      <Button
        type="button"
        className={cn("shrink-0 bg-violet-600 p-0 hover:bg-violet-500", checkBtn)}
        onClick={commit}
      >
        <Check className={phoneBar ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>
    </div>
  );
}

export function needsStakeAdjust(accountBalance: number, stake: number): boolean {
  return accountBalance >= MIN_STAKE_KES && stake > accountBalance;
}

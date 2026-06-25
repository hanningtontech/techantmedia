import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKes } from "@/lib/game/formatKes";
import { TARGET_OWES_PHONE } from "@/lib/game/targetMode";

export function TargetCelebrationOverlay({
  owedAmount,
  targetBalance,
  onDismiss,
  onReset,
}: {
  owedAmount: number;
  targetBalance: number;
  onDismiss: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <div className="overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-500/20 via-zinc-950 to-zinc-950 p-8 text-center shadow-[0_0_80px_rgba(245,158,11,0.25)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
            <PartyPopper className="h-8 w-8" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-400/90">Your Luck</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Congratulations!</h2>
          <p className="mt-2 text-sm text-zinc-400">
            You hit your target of{" "}
            <span className="font-semibold text-amber-200">{formatKes(targetBalance)}</span>
          </p>

          <div
            className="mx-auto mt-8 max-w-xs rotate-[-2deg] rounded-sm border border-amber-200/40 bg-[#fef9c3] px-5 py-4 text-left shadow-lg"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgba(254,249,195,0.95) 0%, rgba(253,230,138,0.9) 100%)",
            }}
          >
            <p className="text-base font-bold leading-snug text-zinc-900" style={{ fontFamily: "cursive" }}>
              {TARGET_OWES_PHONE} owes you
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-700" style={{ fontFamily: "cursive" }}>
              {formatKes(owedAmount)}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {onReset && (
              <Button
                type="button"
                variant="outline"
                className="border-white/20 text-zinc-100 hover:bg-white/10"
                onClick={onReset}
              >
                Reset board
              </Button>
            )}
            <Button
              type="button"
              className="bg-amber-500 text-black hover:bg-amber-400"
              onClick={onDismiss}
            >
              Continue playing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

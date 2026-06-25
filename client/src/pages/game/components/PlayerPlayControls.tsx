import { Banknote, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useBlockGamePlayer, useNextMultiplier } from "@/contexts/BlockGamePlayerContext";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sideBtnClass =
  "min-h-9 h-auto whitespace-normal px-1.5 py-2 text-[11px] leading-tight sm:min-h-10 sm:px-2 sm:text-xs md:min-h-11 md:px-2.5 md:text-sm lg:min-h-12 lg:px-3 lg:text-base";

const desktopBtnClass = "h-9 text-xs font-medium px-3";

function DesktopButtonRows({ children }: { children: ReactNode[] }) {
  if (children.length === 1) {
    return <div className="w-full max-w-md">{children[0]}</div>;
  }

  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 2) {
    rows.push(children.slice(i, i + 2));
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      {rows.map((row, rowIdx) =>
        row.length === 2 ? (
          <div key={rowIdx} className="grid grid-cols-2 gap-2">
            {row}
          </div>
        ) : (
          <div key={rowIdx} className="flex justify-center">
            <div className="w-1/2 min-w-[8rem]">{row[0]}</div>
          </div>
        ),
      )}
    </div>
  );
}

export function PlayerPlayControls({
  pinned = false,
  layout = "stack",
  singleColumn = false,
  phone = false,
}: {
  pinned?: boolean;
  layout?: "stack" | "side" | "desktop";
  singleColumn?: boolean;
  phone?: boolean;
}) {
  const {
    status,
    roundSettled,
    balanceAnimating,
    canCashOut,
    canStartGame,
    canPlayAgain,
    canResetAfterRound,
    currentRound,
    roundBalance,
    lastMultiplier,
    lastResult,
    stake,
    startNewGame,
    playAgain,
    resetAfterRound,
    cashOut,
    formatKes,
    config,
    accountBalance,
  } = useBlockGamePlayer();

  const nextMult = useNextMultiplier(config, currentRound);
  const playing = status === "playing";
  const isPhone = usePhoneGameLayout();
  const actionBarRef = useRef<HTMLDivElement>(null);
  const isSide = layout === "side";
  const isDesktop = layout === "desktop";

  if (isDesktop) {
    const buttons: ReactNode[] = [];

    if (!roundSettled && !playing) {
      buttons.push(
        <Button
          key="start"
          type="button"
          disabled={!canStartGame || balanceAnimating}
          className={cn("w-full bg-violet-600 hover:bg-violet-500", desktopBtnClass)}
          onClick={() => startNewGame()}
        >
          <Play className="mr-1.5 h-4 w-4 shrink-0" />
          Start · {formatKes(stake, { compact: true })}
        </Button>,
      );
    }

    if (playing && canCashOut) {
      buttons.push(
        <Button
          key="withdraw"
          type="button"
          className={cn("w-full bg-amber-600 hover:bg-amber-500", desktopBtnClass)}
          onClick={cashOut}
        >
          <Banknote className="mr-1.5 h-4 w-4 shrink-0" />
          Withdraw · {formatKes(roundBalance, { compact: true })}
        </Button>,
      );
    }

    if (roundSettled && !playing) {
      buttons.push(
        <Button
          key="again"
          type="button"
          disabled={!canPlayAgain || balanceAnimating}
          className={cn("w-full bg-violet-600 hover:bg-violet-500", desktopBtnClass)}
          onClick={() => playAgain()}
        >
          <Play className="mr-1.5 h-4 w-4 shrink-0" />
          Play again
        </Button>,
        <Button
          key="reset"
          type="button"
          disabled={balanceAnimating || !canResetAfterRound}
          variant="outline"
          className={cn("w-full border-white/15 bg-zinc-900 hover:bg-zinc-800", desktopBtnClass)}
          onClick={() => resetAfterRound()}
        >
          <RotateCcw className="mr-1.5 h-4 w-4 shrink-0" />
          Reset
        </Button>,
      );
    }

    return (
      <div className="w-full">
        {playing && currentRound > 0 && (
          <p className="mb-2 text-center text-[11px] text-zinc-500">
            Pick{" "}
            <span className="font-semibold text-emerald-300">{formatKes(roundBalance)}</span> · ×
            {lastMultiplier.toFixed(2)} · R{currentRound}
          </p>
        )}
        {roundSettled && lastResult && (
          <p
            className={cn(
              "mb-2 text-center text-[11px] font-medium capitalize",
              lastResult.netProfit >= 0 ? "text-emerald-300" : "text-red-300",
            )}
          >
            {lastResult.outcome.replace("_", " ")} · {lastResult.netProfit >= 0 ? "+" : ""}
            {formatKes(lastResult.netProfit)}
          </p>
        )}
        {buttons.length > 0 ? (
          <DesktopButtonRows>{buttons}</DesktopButtonRows>
        ) : (
          <div className="h-9" />
        )}
        {!canPlayAgain && !canStartGame && !playing && roundSettled && accountBalance < stake && (
          <p className="mt-2 text-center text-[10px] text-amber-400/90">
            Insufficient balance — lower stake or request funds in settings.
          </p>
        )}
      </div>
    );
  }

  if (phone) {
    return (
      <div className="flex min-h-[60px] w-full flex-col justify-center gap-2">
        {!roundSettled && !playing && (
          <Button
            type="button"
            disabled={!canStartGame || balanceAnimating}
            className="h-12 w-full bg-violet-600 text-base hover:bg-violet-500"
            onClick={() => startNewGame()}
          >
            <Play className="mr-2 h-5 w-5 shrink-0" />
            Start round · {formatKes(stake)}
          </Button>
        )}

        {playing && (
          <div className="flex items-stretch gap-2">
            <div className="flex min-h-[3.25rem] min-w-0 flex-1 basis-0 flex-col justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
              <p className="text-[9px] uppercase tracking-wide text-emerald-400/80">Current pick</p>
              <p className="truncate text-base font-bold leading-tight tabular-nums text-emerald-300">
                {formatKes(roundBalance)}
              </p>
              <p className="truncate text-[9px] text-zinc-500">
                ×{lastMultiplier.toFixed(2)} · R{currentRound}
                {nextMult > 0 && ` · Next ×${nextMult.toFixed(2)}`}
              </p>
            </div>
            <Button
              type="button"
              disabled={!canCashOut}
              className="h-auto min-h-[3.25rem] flex-1 basis-0 bg-amber-600 px-2 text-sm font-semibold hover:bg-amber-500 disabled:opacity-50"
              onClick={cashOut}
            >
              <Banknote className="mr-1.5 h-5 w-5 shrink-0" />
              Withdraw
            </Button>
          </div>
        )}

        {roundSettled && !playing && (
          <div className="flex items-stretch gap-2">
            {lastResult && (
              <div
                className={cn(
                  "flex min-h-[3.25rem] min-w-0 flex-1 basis-0 flex-col justify-center rounded-xl border px-3 py-1.5",
                  lastResult.netProfit >= 0
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-red-500/30 bg-red-500/10",
                )}
              >
                <p
                  className={cn(
                    "truncate text-[9px] uppercase tracking-wide",
                    lastResult.netProfit >= 0 ? "text-emerald-300/80" : "text-red-300/80",
                  )}
                >
                  {lastResult.outcome.replace("_", " ")}
                </p>
                <p
                  className={cn(
                    "truncate text-base font-bold leading-tight tabular-nums",
                    lastResult.netProfit >= 0 ? "text-emerald-200" : "text-red-200",
                  )}
                >
                  {lastResult.netProfit >= 0 ? "+" : ""}
                  {formatKes(lastResult.netProfit)}
                </p>
              </div>
            )}
            <Button
              type="button"
              disabled={!canPlayAgain || balanceAnimating}
              className="h-auto min-h-[3.25rem] flex-1 basis-0 bg-violet-600 px-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
              onClick={() => playAgain()}
            >
              <Play className="mr-1.5 h-4 w-4 shrink-0" />
              Play again
            </Button>
            <Button
              type="button"
              disabled={balanceAnimating || !canResetAfterRound}
              variant="outline"
              className="h-auto min-h-[3.25rem] w-11 shrink-0 border-white/15 bg-zinc-900 px-0 hover:bg-zinc-800"
              onClick={() => resetAfterRound()}
              aria-label="Reset board"
              title="Reset board"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}

        {!canPlayAgain && !canStartGame && !playing && roundSettled && accountBalance < stake && (
          <p className="text-center text-[10px] text-amber-400/90">
            Insufficient balance — lower stake or request funds.
          </p>
        )}
      </div>
    );
  }

  const hasPrimaryAction =
    (!roundSettled && !playing) ||
    (playing && canCashOut) ||
    (roundSettled && !playing) ||
    canResetAfterRound;

  useEffect(() => {
    if (pinned || !hasPrimaryAction) return;
    const el = actionBarRef.current;
    if (!el) return;

    const frame = window.requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const padding = 12;
      const belowFold = rect.bottom > window.innerHeight - padding;
      const aboveFold = rect.top < padding;
      if (belowFold || aboveFold) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasPrimaryAction, pinned, status, roundSettled, playing, canCashOut]);

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:gap-3", isSide && "justify-center")}>
      {playing && currentRound > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-center sm:px-3 sm:py-2">
          <p className="text-[9px] uppercase tracking-wide text-emerald-400/80 sm:text-[10px]">
            Current pick value
          </p>
          <p className="text-base font-bold tabular-nums text-emerald-300 sm:text-lg">
            {formatKes(roundBalance)}
          </p>
          <p className="text-[9px] text-zinc-500 sm:text-[10px]">
            ×{lastMultiplier.toFixed(2)} · R{currentRound}
            {nextMult > 0 && ` · Next ×${nextMult.toFixed(2)}`}
          </p>
        </div>
      )}

      {roundSettled && lastResult && !isPhone && (
        <div
          className={cn(
            "rounded-xl border px-2 py-1.5 text-center text-xs sm:px-3 sm:py-2 sm:text-sm",
            lastResult.netProfit >= 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200",
          )}
        >
          <p className="font-semibold capitalize">{lastResult.outcome.replace("_", " ")}</p>
          <p className="tabular-nums">
            {lastResult.netProfit >= 0 ? "+" : ""}
            {formatKes(lastResult.netProfit)}
          </p>
        </div>
      )}

      <div
        ref={actionBarRef}
        className={cn(
          "flex flex-col gap-2",
          !pinned &&
            hasPrimaryAction &&
            "sticky bottom-0 z-30 -mx-1 rounded-2xl border border-white/10 bg-[#06060a]/95 p-3 shadow-[0_-10px_36px_rgba(0,0,0,0.55)] backdrop-blur-md supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div
          className={cn(
            "grid grid-cols-1 gap-2",
            layout === "stack" && !singleColumn && "sm:grid-cols-2",
          )}
        >
          {!roundSettled && !playing && (
            <Button
              type="button"
              disabled={!canStartGame || balanceAnimating}
              className={cn(
                "bg-violet-600 hover:bg-violet-500",
                isSide ? sideBtnClass : "h-12 text-base sm:col-span-2",
                layout === "stack" && "sm:col-span-2",
              )}
              onClick={() => startNewGame()}
            >
              <Play className={cn("mr-1.5 shrink-0", isSide ? "h-4 w-4 sm:h-5 sm:w-5" : "mr-2 h-5 w-5")} />
              {isSide ? (
                <>Start · {formatKes(stake, { compact: true })}</>
              ) : (
                <>Start round · {formatKes(stake)}</>
              )}
            </Button>
          )}

          {playing && canCashOut && (
            <Button
              type="button"
              className={cn(
                "bg-amber-600 hover:bg-amber-500",
                isSide ? sideBtnClass : "h-12 text-base sm:col-span-2",
                layout === "stack" && "sm:col-span-2",
              )}
              onClick={cashOut}
            >
              <Banknote className={cn("mr-1.5 shrink-0", isSide ? "h-4 w-4 sm:h-5 sm:w-5" : "mr-2 h-5 w-5")} />
              {isSide ? (
                <>Withdraw · {formatKes(roundBalance, { compact: true })}</>
              ) : (
                <>Withdraw {formatKes(roundBalance)}</>
              )}
            </Button>
          )}

          {roundSettled && !playing && (
            <>
              <Button
                type="button"
                disabled={!canPlayAgain || balanceAnimating}
                className={cn(
                  "bg-violet-600 hover:bg-violet-500",
                  isSide ? sideBtnClass : "h-12 text-base",
                )}
                onClick={() => playAgain()}
              >
                <Play className={cn("mr-1.5 shrink-0", isSide ? "h-4 w-4 sm:h-5 sm:w-5" : "mr-2 h-5 w-5")} />
                Play again
              </Button>
              <Button
                type="button"
                disabled={balanceAnimating}
                className={cn(
                  "border-white/15 bg-zinc-900 hover:bg-zinc-800",
                  isSide ? sideBtnClass : "h-12 text-base",
                )}
                variant="outline"
                onClick={() => resetAfterRound()}
              >
                <RotateCcw className={cn("mr-1.5 shrink-0", isSide ? "h-4 w-4 sm:h-5 sm:w-5" : "mr-2 h-5 w-5")} />
                Reset board
              </Button>
            </>
          )}
        </div>

        {!canPlayAgain && !canStartGame && !playing && roundSettled && accountBalance < stake && (
          <p className="text-center text-[10px] text-amber-400/90 sm:text-xs">
            Insufficient balance — lower stake or request funds.
          </p>
        )}
      </div>
    </div>
  );
}

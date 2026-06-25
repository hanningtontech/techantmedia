import { ChevronDown, Minus, Plus, Volume2, VolumeX, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { MAX_STAKE_KES, MAX_WALLET_BALANCE_KES, MIN_STAKE_KES } from "@/lib/game/constants";
import { isValidTargetBalance, minTargetBalance } from "@/lib/game/targetMode";
import { scrollInputIntoView } from "@/hooks/usePhoneKeyboardInset";
import { Button } from "@/components/ui/button";
import { FundRequestDialog } from "./FundRequestDialog";
import { GridAppearanceSettingsButton } from "./GridAppearancePanel";
import { ChartPanelToggleButton } from "./PlayerChartPanel";
import { cn } from "@/lib/utils";

export { GridAppearanceSettingsButton } from "./GridAppearancePanel";

const STAKE_STEP = 5;
const fieldClass =
  "h-9 w-full rounded-lg border border-white/10 bg-black/40 pr-2 text-sm font-semibold tabular-nums outline-none focus:border-violet-500/60";

function useNeedsFunds() {
  const { accountBalance, status } = useBlockGamePlayer();
  const playing = status === "playing";
  return !playing && accountBalance < MIN_STAKE_KES;
}

function StakeField() {
  const { stake, setStake, status, formatKes } = useBlockGamePlayer();
  const playing = status === "playing";
  const [val, setVal] = useState(String(stake));

  useEffect(() => {
    setVal(String(stake));
  }, [stake]);

  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && raw.trim() !== "") setStake(n);
    else setVal(String(stake));
  };

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Stake / round
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={playing || stake <= MIN_STAKE_KES}
          onClick={() => setStake(stake - STAKE_STEP)}
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 disabled:opacity-40"
          aria-label="Decrease stake"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-500">
            KES
          </span>
          <input
            type="number"
            inputMode="numeric"
            disabled={playing}
            value={val}
            min={MIN_STAKE_KES}
            max={MAX_STAKE_KES}
            step={STAKE_STEP}
            onChange={(e) => setVal(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commit((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onFocus={(e) => scrollInputIntoView(e.currentTarget)}
            className={cn(fieldClass, "pl-9 text-violet-200 disabled:opacity-60")}
          />
        </div>
        <button
          type="button"
          disabled={playing || stake >= MAX_STAKE_KES}
          onClick={() => setStake(stake + STAKE_STEP)}
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 disabled:opacity-40"
          aria-label="Increase stake"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 truncate text-[9px] text-zinc-600">{formatKes(stake)} per round</p>
    </div>
  );
}

function AddFundsField({ onOpen }: { onOpen: () => void }) {
  const { accountBalance, formatKes } = useBlockGamePlayer();

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-amber-400/90">
        Add funds
      </label>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
        <p className="text-[11px] leading-snug text-zinc-400">
          Balance{" "}
          <span className="font-semibold text-amber-200">{formatKes(accountBalance)}</span> is below the minimum{" "}
          <span className="font-semibold text-violet-200">{formatKes(MIN_STAKE_KES)}</span> stake to play.
        </p>
        <Button
          type="button"
          className="mt-2 h-9 w-full bg-amber-600 text-sm hover:bg-amber-500"
          onClick={onOpen}
        >
          Request funds
        </Button>
        <p className="mt-1.5 text-[9px] text-zinc-600">Or lower stake · Settings also has fund requests</p>
      </div>
    </div>
  );
}

function TargetField() {
  const {
    sessionTarget,
    setPlayerTarget,
    clearPlayerTarget,
    accountBalance,
    displayBalance,
    status,
    formatKes,
  } = useBlockGamePlayer();
  const playing = status === "playing";
  const minTarget = minTargetBalance(accountBalance);
  const [val, setVal] = useState(sessionTarget != null ? String(sessionTarget) : "");

  useEffect(() => {
    setVal(sessionTarget != null ? String(sessionTarget) : "");
  }, [sessionTarget]);

  const hasVal = val.trim() !== "";
  const parsed = Math.round(Number(val));
  const valid = hasVal && isValidTargetBalance(accountBalance, parsed);
  const progress =
    sessionTarget != null && sessionTarget > 0
      ? Math.min(100, Math.round((displayBalance / sessionTarget) * 100))
      : 0;

  const commit = () => {
    if (!hasVal) {
      if (sessionTarget != null) clearPlayerTarget();
      return;
    }
    if (valid) setPlayerTarget(parsed);
    else setVal(sessionTarget != null ? String(sessionTarget) : "");
  };

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Session target
      </label>
      <div className="relative min-w-0">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-500">
          KES
        </span>
        <input
          type="number"
          inputMode="numeric"
          disabled={playing}
          value={val}
          placeholder="Optional"
          min={minTarget}
          step={10}
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
            fieldClass,
            "pl-9 text-amber-200 placeholder:text-zinc-600 disabled:opacity-60",
            hasVal && !valid && "border-amber-500/60",
          )}
        />
        {sessionTarget != null && !playing && (
          <button
            type="button"
            onClick={() => {
              clearPlayerTarget();
              setVal("");
            }}
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:text-red-300"
            aria-label="Remove target"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {sessionTarget != null ? (
        <div className="mt-1">
          <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-0.5 truncate text-[9px] text-zinc-600">
            {progress}% of {formatKes(sessionTarget)}
          </p>
        </div>
      ) : hasVal && !valid ? (
        <p className="mt-1 truncate text-[9px] text-amber-400/90">Min {formatKes(minTarget)}</p>
      ) : (
        <p className="mt-1 truncate text-[9px] text-zinc-600">Optional goal — 2× balance min</p>
      )}
    </div>
  );
}

function WalletIconToolbar({
  soundMuted,
  toggleSoundMuted,
  chartPanelMode,
  openChartInNewTab,
}: {
  soundMuted: boolean;
  toggleSoundMuted: () => void;
  chartPanelMode: string;
  openChartInNewTab: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 text-zinc-400 hover:text-zinc-100"
        onClick={toggleSoundMuted}
        aria-label={soundMuted ? "Unmute sounds" : "Mute sounds"}
      >
        {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
      <ChartPanelToggleButton />
      {chartPanelMode === "open" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="hidden h-9 text-xs text-zinc-500 hover:text-zinc-200 lg:inline-flex"
          onClick={openChartInNewTab}
        >
          New tab
        </Button>
      )}
      <GridAppearanceSettingsButton />
    </div>
  );
}

function StakeOrFundsSlot({ onOpenFunds }: { onOpenFunds: () => void }) {
  const needsFunds = useNeedsFunds();
  if (needsFunds) return <AddFundsField onOpen={onOpenFunds} />;
  return <StakeField />;
}

export function PlayerWalletBar({ phoneMode = false }: { phoneMode?: boolean }) {
  const {
    displayBalance,
    balanceAnimating,
    soundMuted,
    toggleSoundMuted,
    gamesPlayed,
    formatKes,
    openChartInNewTab,
    chartPanelMode,
    accountBalance,
    stake,
    status,
  } = useBlockGamePlayer();
  const [fundOpen, setFundOpen] = useState(false);
  const [walletExpanded, setWalletExpanded] = useState(false);
  const shownBalance = Math.min(displayBalance, MAX_WALLET_BALANCE_KES);
  const needsFunds = accountBalance < MIN_STAKE_KES && status !== "playing";

  useEffect(() => {
    if (needsFunds) setWalletExpanded(true);
  }, [needsFunds]);

  if (phoneMode) {
    return (
      <>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-black/80 shadow-lg">
          <div className="p-2.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Balance</p>
                <p
                  className={cn(
                    "text-2xl font-bold leading-tight tabular-nums text-emerald-300",
                    balanceAnimating && "animate-pulse",
                  )}
                >
                  {formatKes(shownBalance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWalletExpanded((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 text-zinc-400"
                aria-label={walletExpanded ? "Collapse wallet panel" : "Expand stake and target"}
                aria-expanded={walletExpanded}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", walletExpanded && "rotate-180")} />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-end">
              <WalletIconToolbar
                soundMuted={soundMuted}
                toggleSoundMuted={toggleSoundMuted}
                chartPanelMode={chartPanelMode}
                openChartInNewTab={openChartInNewTab}
              />
            </div>
          </div>

          {walletExpanded && (
            <div className="max-h-[38vh] overflow-y-auto border-t border-white/10 px-2.5 pb-2.5 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <StakeOrFundsSlot onOpenFunds={() => setFundOpen(true)} />
                <TargetField />
              </div>
              <p className="mt-1.5 text-[9px] text-zinc-600">{gamesPlayed.toLocaleString()} rounds played</p>
            </div>
          )}
        </div>

        <FundRequestDialog open={fundOpen} onOpenChange={setFundOpen} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-black/80 p-2.5 shadow-lg sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 sm:h-10 sm:w-10">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Balance</p>
              <p
                className={cn(
                  "truncate text-lg font-bold tabular-nums text-emerald-300 sm:text-xl",
                  balanceAnimating && "animate-pulse",
                )}
              >
                {formatKes(shownBalance)}
              </p>
            </div>
          </div>

          <WalletIconToolbar
            soundMuted={soundMuted}
            toggleSoundMuted={toggleSoundMuted}
            chartPanelMode={chartPanelMode}
            openChartInNewTab={openChartInNewTab}
          />
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:gap-3">
          <StakeOrFundsSlot onOpenFunds={() => setFundOpen(true)} />
          <TargetField />
        </div>

        <p className="mt-1.5 text-[9px] text-zinc-600">{gamesPlayed.toLocaleString()} rounds played</p>
      </div>

      <FundRequestDialog open={fundOpen} onOpenChange={setFundOpen} />
    </>
  );
}

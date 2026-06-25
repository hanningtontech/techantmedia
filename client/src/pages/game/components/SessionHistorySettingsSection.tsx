import { ChevronRight, History } from "lucide-react";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { useLocation } from "wouter";
import { PLAYER_SESSION_ANALYSIS_PATH, PLAYER_SESSION_HISTORY_PATH } from "@/lib/game/playerSessionHistory";
import { Button } from "@/components/ui/button";
import { SessionHistorySummary } from "./PlayerSessionPhonePanel";

export function SessionHistorySettingsSection({ onOpenPhoneSession }: { onOpenPhoneSession?: () => void }) {
  const { sessionHistory, gamesPlayed } = useBlockGamePlayer();
  const isPhone = usePhoneGameLayout();
  const [, setLocation] = useLocation();
  const latest = sessionHistory[sessionHistory.length - 1];

  const openFull = () => {
    if (isPhone && onOpenPhoneSession) {
      onOpenPhoneSession();
      return;
    }
    setLocation(PLAYER_SESSION_HISTORY_PATH);
  };

  return (
    <div className="border-t border-white/10 pt-4">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Session table</p>
      <SessionHistorySummary className="mb-3" />

      {latest ? (
        <p className="mb-3 text-xs leading-snug text-zinc-500">
          Latest: round #{latest.gameIndex} · {latest.gridLabel}
        </p>
      ) : (
        <p className="mb-3 text-xs text-zinc-500">Play rounds to build your payout history.</p>
      )}

      {isPhone ? (
        <button
          type="button"
          onClick={openFull}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-3 text-left transition-colors hover:border-white/20 hover:bg-zinc-900"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <History className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-100">View session history</span>
              <span className="block text-[11px] text-zinc-500">
                {gamesPlayed > 0 ? `${gamesPlayed} rounds logged` : "No rounds yet"}
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full border-white/15 text-zinc-200"
            onClick={openFull}
          >
            <History className="mr-2 h-4 w-4" />
            Full session history
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full border-violet-500/25 text-violet-200"
            onClick={() => setLocation(PLAYER_SESSION_ANALYSIS_PATH)}
          >
            Session analysis
          </Button>
        </div>
      )}
    </div>
  );
}

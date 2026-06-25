import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { Button } from "@/components/ui/button";
import {
  GRID_COLOR_THEMES,
  GRID_STYLE_THEMES,
  PLAYER_GRID_PRESETS,
} from "@/lib/game/constants";
import { GridAppearanceSelector } from "./GridAppearanceSelector";
import { TargetSettingsSection } from "./TargetSettingsSection";
import { SessionHistorySettingsSection } from "./SessionHistorySettingsSection";

export function useGridAppearanceSummary() {
  const { gridPresetId, gridColorId, gridStyleId } = useBlockGamePlayer();
  const size = PLAYER_GRID_PRESETS.find((p) => p.id === gridPresetId)?.label ?? gridPresetId;
  const color = GRID_COLOR_THEMES.find((t) => t.id === gridColorId)?.label ?? gridColorId;
  const style = GRID_STYLE_THEMES.find((t) => t.id === gridStyleId)?.label ?? gridStyleId;
  return { size, color, style, summary: `${size} · ${color} · ${style}` };
}

export function GridSettingsContent({
  onRequestFunds,
  onOpenPhoneSession,
}: {
  onRequestFunds: () => void;
  onOpenPhoneSession?: () => void;
}) {
  const { summary } = useGridAppearanceSummary();

  return (
    <div className="space-y-4">
      <p className="text-sm leading-snug text-zinc-500">Current: {summary}</p>
      <GridAppearanceSelector embedded />
      <TargetSettingsSection />
      <SessionHistorySettingsSection onOpenPhoneSession={onOpenPhoneSession} />
      <div className="border-t border-white/10 pt-4">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Wallet</p>
        <Button
          type="button"
          variant="outline"
          className="w-full border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
          onClick={onRequestFunds}
        >
          Request funds
        </Button>
      </div>
    </div>
  );
}

import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  const { bombAnimationsEnabled, setBombAnimationsEnabled } = useBlockGamePlayer();

  return (
    <div className="space-y-4">
      <p className="text-sm leading-snug text-zinc-500">Current: {summary}</p>
      <GridAppearanceSelector embedded />
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Gameplay</p>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm text-zinc-200">Bomb hit effects</span>
          <Switch
            checked={bombAnimationsEnabled}
            onCheckedChange={setBombAnimationsEnabled}
            aria-label="Bomb hit effects"
          />
        </label>
        <p className="mt-2 text-xs leading-snug text-zinc-500">
          On: quick shake, flash, then bombs reveal in a fast cascade. Off: sound only with an instant
          board reveal.
        </p>
      </div>
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

import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import {
  getPlayerGridPresetsForPhone,
  GRID_COLOR_THEMES,
  GRID_STYLE_THEMES,
} from "@/lib/game/constants";
import { cn } from "@/lib/utils";

export function GridAppearanceSelector({ embedded = false }: { embedded?: boolean }) {
  const {
    gridPresetId,
    gridColorId,
    gridStyleId,
    setGridPreset,
    setGridColorTheme,
    setGridStyleTheme,
    status,
  } = useBlockGamePlayer();
  const disabled = status === "playing";
  const isPhone = usePhoneGameLayout();
  const gridPresets = getPlayerGridPresetsForPhone(isPhone);

  return (
    <div
      className={cn(
        "space-y-3",
        !embedded && "rounded-2xl border border-white/10 bg-black/30 p-3",
        embedded && "p-1",
      )}
    >
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Grid size</p>
        <div className="flex flex-wrap gap-1.5">
          {gridPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => setGridPreset(p.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                gridPresetId === p.id
                  ? "border-violet-500 bg-violet-500/20 text-violet-100"
                  : "border-white/10 bg-zinc-900/50 text-zinc-400 hover:border-white/20",
                disabled && "opacity-50",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Colour</p>
        <div className="flex flex-wrap gap-2">
          {GRID_COLOR_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              title={t.label}
              aria-label={`${t.label} theme`}
              onClick={() => setGridColorTheme(t.id)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg border px-2 transition-all",
                gridColorId === t.id
                  ? "border-white/40 bg-white/10 ring-2 ring-white/20"
                  : "border-white/10 bg-zinc-900/40 hover:border-white/25",
                disabled && "opacity-50",
              )}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-md shadow-inner"
                style={{
                  background: `linear-gradient(145deg, ${t.swatch}, color-mix(in srgb, ${t.swatch} 40%, #000))`,
                  boxShadow: gridColorId === t.id ? `0 0 10px ${t.swatch}` : undefined,
                }}
              />
              <span className="hidden text-xs text-zinc-300 sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Style</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {GRID_STYLE_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => setGridStyleTheme(t.id)}
              className={cn(
                "rounded-lg border px-2 py-2 text-left transition-colors",
                gridStyleId === t.id
                  ? "border-violet-500/60 bg-violet-500/15"
                  : "border-white/10 bg-zinc-900/40 hover:border-white/20",
                disabled && "opacity-50",
              )}
            >
              <span className="block text-xs font-medium text-zinc-200">{t.label}</span>
              <span className="block text-[9px] leading-tight text-zinc-500">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

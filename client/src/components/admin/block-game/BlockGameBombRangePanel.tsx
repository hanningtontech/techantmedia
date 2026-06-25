import { useEffect, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { subscribeBlockGameSettings } from "@/lib/game/blockGameFirestore";
import {
  defaultBombRanges,
  mergeBombRanges,
  type GridBombRange,
  type GridBombRanges,
} from "@/lib/game/bombRangeSettings";
import { BOMB_PCT_MAX, BOMB_PCT_MIN } from "@/lib/game/constants";
import { PLAYER_GRID_PRESETS } from "@/lib/game/gridThemes";
import { cn } from "@/lib/utils";

const PCT_MIN = 5;
const PCT_MAX = 90;
const PCT_STEP = 5;

function clampPct(n: number): number {
  return Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(n)));
}

function pctToDisplay(pct: number): string {
  return String(Math.round(pct * 100));
}

function PctStepper({
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (pct: number) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  const [text, setText] = useState(() => pctToDisplay(value));

  useEffect(() => {
    setText(pctToDisplay(value));
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setText(pctToDisplay(value));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setText(pctToDisplay(value));
      return;
    }
    onChange(clampPct(n) / 100);
  };

  const step = (delta: number) => {
    onChange(clampPct(Math.round(value * 100) + delta) / 100);
  };

  const displayPct = Math.round(value * 100);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || displayPct <= PCT_MIN}
        onClick={() => step(-PCT_STEP)}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-zinc-900 text-zinc-300 disabled:opacity-40"
        aria-label={`Decrease ${ariaLabel}`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "h-8 w-14 rounded border border-white/10 bg-zinc-900 px-2 text-center text-xs tabular-nums text-zinc-100",
          "outline-none focus:border-violet-500/60 disabled:opacity-60",
        )}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        disabled={disabled || displayPct >= PCT_MAX}
        onClick={() => step(PCT_STEP)}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-zinc-900 text-zinc-300 disabled:opacity-40"
        aria-label={`Increase ${ariaLabel}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function BlockGameBombRangePanel() {
  const [draft, setDraft] = useState<GridBombRanges>(() => defaultBombRanges());
  const [updatedAt, setUpdatedAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeBlockGameSettings((settings) => {
      setDraft(settings.bombRanges);
      setUpdatedAt(settings.updatedAt);
    });
  }, []);

  const setPreset = (id: string, patch: Partial<GridBombRange>) => {
    setDraft((prev) => {
      const cur = prev[id] ?? { pctMin: BOMB_PCT_MIN, pctMax: BOMB_PCT_MAX };
      const next = { ...cur, ...patch };
      if (next.pctMin > next.pctMax) [next.pctMin, next.pctMax] = [next.pctMax, next.pctMin];
      return { ...prev, [id]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const bombRanges = mergeBombRanges(draft);
      const res = await apiFetch("/api/block-game/settings/bomb-ranges", {
        method: "POST",
        body: JSON.stringify({ bombRanges }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save bomb ranges.");
      }
      const data = (await res.json()) as { bombRanges: GridBombRanges; updatedAt: string };
      setDraft(data.bombRanges);
      setUpdatedAt(data.updatedAt);
      toast.success("Bomb ranges saved — new /game rounds use these limits.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save bomb ranges.");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => setDraft(defaultBombRanges());

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Per-grid random bomb density for live <span className="font-mono text-zinc-300">/game</span> rounds. Each new
        round picks a bomb count between min% and max% of cells. Defaults: 30%–55%. Use ±5 or type a value (5–90).
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-900/80 text-[10px] uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Grid</th>
              <th className="px-3 py-2">Cells</th>
              <th className="px-3 py-2">Min %</th>
              <th className="px-3 py-2">Max %</th>
              <th className="px-3 py-2">Bomb range</th>
            </tr>
          </thead>
          <tbody>
            {PLAYER_GRID_PRESETS.map((p) => {
              const total = p.rows * p.cols;
              const r = draft[p.id] ?? { pctMin: BOMB_PCT_MIN, pctMax: BOMB_PCT_MAX };
              const minB = Math.max(1, Math.ceil(total * r.pctMin));
              const maxB = Math.max(minB, Math.floor(total * r.pctMax));
              return (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="px-3 py-2 font-medium text-zinc-200">{p.label}</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-500">{total}</td>
                  <td className="px-3 py-2">
                    <PctStepper
                      value={r.pctMin}
                      onChange={(pctMin) => setPreset(p.id, { pctMin })}
                      aria-label={`${p.label} minimum bomb percent`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PctStepper
                      value={r.pctMax}
                      onChange={(pctMax) => setPreset(p.id, { pctMax })}
                      aria-label={`${p.label} maximum bomb percent`}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-zinc-500">
                    {minB}–{maxB} bombs
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-500">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save bomb ranges
        </Button>
        <Button type="button" variant="outline" onClick={resetDefaults} className="border-white/15">
          Reset to 30–55%
        </Button>
        {updatedAt ? (
          <p className="text-xs text-zinc-500">Last saved {new Date(updatedAt).toLocaleString()}</p>
        ) : null}
      </div>
    </div>
  );
}

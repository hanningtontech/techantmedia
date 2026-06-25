import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { AdminField } from "@/components/admin/shared/AdminField";
import { uploadXaiPortfolioFile } from "@/lib/xai-portfolio/xaiPortfolioUpload";
import type { BeforeAfterPair } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { newXaiId } from "@/lib/xai-portfolio/xaiPortfolioDefaults";

type Props = {
  pairs: BeforeAfterPair[];
  onChange: (pairs: BeforeAfterPair[]) => void;
};

export function XaiBeforeAfterManager({ pairs, onChange }: Props) {
  const sorted = [...pairs].sort((a, b) => a.order - b.order);

  const updatePair = (id: string, patch: Partial<BeforeAfterPair>) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const movePair = (id: string, dir: -1 | 1) => {
    const list = [...sorted];
    const idx = list.findIndex((p) => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const next = list.map((p, i) => ({ ...p, order: i }));
    const a = next[idx];
    const b = next[swap];
    next[idx] = { ...b, order: idx };
    next[swap] = { ...a, order: swap };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Upload raw vs. final stills. Shown as interactive sliders on /portfolio (featured on rotoscoping & color case studies).
      </p>
      {sorted.map((pair, idx) => (
        <div key={pair.id} className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Pair {idx + 1}</span>
            <button type="button" className="rounded border border-white/10 p-1.5 text-zinc-400" onClick={() => movePair(pair.id, -1)} aria-label="Move up">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" className="rounded border border-white/10 p-1.5 text-zinc-400" onClick={() => movePair(pair.id, 1)} aria-label="Move down">
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ml-auto text-sm text-red-400 hover:underline"
              onClick={() => onChange(pairs.filter((p) => p.id !== pair.id))}
            >
              <Trash2 className="inline h-4 w-4" /> Remove
            </button>
          </div>
          <AdminField label="Label (e.g. Hair edge / Sky grade)">
            <input className="admin-input" value={pair.label} onChange={(e) => updatePair(pair.id, { label: e.target.value })} />
          </AdminField>
          <PortfolioImageUpload
            label="Before (raw)"
            value={pair.beforeUrl}
            uploadImage={uploadXaiPortfolioFile}
            onChange={(beforeUrl) => updatePair(pair.id, { beforeUrl })}
          />
          <PortfolioImageUpload
            label="After (final)"
            value={pair.afterUrl}
            uploadImage={uploadXaiPortfolioFile}
            onChange={(afterUrl) => updatePair(pair.id, { afterUrl })}
          />
        </div>
      ))}
      <button
        type="button"
        className="text-sm text-cyan-400 hover:underline"
        onClick={() =>
          onChange([...pairs, { id: newXaiId(), order: pairs.length, label: "", beforeUrl: "", afterUrl: "" }])
        }
      >
        + Add before/after pair
      </button>
    </div>
  );
}

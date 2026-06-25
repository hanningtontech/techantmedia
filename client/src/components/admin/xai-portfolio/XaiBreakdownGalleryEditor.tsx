import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { AdminField } from "@/components/admin/shared/AdminField";
import { uploadXaiPortfolioFile } from "@/lib/xai-portfolio/xaiPortfolioUpload";
import type { BreakdownImage } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { newXaiId } from "@/lib/xai-portfolio/xaiPortfolioDefaults";

type Props = {
  images: BreakdownImage[];
  onChange: (images: BreakdownImage[]) => void;
};

export function XaiBreakdownGalleryEditor({ images, onChange }: Props) {
  const sorted = [...images].sort((a, b) => a.order - b.order);

  const updateImage = (id: string, patch: Partial<BreakdownImage>) => {
    onChange(images.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  };

  const moveImage = (id: string, dir: -1 | 1) => {
    const list = [...sorted];
    const idx = list.findIndex((img) => img.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const next = list.map((img, i) => ({ ...img, order: i }));
    const a = next[idx];
    const b = next[swap];
    next[idx] = { ...b, order: idx };
    next[swap] = { ...a, order: swap };
    onChange(next);
  };

  const appendUrl = (url: string) => {
    onChange([...images, { id: newXaiId(), order: images.length, url, caption: "" }]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Alpha mattes, tracking points, Fusion node trees — shown in a lightbox grid on /portfolio.
      </p>
      <PortfolioImageUpload
        label="Upload breakdown asset"
        value=""
        mode="append"
        uploadImage={uploadXaiPortfolioFile}
        onChange={() => {}}
        onAppend={appendUrl}
      />
      {sorted.map((img, idx) => (
        <div key={img.id} className="flex gap-4 rounded-lg border border-rose-500/25 bg-rose-500/[0.04] p-3">
          {img.url ? (
            <img src={img.url} alt="" className="h-20 w-32 shrink-0 rounded object-cover bg-black" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">#{idx + 1}</span>
              <button type="button" className="rounded border border-white/10 p-1 text-zinc-400" onClick={() => moveImage(img.id, -1)} aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded border border-white/10 p-1 text-zinc-400" onClick={() => moveImage(img.id, 1)} aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="ml-auto text-red-400" onClick={() => onChange(images.filter((x) => x.id !== img.id))} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <AdminField label="Caption">
              <input
                className="admin-input text-sm"
                value={img.caption}
                placeholder="e.g. Fusion alpha matte · planar track"
                onChange={(e) => updateImage(img.id, { caption: e.target.value })}
              />
            </AdminField>
            <AdminField label="Image URL">
              <input className="admin-input text-sm" value={img.url} onChange={(e) => updateImage(img.id, { url: e.target.value })} />
            </AdminField>
          </div>
        </div>
      ))}
    </div>
  );
}

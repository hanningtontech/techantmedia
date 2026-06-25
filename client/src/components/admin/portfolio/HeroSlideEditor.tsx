import { Loader2 } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import type { ListItemAccent } from "@/lib/admin/listItemAccent";
import { LIST_ITEM_ACCENT_CLASS } from "@/lib/admin/listItemAccent";
import type { HeroAnimation, PhotoHeroSlide } from "@/lib/portfolio/portfolioTypes";
import { cn } from "@/lib/utils";

const HERO_ANIMATIONS: HeroAnimation[] = ["filmDissolve", "slide", "kenburns"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2 admin-prose">
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

type Props = {
  slide: PhotoHeroSlide;
  index: number;
  accent: ListItemAccent;
  dirty: boolean;
  saving: boolean;
  defaultOpen?: boolean;
  onChange: (patch: Partial<PhotoHeroSlide>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  /** Publish image removal to the live site (cleared LQ/HQ). */
  onPersistSlidePatch?: (patch: Partial<PhotoHeroSlide>) => void;
};

export function HeroSlideEditor({
  slide,
  index,
  accent,
  dirty,
  saving,
  defaultOpen,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onPersistSlidePatch,
}: Props) {
  const styles = LIST_ITEM_ACCENT_CLASS[accent];
  const sectionAccent = accent === "teal" ? "teal" : accent === "violet" ? "violet" : "orange";

  return (
    <div className={cn("rounded-2xl border p-4 ring-1 sm:p-5", styles.wrap)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-xs font-bold uppercase tracking-wider", styles.header)}>
          Slide {index + 1}
        </span>
        {dirty ? (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1", styles.badge)}>Unsaved</span>
        ) : null}
      </div>
      <AdminSection title={slide.alt || `Slide ${index + 1}`} accent={sectionAccent} defaultOpen={defaultOpen}>
        <div className="grid gap-6 sm:grid-cols-2">
          <PortfolioImageUpload
            label="Low quality (LQ) — loads first"
            accent="purple"
            previewSize="large"
            value={slide.srcLq}
            onChange={(srcLq) => {
              onChange({ srcLq });
              if (!srcLq.trim()) onPersistSlidePatch?.({ srcLq: "" });
            }}
            hint="Fast placeholder: ~800px wide, strong JPEG compression (q40–60). Same crop as HQ."
          />
          <PortfolioImageUpload
            label="High quality (HQ) — fades in after load"
            previewSize="large"
            value={slide.src}
            onChange={(src) => {
              onChange({ src });
              if (!src.trim()) onPersistSlidePatch?.({ src: "" });
            }}
            hint="Full hero: 1920×1080 or larger, 16:9, sRGB. Shown after LQ with a smooth fade."
          />
        </div>
        <Field label="Alt text">
          <input className="admin-input" value={slide.alt} onChange={(e) => onChange({ alt: e.target.value })} />
        </Field>
        <Field label="Caption (optional)">
          <input
            className="admin-input"
            value={slide.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value })}
          />
        </Field>
        <Field label="Animation">
          <select
            className="admin-input"
            value={slide.animation}
            onChange={(e) => onChange({ animation: e.target.value as HeroAnimation })}
          >
            {HERO_ANIMATIONS.map((a) => (
              <option key={a} value={a}>
                {a === "filmDissolve" ? "Film dissolve" : a}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save slide"}
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onCancel}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button type="button" className="ml-auto text-sm text-red-400 hover:underline" onClick={onDelete}>
            Delete slide
          </button>
        </div>
      </AdminSection>
    </div>
  );
}

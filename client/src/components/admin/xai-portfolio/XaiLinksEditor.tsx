import { Plus, Trash2 } from "lucide-react";
import { AdminField } from "@/components/admin/shared/AdminField";
import type { XaiLink } from "@/lib/xai-portfolio/xaiPortfolioTypes";

type Props = {
  label: string;
  hint?: string;
  links: XaiLink[];
  onChange: (links: XaiLink[]) => void;
  addLabel?: string;
  defaultNew?: XaiLink;
};

export function XaiLinksEditor({
  label,
  hint,
  links,
  onChange,
  addLabel = "Add link",
  defaultNew = { label: "YouTube", href: "" },
}: Props) {
  return (
    <AdminField label={label} tone="teal">
      {hint ? <p className="mb-2 text-xs text-zinc-500">{hint}</p> : null}
      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="grid min-w-0 gap-2 sm:grid-cols-[7rem_1fr_auto]">
            <input
              className="admin-input"
              value={link.label}
              placeholder="Label"
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...link, label: e.target.value };
                onChange(next);
              }}
            />
            <input
              className="admin-input min-w-0"
              value={link.href}
              placeholder="https://youtube.com/…"
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...link, href: e.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-red-400"
              onClick={() => onChange(links.filter((_, j) => j !== i))}
              aria-label="Remove link"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm text-teal-300"
          onClick={() => onChange([...links, { ...defaultNew }])}
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
    </AdminField>
  );
}

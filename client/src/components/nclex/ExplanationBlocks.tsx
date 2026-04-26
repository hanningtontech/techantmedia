import { splitExplanationSections } from "@/lib/nclex/explanationSections";
import { cn } from "@/lib/utils";

type Props = {
  rationale: string;
  /** Optional admin-only supplement (e.g. "Why the others are not correct"). */
  adminExtra?: string;
  className?: string;
  /** When true, uses slightly stronger accent for admin-only blocks. */
  adminTone?: boolean;
};

export function ExplanationBlocks({ rationale, adminExtra, className, adminTone }: Props) {
  const sections = splitExplanationSections(rationale);
  const extra = (adminExtra ?? "").trim();

  if (sections.length === 0 && !extra) return null;

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:p-4", className)}>
      <div className="space-y-3">
        {sections.map((s, idx) => (
          <div key={`${s.title}-${idx}`} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{s.title}</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{s.body}</p>
          </div>
        ))}

        {extra ? (
          <div className={cn("space-y-1.5", adminTone && "rounded-md border border-violet-200 bg-violet-50/40 p-3")}>
            <p className={cn("text-xs font-semibold uppercase tracking-wide", adminTone ? "text-violet-900" : "text-slate-600")}>
              Why the others are not correct
            </p>
            <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", adminTone ? "text-violet-950" : "text-slate-900")}>
              {extra}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}


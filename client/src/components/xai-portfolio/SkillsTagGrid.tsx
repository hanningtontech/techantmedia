import { useState } from "react";
import type { XaiSkillEntry } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { SKILL_CATEGORIES } from "@/lib/xai-portfolio/xaiPortfolioDefaults";
import { cn } from "@/lib/utils";

const PROFICIENCY_STYLES: Record<string, string> = {
  Beginner: "ring-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  Intermediate: "ring-blue-500/35 bg-blue-500/10 text-blue-200",
  Advanced: "ring-violet-500/35 bg-violet-500/10 text-violet-200",
  Expert: "ring-emerald-500/35 bg-emerald-500/10 text-emerald-200",
};

type Props = {
  skills: XaiSkillEntry[];
  /** Tap tags to show detail (for phones). */
  touchMode?: boolean;
};

export function SkillsTagGrid({ skills, touchMode = false }: Props) {
  const byCategory = SKILL_CATEGORIES.map((category) => ({
    category,
    items: skills.filter((s) => s.category === category).sort((a, b) => a.order - b.order),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-10">
      {byCategory.map(({ category, items }) => (
        <section key={category}>
          <h3 className="font-mono-tech text-xs font-semibold uppercase tracking-widest text-cyan-400">
            {category}
          </h3>
          <ul className={cn("mt-4 flex flex-wrap gap-2", touchMode && "flex-col sm:flex-row")}>
            {items.map((skill) => (
              <SkillTag key={skill.id} skill={skill} touchMode={touchMode} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SkillTag({ skill, touchMode }: { skill: XaiSkillEntry; touchMode: boolean }) {
  const ring = PROFICIENCY_STYLES[skill.proficiency] ?? PROFICIENCY_STYLES.Intermediate;
  const tip = skill.detail.trim();
  const [open, setOpen] = useState(false);

  if (touchMode) {
    return (
      <li className="w-full sm:w-auto">
        <button
          type="button"
          className={cn(
            `inline-flex w-full items-center justify-between gap-2 rounded-full px-3.5 py-2 text-left text-sm font-medium ring-1 ring-inset transition sm:w-auto ${ring}`,
          )}
          onClick={() => tip && setOpen((v) => !v)}
          aria-expanded={tip ? open : undefined}
        >
          <span>{skill.name}</span>
          <span className="font-mono-tech shrink-0 text-[10px] uppercase opacity-70">{skill.proficiency}</span>
        </button>
        {tip && open ? (
          <p className="font-mono-tech mt-2 rounded-lg border border-white/10 bg-[#12121a] px-3 py-2 text-xs leading-relaxed text-zinc-400">
            {tip}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="group relative">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition hover:scale-[1.02] ${ring}`}
      >
        <span>{skill.name}</span>
        <span className="font-mono-tech text-[10px] uppercase opacity-70">{skill.proficiency}</span>
      </span>
      {tip ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-[#12121a] px-3 py-2 text-xs leading-relaxed text-zinc-300 opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {tip}
        </div>
      ) : null}
    </li>
  );
}

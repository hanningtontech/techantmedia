import type { SkillProficiency, XaiSkillEntry } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { SKILL_CATEGORIES } from "@/lib/xai-portfolio/xaiPortfolioDefaults";
import { cn } from "@/lib/utils";

type Props = {
  skills: XaiSkillEntry[];
};

const PROFICIENCY_ORDER: SkillProficiency[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

const PROFICIENCY_INDEX: Record<SkillProficiency, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
  Expert: 4,
};

const METER_ACTIVE: Record<SkillProficiency, string> = {
  Beginner: "bg-zinc-400",
  Intermediate: "bg-blue-400",
  Advanced: "bg-violet-400",
  Expert: "bg-emerald-400",
};

export function SkillsSection({ skills }: Props) {
  const byCategory = SKILL_CATEGORIES.map((category) => ({
    category,
    items: skills.filter((s) => s.category === category).sort((a, b) => a.order - b.order),
  })).filter((g) => g.items.length > 0);

  if (!byCategory.length) return null;

  return (
    <div className="space-y-8">
      <ProficiencyLegend />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {byCategory.map(({ category, items }) => (
          <CategoryPanel key={category} category={category} items={items} />
        ))}
      </div>
    </div>
  );
}

function ProficiencyLegend() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0e0e14]/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="font-mono-tech text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Proficiency scale
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {PROFICIENCY_ORDER.map((level) => (
          <li key={level} className="flex items-center gap-2">
            <ProficiencyMeter level={level} compact />
            <span className="font-mono-tech text-[10px] uppercase tracking-wide text-zinc-500">{level}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryPanel({ category, items }: { category: string; items: XaiSkillEntry[] }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0e0e14] shadow-sm shadow-black/20">
      <header className="border-b border-white/10 bg-gradient-to-r from-cyan-500/[0.06] to-transparent px-5 py-4">
        <h3 className="font-mono-tech text-xs font-semibold uppercase tracking-widest text-cyan-400/90">
          {category}
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          {items.length} {items.length === 1 ? "capability" : "capabilities"}
        </p>
      </header>
      <ul className="divide-y divide-white/[0.06]">
        {items.map((skill) => (
          <li key={skill.id} className="px-5 py-4 transition-colors hover:bg-white/[0.02]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium leading-snug text-zinc-100">{skill.name}</p>
              <ProficiencyMeter level={skill.proficiency} />
            </div>
            {skill.detail.trim() ? (
              <p className="font-mono-tech mt-2 text-xs leading-relaxed text-zinc-500">{skill.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

function ProficiencyMeter({ level, compact = false }: { level: SkillProficiency; compact?: boolean }) {
  const filled = PROFICIENCY_INDEX[level] ?? 2;
  const activeColor = METER_ACTIVE[level] ?? METER_ACTIVE.Intermediate;

  return (
    <div
      className={cn("flex shrink-0 items-center gap-2", compact ? "gap-1.5" : "gap-2.5")}
      role="img"
      aria-label={`${level} proficiency`}
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "rounded-full transition-colors",
              compact ? "h-1 w-3" : "h-1.5 w-5",
              segment <= filled ? activeColor : "bg-white/10",
            )}
          />
        ))}
      </div>
      {!compact ? (
        <span className="font-mono-tech w-[5.5rem] text-right text-[10px] uppercase tracking-wide text-zinc-500">
          {level}
        </span>
      ) : null}
    </div>
  );
}

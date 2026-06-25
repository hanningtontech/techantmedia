import { useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DevSkillEntry, DevSkillProficiency } from "@/lib/portfolio/portfolioTypes";
import { DEV_SKILL_CATEGORIES } from "@/lib/portfolio/developmentSkillDefaults";
import { cn } from "@/lib/utils";

type Props = {
  skills: DevSkillEntry[];
};

const PROFICIENCY_ORDER: DevSkillProficiency[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

const PROFICIENCY_INDEX: Record<DevSkillProficiency, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
  Expert: 4,
};

const METER_ACTIVE: Record<DevSkillProficiency, string> = {
  Beginner: "bg-zinc-400",
  Intermediate: "bg-blue-400",
  Advanced: "bg-violet-400",
  Expert: "bg-emerald-400",
};

export function DevelopmentSkillsSection({ skills }: Props) {
  const byCategory = DEV_SKILL_CATEGORIES.map((category) => ({
    category,
    items: skills.filter((s) => s.category === category).sort((a, b) => a.order - b.order),
  })).filter((g) => g.items.length > 0);

  const [activeSkill, setActiveSkill] = useState<DevSkillEntry | null>(null);

  if (!byCategory.length) return null;

  return (
    <>
      <div className="space-y-8">
        <ProficiencyLegend />

        <p className="flex items-start gap-2 text-sm text-zinc-500 sm:items-center">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-400/80 sm:mt-0" aria-hidden />
          <span>Tap a skill to see where I&apos;ve applied it and how it helps on real projects.</span>
        </p>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {byCategory.map(({ category, items }) => (
            <CategoryPanel
              key={category}
              category={category}
              items={items}
              onSelect={(skill) => skill.detail.trim() && setActiveSkill(skill)}
            />
          ))}
        </div>
      </div>

      <Dialog open={!!activeSkill} onOpenChange={(open) => !open && setActiveSkill(null)}>
        {activeSkill ? (
          <DialogContent className="max-w-md border-white/10 bg-[#12121a] text-zinc-100 sm:max-w-lg">
            <DialogHeader>
              <p className="font-mono-tech text-[10px] font-semibold uppercase tracking-widest text-teal-400/90">
                {activeSkill.category}
              </p>
              <DialogTitle className="text-left text-lg text-white">{activeSkill.name}</DialogTitle>
              <div className="flex justify-start pt-1">
                <ProficiencyMeter level={activeSkill.proficiency} />
              </div>
              <DialogDescription className="sr-only">Where applied and how it helps</DialogDescription>
            </DialogHeader>
            <p className="text-sm leading-relaxed text-zinc-300">{activeSkill.detail}</p>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
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

function CategoryPanel({
  category,
  items,
  onSelect,
}: {
  category: string;
  items: DevSkillEntry[];
  onSelect: (skill: DevSkillEntry) => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0e0e14] shadow-sm shadow-black/20">
      <header className="border-b border-white/10 bg-gradient-to-r from-teal-500/[0.08] to-transparent px-5 py-4">
        <h3 className="font-mono-tech text-xs font-semibold uppercase tracking-widest text-teal-400/90">
          {category}
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          {items.length} {items.length === 1 ? "capability" : "capabilities"}
        </p>
      </header>
      <ul className="divide-y divide-white/[0.06]">
        {items.map((skill) => {
          const hasDetail = Boolean(skill.detail.trim());
          return (
            <li key={skill.id}>
              {hasDetail ? (
                <button
                  type="button"
                  className="w-full px-5 py-4 text-left transition-colors hover:bg-teal-500/[0.04] focus-visible:bg-teal-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-inset"
                  onClick={() => onSelect(skill)}
                >
                  <SkillRowContent skill={skill} interactive />
                </button>
              ) : (
                <div className="px-5 py-4">
                  <SkillRowContent skill={skill} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function SkillRowContent({ skill, interactive = false }: { skill: DevSkillEntry; interactive?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p
        className={cn(
          "text-sm font-medium leading-snug text-zinc-100",
          interactive && "group-hover:text-teal-100",
        )}
      >
        {skill.name}
        {interactive ? (
          <span className="mt-1 block font-mono-tech text-[10px] font-normal uppercase tracking-wide text-teal-500/70">
            View note →
          </span>
        ) : null}
      </p>
      <ProficiencyMeter level={skill.proficiency} />
    </div>
  );
}

function ProficiencyMeter({ level, compact = false }: { level: DevSkillProficiency; compact?: boolean }) {
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

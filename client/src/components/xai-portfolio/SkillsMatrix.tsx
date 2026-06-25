import type { SkillCategory, XaiSkillEntry } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { SKILL_CATEGORIES } from "@/lib/xai-portfolio/xaiPortfolioDefaults";

const PROFICIENCY_STYLES: Record<string, string> = {
  Beginner: "bg-zinc-500/20 text-zinc-300 ring-zinc-500/30",
  Intermediate: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  Advanced: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Expert: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

type Props = {
  skills: XaiSkillEntry[];
};

export function SkillsMatrix({ skills }: Props) {
  const byCategory = SKILL_CATEGORIES.map((category) => ({
    category,
    items: skills.filter((s) => s.category === category).sort((a, b) => a.order - b.order),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="font-mono-tech px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Category
            </th>
            <th className="font-mono-tech px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Tool / capability
            </th>
            <th className="font-mono-tech px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Proficiency
            </th>
            <th className="font-mono-tech px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {byCategory.map(({ category, items }) =>
            items.map((skill, idx) => (
              <tr key={skill.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-zinc-400">
                  {idx === 0 ? <CategoryLabel category={category} /> : null}
                </td>
                <td className="px-4 py-3 font-medium text-white">{skill.name}</td>
                <td className="px-4 py-3">
                  <ProficiencyBadge level={skill.proficiency} />
                </td>
                <td className="font-mono-tech max-w-md px-4 py-3 text-xs leading-relaxed text-zinc-500">
                  {skill.detail.trim() || "—"}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function CategoryLabel({ category }: { category: SkillCategory }) {
  return (
    <span className="font-mono-tech text-xs font-semibold uppercase tracking-wider text-cyan-400">{category}</span>
  );
}

function ProficiencyBadge({ level }: { level: string }) {
  return (
    <span
      className={`font-mono-tech inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${PROFICIENCY_STYLES[level] ?? PROFICIENCY_STYLES.Intermediate}`}
    >
      {level}
    </span>
  );
}

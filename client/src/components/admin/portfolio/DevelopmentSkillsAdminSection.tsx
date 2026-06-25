import type { Dispatch, SetStateAction } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import {
  DEV_SKILL_CATEGORIES,
  DEV_SKILL_PROFICIENCIES,
  newDevSkillId,
} from "@/lib/portfolio/developmentSkillDefaults";
import type { DevSkillCategory, DevSkillEntry, DevSkillProficiency, SiteContent } from "@/lib/portfolio/portfolioTypes";

type Props = {
  draft: SiteContent;
  setDraft: Dispatch<SetStateAction<SiteContent>>;
};

export function DevelopmentSkillsAdminSection({ draft, setDraft }: Props) {
  const skills = draft.devSkillEntries;

  const updateSkills = (next: DevSkillEntry[]) => {
    setDraft((d) => ({ ...d, devSkillEntries: next.map((s, i) => ({ ...s, order: i })) }));
  };

  const moveSkill = (id: string, delta: number) => {
    const sorted = [...skills].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swap = idx + delta;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[swap]!;
    updateSkills(
      skills.map((s) => {
        if (s.id === a.id) return { ...s, order: b.order };
        if (s.id === b.id) return { ...s, order: a.order };
        return s;
      }),
    );
  };

  const addSkill = () => {
    const order = skills.length;
    const entry: DevSkillEntry = {
      id: newDevSkillId(),
      order,
      category: "Frontend",
      name: "New skill",
      proficiency: "Intermediate",
      detail: "",
    };
    updateSkills([...skills, entry]);
  };

  return (
    <AdminPage
      title="Development skills"
      description="Grouped competencies on /development — tap opens the applied / helps note."
      width="editor"
      layout="stack"
      showLayoutGuide={false}
    >
      <AdminSection
        title="Core technical skills"
        description="Matches the video portfolio layout: categories, proficiency meters, and detail notes."
        accent="teal"
        defaultOpen
      >
        {[...skills]
          .sort((a, b) => a.order - b.order)
          .map((skill) => (
            <DevSkillRow
              key={skill.id}
              skill={skill}
              onMoveUp={() => moveSkill(skill.id, -1)}
              onMoveDown={() => moveSkill(skill.id, 1)}
              onChange={(patch) =>
                setDraft((d) => ({
                  ...d,
                  devSkillEntries: d.devSkillEntries.map((s) => (s.id === skill.id ? { ...s, ...patch } : s)),
                }))
              }
              onDelete={() => updateSkills(skills.filter((s) => s.id !== skill.id))}
            />
          ))}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-teal-500/40 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-300 hover:bg-teal-500/20"
          onClick={addSkill}
        >
          <Plus className="h-4 w-4" />
          Add skill
        </button>
      </AdminSection>
    </AdminPage>
  );
}

function DevSkillRow({
  skill,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  skill: DevSkillEntry;
  onChange: (patch: Partial<DevSkillEntry>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="mb-4 rounded-lg border border-white/10 p-4">
      <div className="mb-3 flex gap-2">
        <button type="button" className="rounded border border-white/10 p-2 text-zinc-400" onClick={onMoveUp} aria-label="Move up">
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" className="rounded border border-white/10 p-2 text-zinc-400" onClick={onMoveDown} aria-label="Move down">
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Category" tone="teal" fieldSize="medium">
          <select
            className="admin-input"
            value={skill.category}
            onChange={(e) => onChange({ category: e.target.value as DevSkillCategory })}
          >
            {DEV_SKILL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Name" tone="teal" fieldSize="medium">
          <input className="admin-input" value={skill.name} onChange={(e) => onChange({ name: e.target.value })} />
        </AdminField>
        <AdminField label="Proficiency" tone="teal" fieldSize="medium">
          <select
            className="admin-input"
            value={skill.proficiency}
            onChange={(e) => onChange({ proficiency: e.target.value as DevSkillProficiency })}
          >
            {DEV_SKILL_PROFICIENCIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Applied / helps (tap note on site)" tone="teal" fieldSize="full" className="sm:col-span-2">
          <textarea
            className="admin-input min-h-[88px] resize-y"
            value={skill.detail}
            placeholder="Where you've used this and what it delivers — e.g. Passmartshop checkout, Firebase CMS…"
            onChange={(e) => onChange({ detail: e.target.value })}
          />
        </AdminField>
        <div className="flex items-end sm:col-span-2">
          <button type="button" className="inline-flex items-center gap-1 text-sm text-red-400 hover:underline" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete skill
          </button>
        </div>
      </div>
    </div>
  );
}

import { ArrowDown, ArrowUp, Plus, Rocket, Trash2 } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { XaiCaseStudyPanel } from "@/components/admin/xai-portfolio/XaiCaseStudyPanel";
import { XaiBeforeAfterManager } from "@/components/admin/xai-portfolio/XaiBeforeAfterManager";
import { XaiBreakdownGalleryEditor } from "@/components/admin/xai-portfolio/XaiBreakdownGalleryEditor";
import { XaiLinksEditor } from "@/components/admin/xai-portfolio/XaiLinksEditor";
import { XaiMarkdownField } from "@/components/admin/xai-portfolio/XaiMarkdownField";
import { XaiVideoAdminField } from "@/components/admin/xai-portfolio/XaiVideoAdminField";
import { XaiWebsiteVisibilityToggle } from "@/components/admin/xai-portfolio/XaiWebsiteVisibilityToggle";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import type { AdminNavId } from "@/lib/admin/constants";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { DEFAULT_XAI_PORTFOLIO, newXaiId, SKILL_CATEGORIES } from "@/lib/xai-portfolio/xaiPortfolioDefaults";
import { uploadXaiPortfolioFile } from "@/lib/xai-portfolio/xaiPortfolioUpload";
import type {
  SkillCategory,
  SkillProficiency,
  XaiCaseStudy,
  XaiPortfolioContent,
  XaiProfileLink,
  XaiSkillEntry,
} from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { toast } from "sonner";

const PROFICIENCIES: SkillProficiency[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

function StringListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <AdminField label={label} tone="teal">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex min-w-0 gap-2">
            <input
              className="admin-input min-w-0 flex-1"
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-red-400"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm text-teal-300"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </AdminField>
  );
}

type Props = {
  section: AdminNavId;
  draft: XaiPortfolioContent;
  setDraft: React.Dispatch<React.SetStateAction<XaiPortfolioContent>>;
  busy: boolean;
  persistXai: (
    updater: (current: XaiPortfolioContent) => XaiPortfolioContent,
    successMessage?: string,
  ) => Promise<void>;
};

function PublishBar({
  busy,
  onPublish,
  hint,
}: {
  busy: boolean;
  onPublish: () => void;
  hint?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
      <p className="text-sm text-zinc-400">{hint ?? "Save changes to the live /portfolio page."}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onPublish}
        className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        <Rocket className="h-4 w-4" />
        {busy ? "Publishing…" : "Publish changes"}
      </button>
    </div>
  );
}

export function XaiPortfolioAdminSections({ section, draft, setDraft, busy, persistXai }: Props) {
  const publishDraft = () => void persistXai((_current) => draft, "xAI portfolio published to /portfolio.");
  const visibilityToggle = <XaiWebsiteVisibilityToggle draft={draft} busy={busy} persistXai={persistXai} />;

  const persistStudyPatch = (id: string, patch: Partial<XaiCaseStudy>, message?: string) => {
    void persistXai(
      (d) => ({
        ...d,
        caseStudies: d.caseStudies.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }),
      message,
    );
  };
  const updateStudy = (id: string, patch: Partial<XaiCaseStudy>) => {
    setDraft((d) => ({
      ...d,
      caseStudies: d.caseStudies.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const moveStudy = (id: string, dir: -1 | 1) => {
    setDraft((d) => {
      const sorted = [...d.caseStudies].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return d;
      const next = sorted.map((s, i) => ({ ...s, order: i }));
      const a = next[idx];
      const b = next[swap];
      next[idx] = { ...b, order: idx };
      next[swap] = { ...a, order: swap };
      return { ...d, caseStudies: next };
    });
  };

  const moveSkill = (id: string, dir: -1 | 1) => {
    setDraft((d) => {
      const sorted = [...d.skills].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return d;
      const next = sorted.map((s, i) => ({ ...s, order: i }));
      const a = next[idx];
      const b = next[swap];
      next[idx] = { ...b, order: idx };
      next[swap] = { ...a, order: swap };
      return { ...d, skills: next };
    });
  };

  const setProfileLinks = (next: { label: string; href: string }[]) => {
    setDraft((d) => ({
      ...d,
      links: next.map((link, i) => {
        const existing = d.links[i];
        return {
          id: existing?.id ?? newXaiId(),
          order: i,
          label: link.label,
          href: link.href,
        } satisfies XaiProfileLink;
      }),
    }));
  };

  if (section === "xai.header") {
    return (
      <AdminPage
        title="Profile & CV"
        description="Your name line, intro paragraph, and CV file on /portfolio. Section headings stay fixed in the template."
        width="standard"
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={publishDraft}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Rocket className="h-4 w-4" />
            Publish
          </button>
        }
      >
        {visibilityToggle}
        <PublishBar busy={busy} onPublish={publishDraft} />
        <AdminSection title="CV (PDF)" accent="violet" defaultOpen>
          <p className="mb-3 text-sm text-zinc-500">
            Master CV for the xAI application. Visitors use <strong className="text-zinc-300">View CV</strong> or{" "}
            <strong className="text-zinc-300">Download PDF</strong> on /portfolio (served via secure API).
          </p>
          {draft.cvDownloadUrl ? (
            <p className="mb-3 text-sm text-zinc-400">
              <span className="font-mono-tech">{draft.cvFileName || "cv.pdf"}</span>{" "}
              <a href="/api/download-cv" className="text-cyan-400 hover:underline" target="_blank" rel="noreferrer">
                test open
              </a>
              {" · "}
              <a href="/api/download-cv?download=1" className="text-cyan-400 hover:underline">
                test download
              </a>
              <button
                type="button"
                className="ml-3 text-red-400 hover:underline"
                onClick={() => void persistXai((d) => ({ ...d, cvDownloadUrl: "", cvFileName: "" }), "CV removed.")}
              >
                Remove
              </button>
            </p>
          ) : null}
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-4 file:py-2 file:text-violet-200"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void uploadXaiPortfolioFile(file)
                .then((url) =>
                  persistXai(
                    (d) => ({
                      ...d,
                      cvDownloadUrl: url,
                      cvFileName: file.name || "hannington_kuria_njuguna_cv.pdf",
                    }),
                    "CV uploaded — live on /portfolio.",
                  ),
                )
                .catch((err) => toast.error(formatAuthOrFirestoreError(err)));
              e.target.value = "";
            }}
          />
        </AdminSection>
        <AdminSection title="Profile" accent="teal" defaultOpen>
          <AdminField label="Professional title" fieldSize="medium">
            <input
              className="admin-input"
              value={draft.professionalTitle}
              onChange={(e) => setDraft((d) => ({ ...d, professionalTitle: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Introduction" fieldSize="long">
            <textarea
              className="admin-input min-h-[120px]"
              value={draft.introduction}
              onChange={(e) => setDraft((d) => ({ ...d, introduction: e.target.value }))}
            />
          </AdminField>
        </AdminSection>
      </AdminPage>
    );
  }

  if (section === "xai.links") {
    const profileLinks = draft.links
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(({ label, href }) => ({ label, href }));

    return (
      <AdminPage
        title="Portfolio links"
        description="YouTube, LinkedIn, showreel, or any buttons shown under your intro on /portfolio."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={publishDraft}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Rocket className="h-4 w-4" />
            Publish
          </button>
        }
      >
        {visibilityToggle}
        <PublishBar busy={busy} onPublish={publishDraft} hint="Publish after adding or editing links." />
        <AdminSection title="Hero links" accent="teal" defaultOpen>
          <XaiLinksEditor
            label="Links on /portfolio"
            hint="Examples: YouTube channel, LinkedIn, Vimeo showreel, personal site."
            links={profileLinks}
            onChange={setProfileLinks}
            defaultNew={{ label: "YouTube", href: "" }}
          />
        </AdminSection>
      </AdminPage>
    );
  }

  if (section === "xai.skills") {
    return (
      <AdminPage
        title="Skills"
        description="Software, categories, and proficiency levels on /portfolio."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={publishDraft}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Rocket className="h-4 w-4" />
            Publish
          </button>
        }
      >
        {visibilityToggle}
        <PublishBar
          busy={busy}
          onPublish={publishDraft}
          hint="Technical skill matrix on /portfolio — publish after adding or editing skills."
        />
        <AdminSection title="Skills" accent="violet">
          {draft.skills
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onMoveUp={() => moveSkill(skill.id, -1)}
                onMoveDown={() => moveSkill(skill.id, 1)}
                onChange={(patch) =>
                  setDraft((d) => ({
                    ...d,
                    skills: d.skills.map((s) => (s.id === skill.id ? { ...s, ...patch } : s)),
                  }))
                }
                onDelete={() =>
                  void persistXai((d) => ({ ...d, skills: d.skills.filter((s) => s.id !== skill.id) }), "Skill removed.")
                }
              />
            ))}
          <button
            type="button"
            className="mt-4 text-sm text-cyan-400 hover:underline"
            onClick={() => {
              const skill: XaiSkillEntry = {
                id: newXaiId(),
                order: draft.skills.length,
                category: "Video Editing",
                name: "New skill",
                proficiency: "Intermediate",
                detail: "",
              };
              setDraft((d) => ({ ...d, skills: [...d.skills, skill] }));
            }}
          >
            + Add skill
          </button>
        </AdminSection>
      </AdminPage>
    );
  }

  if (section === "xai.caseStudies") {
    const sortedStudies = [...draft.caseStudies].sort((a, b) => a.order - b.order);
    return (
      <AdminPage
        title="Case studies"
        description="Videos, technical write-ups, before/after sliders, and VFX breakdown galleries."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={publishDraft}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Rocket className="h-4 w-4" />
            Publish all
          </button>
        }
      >
        {visibilityToggle}
        <PublishBar
          busy={busy}
          onPublish={publishDraft}
          hint="Publish after editing videos, tools, results, or reordering projects. Skills matrix is edited separately."
        />
        <p className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-zinc-400">
          Edit <strong className="text-zinc-300">Skills</strong> and <strong className="text-zinc-300">Links</strong> in the left sidebar.
        </p>
        <div className="mb-8 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
          <span className="mr-1">Panels per case study:</span>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-200">
            <strong>1</strong> Info
          </span>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">
            <strong>2</strong> Video
          </span>
          <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-teal-200">
            <strong>3</strong> Technical
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
            <strong>4</strong> Tools
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
            <strong>5</strong> Before/after
          </span>
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-200">
            <strong>6</strong> Gallery
          </span>
        </div>
        {sortedStudies.map((study, idx) => (
          <AdminSection
            key={study.id}
            title={study.title || `Project ${idx + 1}`}
            accent="orange"
            defaultOpen={idx === 0}
            className="mb-10"
          >
            <div className="mb-4 flex gap-2">
              <button type="button" className="rounded border border-white/10 p-2 text-zinc-400" onClick={() => moveStudy(study.id, -1)} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className="rounded border border-white/10 p-2 text-zinc-400" onClick={() => moveStudy(study.id, 1)} aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <XaiCaseStudyPanel
              step={1}
              theme="cyan"
              title="Project info"
              description="Title, role, and summary at the top of this case study on /portfolio."
              defaultOpen
            >
              <AdminField label="Title" tone="teal">
                <input className="admin-input" value={study.title} onChange={(e) => updateStudy(study.id, { title: e.target.value })} />
              </AdminField>
              <AdminField label="Your role" tone="teal">
                <input className="admin-input" value={study.role} onChange={(e) => updateStudy(study.id, { role: e.target.value })} />
              </AdminField>
              <AdminField label="Overview" tone="teal">
                <textarea className="admin-input min-h-[80px]" value={study.overview} onChange={(e) => updateStudy(study.id, { overview: e.target.value })} />
              </AdminField>
            </XaiCaseStudyPanel>

            <XaiCaseStudyPanel
              step={2}
              theme="violet"
              title="Video showcase"
              description="Add multiple YouTube embeds or uploads — two side by side, three+ in a 2+1 grid — plus optional project links."
              defaultOpen
            >
              <XaiVideoAdminField
                study={study}
                onChange={(patch) => updateStudy(study.id, patch)}
                onPersist={(patch, message) => persistStudyPatch(study.id, patch, message)}
              />
              <XaiLinksEditor
                label="Extra links for this project"
                hint="Optional — e.g. full YouTube video, Frame.io review, project page."
                links={study.links}
                onChange={(links) => updateStudy(study.id, { links })}
                defaultNew={{ label: "Watch on YouTube", href: "" }}
              />
            </XaiCaseStudyPanel>

            <XaiCaseStudyPanel
              step={3}
              theme="teal"
              title="Technical breakdown"
              description="Markdown: problem, solution, techniques, and AI training relevance."
            >
              <XaiMarkdownField
                label="Problem identification"
                value={study.problemIdentification}
                onChange={(problemIdentification) => updateStudy(study.id, { problemIdentification })}
              />
              <XaiMarkdownField
                label="Solution & process"
                value={study.solutionProcess}
                onChange={(solutionProcess) => updateStudy(study.id, { solutionProcess })}
              />
              <XaiMarkdownField
                label="Techniques applied"
                value={study.techniquesApplied}
                onChange={(techniquesApplied) => updateStudy(study.id, { techniquesApplied })}
              />
              <XaiMarkdownField
                label="AI data annotation relevance"
                value={study.dataAnnotationRelevance}
                onChange={(dataAnnotationRelevance) => updateStudy(study.id, { dataAnnotationRelevance })}
              />
            </XaiCaseStudyPanel>

            <XaiCaseStudyPanel
              step={4}
              theme="amber"
              title="Tools & results"
              description="Tool tags and measurable impact on the public case study."
              defaultOpen
            >
              <StringListEditor
                label="Tools used (DaVinci, Premiere, rotoscoping tools, etc.)"
                items={study.toolsUsed}
                onChange={(toolsUsed) => updateStudy(study.id, { toolsUsed })}
              />
              <XaiMarkdownField
                label="Results & impact"
                value={study.resultsImpact}
                onChange={(resultsImpact) => updateStudy(study.id, { resultsImpact })}
                placeholder="Measurable outcomes, delivery speed, quality improvements…"
              />
            </XaiCaseStudyPanel>

            <XaiCaseStudyPanel
              step={5}
              theme="emerald"
              title="Before & after media"
              description="Raw vs. final stills — comparison slider on /portfolio."
            >
              <XaiBeforeAfterManager
                pairs={study.beforeAfterPairs}
                onChange={(beforeAfterPairs) => updateStudy(study.id, { beforeAfterPairs })}
              />
            </XaiCaseStudyPanel>

            <XaiCaseStudyPanel
              step={6}
              theme="rose"
              title="VFX breakdown gallery"
              description="Mattes, tracking, node trees — lightbox grid on /portfolio."
            >
              <XaiBreakdownGalleryEditor
                images={study.breakdownImages}
                onChange={(breakdownImages) => updateStudy(study.id, { breakdownImages })}
              />
            </XaiCaseStudyPanel>

            <div className="mt-8 flex flex-wrap gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
              <button
                type="button"
                disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 disabled:opacity-50"
                  onClick={() => void persistXai((_current) => draft, `“${study.title || "Case study"}” published.`)}
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Publish this case study
                </button>
                <button
                  type="button"
                  className="text-sm text-red-400 hover:underline"
                  onClick={() =>
                    void persistXai(
                      (d) => ({ ...d, caseStudies: d.caseStudies.filter((s) => s.id !== study.id) }),
                      "Case study removed.",
                    )
                  }
                >
                  Delete case study
                </button>
            </div>
          </AdminSection>
        ))}
        <button
          type="button"
          className="rounded-full border border-cyan-500/40 px-4 py-2 text-sm text-cyan-300"
          onClick={() => {
            const study: XaiCaseStudy = {
              ...DEFAULT_XAI_PORTFOLIO.caseStudies[0],
              id: newXaiId(),
              order: draft.caseStudies.length,
              title: "New case study",
              links: [],
              beforeAfterPairs: [],
              breakdownImages: [],
            };
            setDraft((d) => ({ ...d, caseStudies: [...d.caseStudies, study] }));
          }}
        >
          + Add case study
        </button>
      </AdminPage>
    );
  }

  return null;
}

function SkillRow({
  skill,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  skill: XaiSkillEntry;
  onChange: (patch: Partial<XaiSkillEntry>) => void;
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
      <div className="grid gap-2 sm:grid-cols-2">
        <AdminField label="Category">
          <select
            className="admin-input"
            value={skill.category}
            onChange={(e) => onChange({ category: e.target.value as SkillCategory })}
          >
            {SKILL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Name">
          <input className="admin-input" value={skill.name} onChange={(e) => onChange({ name: e.target.value })} />
        </AdminField>
        <AdminField label="Hover detail (shown on /portfolio)">
          <input
            className="admin-input"
            value={skill.detail}
            placeholder="e.g. Advanced Color Science & Fusion node trees"
            onChange={(e) => onChange({ detail: e.target.value })}
          />
        </AdminField>
        <AdminField label="Proficiency">
          <select
            className="admin-input"
            value={skill.proficiency}
            onChange={(e) => onChange({ proficiency: e.target.value as SkillProficiency })}
          >
            {PROFICIENCIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </AdminField>
        <div className="flex items-end">
          <button type="button" className="text-sm text-red-400" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

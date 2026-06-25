import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { tryGetFirestoreDb } from "@/lib/firebase";
import { syncLegacyVideoFields } from "./xaiCaseStudyVideos";
import { DEFAULT_XAI_LABELS, DEFAULT_XAI_PORTFOLIO } from "./xaiPortfolioDefaults";
import type {
  BeforeAfterPair,
  BreakdownImage,
  SkillCategory,
  SkillProficiency,
  VideoSourceKind,
  XaiCaseStudy,
  XaiCaseStudyVideo,
  XaiLink,
  XaiPortfolioContent,
  XaiPortfolioLabels,
  XaiProfileLink,
  XaiSkillEntry,
} from "./xaiPortfolioTypes";

const DOC_PATH = "portfolio/xai";

const VIDEO_KINDS: VideoSourceKind[] = ["youtube", "vimeo", "self-hosted", "none"];
const PROFICIENCIES: SkillProficiency[] = ["Beginner", "Intermediate", "Advanced", "Expert"];
const CATEGORIES: SkillCategory[] = [
  "Video Editing",
  "Motion Graphics",
  "VFX / Compositing",
  "Color Grading",
  "Scripting / Automation",
  "AI Video Tools",
  "3D Integration",
];

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function parseLinks(raw: unknown): XaiLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = item as Record<string, unknown>;
      const label = asString(o.label);
      const href = asString(o.href);
      if (!label && !href) return null;
      return { label, href };
    })
    .filter((l): l is XaiLink => l !== null);
}

function parseProfileLinks(raw: unknown): XaiProfileLink[] {
  if (!Array.isArray(raw)) return [];
  return sortByOrder(
    raw
      .map((item, i) => {
        const o = item as Record<string, unknown>;
        const href = asString(o.href);
        const label = asString(o.label);
        if (!href.trim()) return null;
        return {
          id: asString(o.id, `link_${i}`),
          order: typeof o.order === "number" ? o.order : i,
          label: label || "Link",
          href: href.trim(),
        };
      })
      .filter((l): l is XaiProfileLink => l !== null),
  );
}

function parseBeforeAfter(raw: unknown): BeforeAfterPair[] {
  if (!Array.isArray(raw)) return [];
  return sortByOrder(
    raw
      .map((item, i) => {
        const o = item as Record<string, unknown>;
        return {
          id: asString(o.id, `ba_${i}`),
          order: typeof o.order === "number" ? o.order : i,
          label: asString(o.label),
          beforeUrl: asString(o.beforeUrl),
          afterUrl: asString(o.afterUrl),
        };
      })
      .filter((p) => p.beforeUrl || p.afterUrl),
  );
}

function parseBreakdownImages(raw: unknown): BreakdownImage[] {
  if (!Array.isArray(raw)) return [];
  return sortByOrder(
    raw
      .map((item, i) => {
        if (typeof item === "string") {
          const url = item.trim();
          if (!url) return null;
          return { id: `bd_${i}`, order: i, url, caption: "" };
        }
        const o = item as Record<string, unknown>;
        const url = asString(o.url);
        if (!url.trim()) return null;
        return {
          id: asString(o.id, `bd_${i}`),
          order: typeof o.order === "number" ? o.order : i,
          url: url.trim(),
          caption: asString(o.caption),
        };
      })
      .filter((x): x is BreakdownImage => x !== null),
  );
}

function parseCaseStudyVideos(
  raw: unknown,
  legacyUrl: string,
  legacyKind: VideoSourceKind,
): XaiCaseStudyVideo[] {
  if (Array.isArray(raw) && raw.length) {
    const parsed = sortByOrder(
      raw
        .map((item, i) => {
          const o = item as Record<string, unknown>;
          const k = asString(o.videoKind);
          const url = asString(o.videoUrl);
          if (!url.trim()) return null;
          return {
            id: asString(o.id, `vid_${i}`),
            order: typeof o.order === "number" ? o.order : i,
            videoKind: VIDEO_KINDS.includes(k as VideoSourceKind) ? (k as VideoSourceKind) : "none",
            videoUrl: url.trim(),
            thumbnailUrl: asString(o.thumbnailUrl),
            label: asString(o.label),
          };
        })
        .filter((v): v is XaiCaseStudyVideo => v !== null),
    );
    if (parsed.length) return parsed;
  }
  if (legacyUrl.trim()) {
    return [
      {
        id: "legacy",
        order: 0,
        videoUrl: legacyUrl.trim(),
        videoKind: legacyKind,
        thumbnailUrl: "",
        label: "",
      },
    ];
  }
  return [];
}

function parseCaseStudy(raw: unknown, fallbackOrder: number): XaiCaseStudy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = asString(o.videoKind);
  const videoKind = VIDEO_KINDS.includes(kind as VideoSourceKind) ? (kind as VideoSourceKind) : "none";
  const videoUrl = asString(o.videoUrl);
  const videos = parseCaseStudyVideos(o.videos, videoUrl, videoKind);
  const first = videos[0];
  return {
    id: asString(o.id, `cs_${fallbackOrder}`),
    order: typeof o.order === "number" ? o.order : fallbackOrder,
    title: asString(o.title, "Untitled project"),
    role: asString(o.role),
    videoKind: first?.videoKind ?? videoKind,
    videoUrl: first?.videoUrl ?? videoUrl,
    videos,
    overview: asString(o.overview),
    problemIdentification: asString(o.problemIdentification),
    solutionProcess: asString(o.solutionProcess),
    techniquesApplied: asString(o.techniquesApplied),
    toolsUsed: asStringArray(o.toolsUsed),
    dataAnnotationRelevance: asString(o.dataAnnotationRelevance),
    resultsImpact: asString(o.resultsImpact),
    links: parseLinks(o.links),
    beforeAfterPairs: parseBeforeAfter(o.beforeAfterPairs),
    breakdownImages: parseBreakdownImages(o.breakdownImages),
  };
}

function parseSkill(raw: unknown, fallbackOrder: number): XaiSkillEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cat = asString(o.category);
  const prof = asString(o.proficiency);
  return {
    id: asString(o.id, `sk_${fallbackOrder}`),
    order: typeof o.order === "number" ? o.order : fallbackOrder,
    category: CATEGORIES.includes(cat as SkillCategory) ? (cat as SkillCategory) : "Video Editing",
    name: asString(o.name, "Skill"),
    proficiency: PROFICIENCIES.includes(prof as SkillProficiency) ? (prof as SkillProficiency) : "Intermediate",
    detail: asString(o.detail),
  };
}

function parseLabels(raw: unknown): XaiPortfolioLabels {
  const d = DEFAULT_XAI_LABELS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    eyebrow: asString(o.eyebrow, d.eyebrow),
    cvButtonLabel: asString(o.cvButtonLabel, d.cvButtonLabel),
    cvMissingHint: asString(o.cvMissingHint, d.cvMissingHint),
    caseStudiesTitle: asString(o.caseStudiesTitle, d.caseStudiesTitle),
    caseStudiesDescription: asString(o.caseStudiesDescription, d.caseStudiesDescription),
    skillsTitle: asString(o.skillsTitle, d.skillsTitle),
    skillsDescription: asString(o.skillsDescription, d.skillsDescription),
    caseStudyIndexPrefix: asString(o.caseStudyIndexPrefix, d.caseStudyIndexPrefix),
    problemLabel: asString(o.problemLabel, d.problemLabel),
    solutionLabel: asString(o.solutionLabel, d.solutionLabel),
    techniquesLabel: asString(o.techniquesLabel, d.techniquesLabel),
    aiRelevanceLabel: asString(o.aiRelevanceLabel, d.aiRelevanceLabel),
    toolsLabel: asString(o.toolsLabel, d.toolsLabel),
    resultsLabel: asString(o.resultsLabel, d.resultsLabel),
    beforeAfterTitle: asString(o.beforeAfterTitle, d.beforeAfterTitle),
    breakdownGalleryTitle: asString(o.breakdownGalleryTitle, d.breakdownGalleryTitle),
    videoPlaceholder: asString(o.videoPlaceholder, d.videoPlaceholder),
  };
}

export function parseXaiPortfolioContent(raw: unknown): XaiPortfolioContent {
  if (!raw || typeof raw !== "object") return DEFAULT_XAI_PORTFOLIO;
  const o = raw as Record<string, unknown>;

  const caseStudiesRaw = Array.isArray(o.caseStudies) ? o.caseStudies : [];
  const caseStudies = sortByOrder(
    caseStudiesRaw
      .map((c, i) => parseCaseStudy(c, i))
      .filter((c): c is XaiCaseStudy => c !== null),
  );

  const skillsRaw = Array.isArray(o.skills) ? o.skills : [];
  const skills = sortByOrder(
    skillsRaw
      .map((s, i) => parseSkill(s, i))
      .filter((s): s is XaiSkillEntry => s !== null),
  );

  return {
    publicEnabled: o.publicEnabled === false ? false : true,
    professionalTitle: asString(o.professionalTitle, DEFAULT_XAI_PORTFOLIO.professionalTitle),
    introduction: asString(o.introduction, DEFAULT_XAI_PORTFOLIO.introduction),
    cvDownloadUrl: asString(o.cvDownloadUrl),
    cvFileName: asString(o.cvFileName),
    labels: parseLabels(o.labels),
    links: parseProfileLinks(o.links),
    caseStudies: caseStudies.length ? caseStudies : DEFAULT_XAI_PORTFOLIO.caseStudies,
    skills: skills.length ? skills : DEFAULT_XAI_PORTFOLIO.skills,
  };
}

export async function fetchXaiPortfolioContent(): Promise<XaiPortfolioContent> {
  const db = tryGetFirestoreDb();
  if (!db) return DEFAULT_XAI_PORTFOLIO;
  const snap = await getDoc(doc(db, DOC_PATH));
  if (!snap.exists()) return DEFAULT_XAI_PORTFOLIO;
  return parseXaiPortfolioContent(snap.data());
}

export function subscribeXaiPortfolioContent(onData: (data: XaiPortfolioContent) => void): Unsubscribe | undefined {
  const db = tryGetFirestoreDb();
  if (!db) {
    onData(DEFAULT_XAI_PORTFOLIO);
    return undefined;
  }
  return onSnapshot(
    doc(db, DOC_PATH),
    (snap) => {
      onData(snap.exists() ? parseXaiPortfolioContent(snap.data()) : DEFAULT_XAI_PORTFOLIO);
    },
    () => onData(DEFAULT_XAI_PORTFOLIO),
  );
}

export async function saveXaiPortfolioContent(content: XaiPortfolioContent): Promise<void> {
  const caseStudies = content.caseStudies.map(syncLegacyVideoFields);
  await apiFetch("/api/portfolio/xai", {
    method: "PUT",
    body: JSON.stringify({ ...content, caseStudies }),
  });
}

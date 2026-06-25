import type {
  SkillCategory,
  XaiCaseStudy,
  XaiPortfolioContent,
  XaiPortfolioLabels,
  XaiSkillEntry,
} from "./xaiPortfolioTypes";

function newId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `xai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

const INTRO =
  "Expert Video Specialist with deep technical proficiency in high-end post-production workflows. Specialized in training AI models through meticulous video annotation, with a focus on motion dynamics, technical VFX breakdowns, and precision editing.";

function templateCaseStudy(
  order: number,
  title: string,
  role: string,
  overview: string,
  problem: string,
  solution: string,
  techniques: string,
  tools: string[],
  aiRelevance: string,
  impact: string,
): XaiCaseStudy {
  return {
    id: newId(),
    order,
    title,
    role,
    videoKind: "none",
    videoUrl: "",
    videos: [],
    overview,
    problemIdentification: problem,
    solutionProcess: solution,
    techniquesApplied: techniques,
    toolsUsed: tools,
    dataAnnotationRelevance: aiRelevance,
    resultsImpact: impact,
    links: [],
    beforeAfterPairs: [],
    breakdownImages: [],
  };
}

const DEFAULT_SKILLS: XaiSkillEntry[] = [
  {
    id: newId(),
    order: 0,
    category: "Video Editing",
    name: "Adobe Premiere Pro",
    proficiency: "Expert",
    detail: "Multicam sync, nested sequences, broadcast loudness targets (−16 LUFS).",
  },
  {
    id: newId(),
    order: 1,
    category: "Color Grading",
    name: "DaVinci Resolve",
    proficiency: "Expert",
    detail: "Advanced color science, Fusion node trees, HDR trim passes.",
  },
  {
    id: newId(),
    order: 2,
    category: "VFX / Compositing",
    name: "Rotoscoping & masking",
    proficiency: "Expert",
    detail: "Sub-pixel mattes, planar tracks, hold-out layers for glass and hair.",
  },
  {
    id: newId(),
    order: 3,
    category: "Color Grading",
    name: "Color science & HDR pipelines",
    proficiency: "Expert",
    detail: "CST-first grading, vectorscope skin-tone guardrails, scope QC.",
  },
  {
    id: newId(),
    order: 4,
    category: "AI Video Tools",
    name: "Veo & generative video workflows",
    proficiency: "Advanced",
    detail: "Palette-matched generative B-roll and artifact QC for training data.",
  },
  {
    id: newId(),
    order: 5,
    category: "Motion Graphics",
    name: "After Effects compositing",
    proficiency: "Advanced",
    detail: "Light-wrap, grain match, multi-pass comps for seamless integration.",
  },
  {
    id: newId(),
    order: 6,
    category: "Scripting / Automation",
    name: "Timeline macros & batch exports",
    proficiency: "Intermediate",
    detail: "Resolve/Premiere automation for repeatable delivery specs.",
  },
  {
    id: newId(),
    order: 7,
    category: "3D Integration",
    name: "3D camera track handoff",
    proficiency: "Intermediate",
    detail: "Camera solve exports for Fusion/AE compositing pipelines.",
  },
];

export const DEFAULT_XAI_LABELS: XaiPortfolioLabels = {
  eyebrow: "xAI Video Tutor application",
  cvButtonLabel: "Open CV",
  cvMissingHint: "CV — upload in admin",
  caseStudiesTitle: "Featured case studies",
  caseStudiesDescription:
    "Technical breakdowns with workflow detail, tools, and relevance to AI video training.",
  skillsTitle: "Technical competencies",
  skillsDescription: "Software, pipelines, and proficiency across post-production disciplines.",
  caseStudyIndexPrefix: "Case study",
  problemLabel: "Problem identification",
  solutionLabel: "Solution & process",
  techniquesLabel: "Techniques applied",
  aiRelevanceLabel: "AI data annotation relevance",
  toolsLabel: "Tools used",
  resultsLabel: "Results & impact",
  beforeAfterTitle: "Before & after",
  breakdownGalleryTitle: "VFX breakdown gallery",
  videoPlaceholder: "Add a YouTube, Vimeo, or self-hosted video URL in the admin dashboard.",
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  "Video Editing",
  "Motion Graphics",
  "VFX / Compositing",
  "Color Grading",
  "Scripting / Automation",
  "AI Video Tools",
  "3D Integration",
];

export const DEFAULT_XAI_PORTFOLIO: XaiPortfolioContent = {
  publicEnabled: true,
  professionalTitle: "Video Specialist & AI Data Annotator",
  introduction: INTRO,
  cvDownloadUrl: "",
  cvFileName: "hannington_kuria_njuguna_cv.pdf",
  labels: DEFAULT_XAI_LABELS,
  links: [],
  skills: DEFAULT_SKILLS,
  caseStudies: [
    templateCaseStudy(
      0,
      "Advanced Rotoscoping & VFX Breakdown",
      "Lead compositor — precision isolation & edge control",
      "A high-motion commercial spot requiring frame-accurate subject isolation for layered VFX and clean plate reconstruction.",
      "Fast lateral motion, motion blur, and overlapping foreground elements caused unstable auto-masks and haloing on hair and fabric edges.",
      "Built a hybrid roto pipeline: planar tracks for rigid regions, per-frame Bézier refinement on high-motion segments, and edge-feather profiles tuned per focal length. Used hold-out mattes to prevent spill on glass and reflections.",
      "Precision masking with sub-pixel edge treatment; motion tracking for camera-linked layers; multi-pass compositing with light-wrap and grain matching for seamless integration.",
      ["DaVinci Resolve Fusion", "Mocha Pro", "After Effects", "Premiere Pro"],
      "Clean mattes and temporal consistency are critical training signals for segmentation and inpainting models—this workflow documents how human annotators resolve ambiguity that automated tools miss.",
      "Reduced revision rounds by ~40%; delivered broadcast-safe masters with zero visible edge chatter on 4K review.",
    ),
    templateCaseStudy(
      1,
      "Narrative Pacing & Technical Editing",
      "Editor — story structure & technical cut discipline",
      "A documentary-style piece where clarity of argument depended on rhythm, interview pacing, and intentional silence.",
      "Raw interviews exceeded target runtime by 3×; overlapping themes and uneven energy threatened viewer retention in the first 90 seconds.",
      "Mapped a beat sheet against transcript themes, applied J-cut/L-cut patterns to maintain speaker continuity, and used waveform-driven tightening on pauses. Built nested sequences in Premiere for modular act swaps during client review.",
      "Narrative pacing through selective compression; technical cuts aligned to music transients; multicam sync and consistent loudness targeting (−16 LUFS integrated).",
      ["Adobe Premiere Pro", "Adobe Audition", "Frame.io review"],
      "Temporal segmentation labels benefit from editors who understand intentional vs. accidental pauses—this case shows how human judgment defines scene boundaries for summarization models.",
      "Final cut held 92% focus-group completion on a 12-minute target; cut-down iterations shipped in under 48h per review round.",
    ),
    templateCaseStudy(
      2,
      "Color Grading & AI Integration",
      "Colorist — Resolve color science + generative video handoff",
      "A brand film blending traditional cinematography with AI-generated B-roll (Veo), requiring a unified look and defensible color pipeline.",
      "Generative clips exhibited inconsistent white balance, banding in skies, and metadata drift versus camera originals—risking a patchwork final master.",
      "Established a show LUT and node tree in DaVinci Resolve: CST-first pipeline, skin-tone vectorscope guardrails, and power windows on AI plates only where motion allowed. Exported still references for Veo re-prompts to align palette before final conform.",
      "Primary/secondary grading in Resolve; HDR trim pass; before/after stills for client sign-off; generative re-roll criteria documented for hue and contrast targets.",
      ["DaVinci Resolve", "Veo", "Premiere Pro", "Scopes & QC plugins"],
      "Pairing traditional grading with generative footage is directly relevant to multimodal training—annotators must flag artifacts (banding, temporal flicker) that models should learn to avoid or correct.",
      "Unified look across 100% of shots; QC pass with zero critical exposure errors on broadcast scopes.",
    ),
  ],
};

export function newXaiId(): string {
  return newId();
}

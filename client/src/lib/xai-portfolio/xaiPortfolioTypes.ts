export type VideoSourceKind = "youtube" | "vimeo" | "self-hosted" | "none";

export type SkillProficiency = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type SkillCategory =
  | "Video Editing"
  | "Motion Graphics"
  | "VFX / Compositing"
  | "Color Grading"
  | "Scripting / Automation"
  | "AI Video Tools"
  | "3D Integration";

export interface BeforeAfterPair {
  id: string;
  order: number;
  label: string;
  beforeUrl: string;
  afterUrl: string;
}

export interface BreakdownImage {
  id: string;
  order: number;
  url: string;
  caption: string;
}

export interface XaiLink {
  label: string;
  href: string;
}

export interface XaiProfileLink extends XaiLink {
  id: string;
  order: number;
}

export interface XaiCaseStudyVideo {
  id: string;
  order: number;
  videoKind: VideoSourceKind;
  videoUrl: string;
  /** Poster image for self-hosted videos (uploaded to your server). */
  thumbnailUrl: string;
  /** Optional label under the player (e.g. "Full breakdown"). */
  label: string;
}

export interface XaiCaseStudy {
  id: string;
  order: number;
  title: string;
  role: string;
  /** @deprecated Use `videos` — kept for Firestore backward compatibility. */
  videoKind: VideoSourceKind;
  /** @deprecated Use `videos` — kept for Firestore backward compatibility. */
  videoUrl: string;
  videos: XaiCaseStudyVideo[];
  overview: string;
  problemIdentification: string;
  solutionProcess: string;
  techniquesApplied: string;
  toolsUsed: string[];
  dataAnnotationRelevance: string;
  resultsImpact: string;
  links: XaiLink[];
  beforeAfterPairs: BeforeAfterPair[];
  breakdownImages: BreakdownImage[];
}

export interface XaiSkillEntry {
  id: string;
  order: number;
  category: SkillCategory;
  name: string;
  proficiency: SkillProficiency;
  /** Shown on hover in the skills tag grid. */
  detail: string;
}

/** All section headings, button labels, and insight titles on the public portfolio. */
export interface XaiPortfolioLabels {
  eyebrow: string;
  cvButtonLabel: string;
  cvMissingHint: string;
  caseStudiesTitle: string;
  caseStudiesDescription: string;
  skillsTitle: string;
  skillsDescription: string;
  caseStudyIndexPrefix: string;
  problemLabel: string;
  solutionLabel: string;
  techniquesLabel: string;
  aiRelevanceLabel: string;
  toolsLabel: string;
  resultsLabel: string;
  beforeAfterTitle: string;
  breakdownGalleryTitle: string;
  videoPlaceholder: string;
}

export interface XaiPortfolioContent {
  /** When false, /portfolio and all public xAI portfolio links are hidden. */
  publicEnabled: boolean;
  professionalTitle: string;
  introduction: string;
  cvDownloadUrl: string;
  cvFileName: string;
  labels: XaiPortfolioLabels;
  links: XaiProfileLink[];
  caseStudies: XaiCaseStudy[];
  skills: XaiSkillEntry[];
}

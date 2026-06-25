export type BadgeTone = "green" | "slate" | "amber" | "blue" | "purple" | "orange";

export interface PortfolioBadge {
  label: string;
  tone: BadgeTone;
}

export interface PortfolioLink {
  label: string;
  href: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  images: string[];
  badges: PortfolioBadge[];
  links: PortfolioLink[];
  order: number;
}

export type ServiceAccent = "orange" | "teal" | "violet";
export type ServiceIcon = "camera" | "code" | "graduation";

export interface SiteSocialLink {
  label: string;
  href: string;
}

export interface SiteBrand {
  name: string;
  tagline: string;
  heroImage: string;
  logoUrl: string;
  navInitials: string;
  email: string;
  phone: string;
  youtube: string;
  socials: SiteSocialLink[];
}

export interface SiteServiceCard {
  id: string;
  title: string;
  description: string;
  href: string;
  accent: ServiceAccent;
  icon: ServiceIcon;
  order: number;
}

export type HeroAnimation = "filmDissolve" | "slide" | "kenburns";

export interface PhotoHeroSlide {
  id: string;
  /** High-quality image (shown after load, fades in over LQ). */
  src: string;
  /** Low-quality placeholder (loads first). */
  srcLq: string;
  alt: string;
  caption?: string;
  order: number;
  animation: HeroAnimation;
}

export interface PhotoCategory {
  id: string;
  slug: string;
  label: string;
  description?: string;
  order: number;
  visible: boolean;
}

export type PhotoOrientation = "auto" | "landscape" | "portrait" | "square";

export interface SitePhotoItem {
  id: string;
  src: string;
  alt: string;
  categoryId: string;
  /** @deprecated Use orientation + aspectRatio; kept for legacy Firestore docs. */
  tall: boolean;
  featured: boolean;
  order: number;
  /** Natural width in pixels (from upload probe). */
  width?: number;
  /** Natural height in pixels (from upload probe). */
  height?: number;
  /** Width / height for justified layout (e.g. 1.5 = 3:2 landscape). */
  aspectRatio?: number;
  /** Manual override; `auto` uses probed aspectRatio. */
  orientation?: PhotoOrientation;
}

export interface VideoCategory {
  id: string;
  slug: string;
  label: string;
  order: number;
  visible: boolean;
}

export interface SiteVideoItem {
  id: string;
  title: string;
  description: string;
  embedId: string;
  categoryId: string;
  featured: boolean;
  /** When false, hidden from the videography storefront. */
  visible: boolean;
  order: number;
}

export type RateCardCategory =
  | "wedding"
  | "corporate"
  | "portraits"
  | "videography"
  | "events"
  | "studio"
  | "other";

export interface RateCardPackage {
  id: string;
  name: string;
  price: string;
  /** e.g. "per session", "per day" */
  priceSuffix: string;
  /** Legacy single line — migrated to features when empty */
  detail: string;
  /** Line items with checkmarks (top section of card) */
  features: string[];
  /** "Package includes" block below the divider */
  includes: string[];
  /** Overrides group delivery note for this tier */
  deliveryNote: string;
  highlight: boolean;
  /** Badge on highlighted card, e.g. "Most Popular" */
  popularLabel: string;
  ctaLabel: string;
  /** When false, hidden from the rate card storefront. */
  visible: boolean;
}

export interface RateCardGroup {
  id: string;
  label: string;
  category: RateCardCategory;
  /** Heading above the card grid for this tab */
  sectionTitle: string;
  description: string;
  footnote: string;
  /** Default delivery line on each package card */
  deliveryNote: string;
  /** Photo gallery category id for “View samples” (matches `photoCategories[].id`). */
  linkedGalleryCategoryId?: string;
  order: number;
  /** When false, entire tab/group hidden from the rate card page. */
  visible: boolean;
  packages: RateCardPackage[];
}

export interface ProcessStep {
  step: string;
  title: string;
  text: string;
}

import type { PhotoContract } from "@/lib/contracts/contractTypes";

/** Hero + story copy for `/development`. */
export interface DevelopmentSettings {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  storyTitle: string;
  storyParagraphs: string[];
  cvSectionTitle: string;
  cvDescription: string;
  /** B2 URL — served to visitors via `/api/download-dev-cv`, not linked directly. */
  cvDownloadUrl: string;
  cvFileName: string;
}

export type DevSkillProficiency = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type DevSkillCategory =
  | "Frontend"
  | "Backend & APIs"
  | "Mobile"
  | "Cloud & Data"
  | "AI & Automation"
  | "DevOps & Security";

export interface DevSkillEntry {
  id: string;
  order: number;
  category: DevSkillCategory;
  name: string;
  proficiency: DevSkillProficiency;
  /** Where applied and how it helps — shown when a visitor taps the skill. */
  detail: string;
}

export interface ExtractionSettings {
  /** PIN required to open /extraction */
  accessPin: string;
}

export interface PhotographySettings {
  whatsappNumber: string;
  whatsappBookingEnabled: boolean;
  /** When false, rate card tab, promos, and footer links are hidden on the storefront. */
  rateCardsEnabled: boolean;
  bookingIntro: string;
  heroTitle: string;
  heroSubtitle: string;
  globalHeroAnimation: HeroAnimation;
  rateCardPageTitle: string;
  rateCardPageSubtitle: string;
  /** Shown under brand name in the orange rate-card header */
  rateCardHeaderTagline: string;
  /** Extra WhatsApp lines in the rate-card footer */
  rateCardWhatsappNumbers: string[];
}

/** CMS document for TechantMedia storefront (`portfolio/site`). */
export interface SiteContent {
  brand: SiteBrand;
  serviceCards: SiteServiceCard[];
  featuredProjects: PortfolioProject[];
  /** @deprecated Legacy string tags — migrated to `devSkillEntries` on read. */
  devSkills?: string[];
  devSkillEntries: DevSkillEntry[];
  developmentSettings: DevelopmentSettings;
  extractionSettings: ExtractionSettings;
  photoGallery: SitePhotoItem[];
  photoHeroSlides: PhotoHeroSlide[];
  photoCategories: PhotoCategory[];
  videoGallery: SiteVideoItem[];
  videoCategories: VideoCategory[];
  rateCardGroups: RateCardGroup[];
  processSteps: ProcessStep[];
  photographySettings: PhotographySettings;
  /** Photography / videography legal documents (markdown). */
  photoContracts: PhotoContract[];
}

/** Legacy `/portfolio` page shape (built from SiteContent + static sections). */
export type ExpertiseColor = "orange" | "blue" | "green";

export interface PortfolioExpertiseCard {
  id: string;
  title: string;
  color: ExpertiseColor;
  items: string[];
  order: number;
}

export interface PortfolioNextProject {
  id: string;
  title: string;
  description: string;
  badges: PortfolioBadge[];
  order: number;
}

export interface PortfolioExperienceItem {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  bullets: string[];
  accentColor: "orange" | "blue";
  order: number;
}

export interface PortfolioEducationItem {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  variant: "slate" | "orange";
  order: number;
}

export interface PortfolioSiteContent {
  profile: {
    navInitials: string;
    name: string;
    tagline: string;
    subtitle: string;
    imageUrl: string;
  };
  about: { paragraphs: string[] };
  expertise: PortfolioExpertiseCard[];
  featuredProjects: PortfolioProject[];
  nextProjects: PortfolioNextProject[];
  process: { intro: string; heading: string; items: string[] };
  experience: { intro: string; items: PortfolioExperienceItem[] };
  education: { intro: string; items: PortfolioEducationItem[] };
  contact: {
    heading: string;
    intro: string;
    email: string;
    phone: string;
    githubLabel: string;
    githubUrl: string;
  };
  footer: { copyright: string; tagline: string };
}

import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { tryGetFirestoreDb } from "@/lib/firebase";
import {
  DEFAULT_PHOTO_CATEGORIES,
  DEFAULT_PHOTO_HERO_SLIDES,
  DEFAULT_PHOTOGRAPHY_SETTINGS,
  DEFAULT_PROCESS_STEPS,
  DEFAULT_RATE_CARD_GROUPS,
  DEFAULT_VIDEO_CATEGORIES,
  DEFAULT_VIDEO_GALLERY,
  UNCATEGORIZED_CATEGORY_ID,
} from "./photographyDefaults";
import { DEFAULT_PHOTO_CONTRACTS } from "@/lib/contracts/defaultContracts";
import type { PhotoContract, PhotoContractSlug } from "@/lib/contracts/contractTypes";
import { PHOTO_CONTRACT_SLUGS } from "@/lib/contracts/contractTypes";
import { RATE_GROUP_DEFAULT_GALLERY_IDS } from "@/lib/tech-media/rateCardAccent";
import { extractYoutubeId } from "@/lib/tech-media/youtubeUtils";
import { DEFAULT_DEVELOPMENT_SETTINGS } from "./developmentDefaults";
import {
  DEV_SKILL_CATEGORIES,
  DEV_SKILL_PROFICIENCIES,
  DEFAULT_DEV_SKILL_ENTRIES,
  migrateDevSkillsFromStrings,
} from "./developmentSkillDefaults";
import { DEFAULT_EXTRACTION_SETTINGS } from "./extractionDefaults";
import { DEFAULT_SITE_CONTENT } from "./siteDefaults";
import type {
  BadgeTone,
  DevSkillCategory,
  DevSkillEntry,
  DevSkillProficiency,
  DevelopmentSettings,
  ExtractionSettings,
  HeroAnimation,
  PhotoCategory,
  PhotoHeroSlide,
  PhotographySettings,
  PortfolioBadge,
  PortfolioLink,
  PortfolioProject,
  ProcessStep,
  RateCardCategory,
  RateCardGroup,
  RateCardPackage,
  ServiceAccent,
  ServiceIcon,
  SiteBrand,
  SiteContent,
  SitePhotoItem,
  SiteServiceCard,
  SiteSocialLink,
  SiteVideoItem,
  VideoCategory,
} from "./portfolioTypes";

const DOC_PATH = "portfolio/site";

const BADGE_TONES: BadgeTone[] = ["green", "slate", "amber", "blue", "purple", "orange"];
const SERVICE_ACCENTS: ServiceAccent[] = ["orange", "teal", "violet"];
const SERVICE_ICONS: ServiceIcon[] = ["camera", "code", "graduation"];
const HERO_ANIMATIONS: HeroAnimation[] = ["filmDissolve", "slide", "kenburns"];

function parseHeroAnimation(raw: string, fallback: HeroAnimation): HeroAnimation {
  if (raw === "fade") return "filmDissolve";
  return HERO_ANIMATIONS.includes(raw as HeroAnimation) ? (raw as HeroAnimation) : fallback;
}
const RATE_CARD_CATEGORIES: RateCardCategory[] = [
  "wedding",
  "corporate",
  "portraits",
  "videography",
  "events",
  "studio",
  "other",
];

function parseFeatures(raw: unknown, detailFallback: string): string[] {
  if (Array.isArray(raw)) {
    const list = raw.map((x) => String(x).trim()).filter(Boolean);
    if (list.length) return list;
  }
  if (!detailFallback.trim()) return [];
  return detailFallback
    .split(/[·•|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function newId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((x) => x.trim().length > 0);
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function mergeRateCardGroup(cms: RateCardGroup | undefined, defaults: RateCardGroup): RateCardGroup {
  if (!cms) return defaults;

  const defaultPkgIds = new Set(defaults.packages.map((p) => p.id));
  const cmsUsesDefaultPackages = cms.packages.some((p) => defaultPkgIds.has(p.id));

  // CMS still has an old template (e.g. Half-day / Full-day) — use rebuilt defaults, keep CMS order/label tweaks.
  if (!cmsUsesDefaultPackages && defaults.packages.length > 0) {
    return {
      ...defaults,
      label: cms.label.trim() || defaults.label,
      sectionTitle: cms.sectionTitle.trim() || defaults.sectionTitle,
      description: cms.description.trim() || defaults.description,
      footnote: cms.footnote.trim() || defaults.footnote,
      deliveryNote: cms.deliveryNote.trim() || defaults.deliveryNote,
      linkedGalleryCategoryId:
        cms.linkedGalleryCategoryId?.trim() || defaults.linkedGalleryCategoryId || "",
      order: cms.order,
    };
  }

  const packagesById = new Map(cms.packages.map((p) => [p.id, p]));
  for (const pkg of defaults.packages) {
    if (!packagesById.has(pkg.id)) packagesById.set(pkg.id, pkg);
  }

  const ordered: RateCardPackage[] = [];
  const seen = new Set<string>();
  for (const p of cms.packages) {
    const pkg = packagesById.get(p.id);
    if (pkg) {
      ordered.push(pkg);
      seen.add(p.id);
    }
  }
  for (const p of defaults.packages) {
    if (!seen.has(p.id)) ordered.push(p);
  }

  return {
    ...cms,
    packages: ordered,
    footnote: cms.footnote.trim() || defaults.footnote,
    description: cms.description.trim() || defaults.description,
    linkedGalleryCategoryId:
      cms.linkedGalleryCategoryId?.trim() || defaults.linkedGalleryCategoryId || "",
  };
}

/** CMS groups win by id; defaults add missing groups and refresh stale package templates. */
function mergeRateCardGroups(fromFirestore: RateCardGroup[], fromDefaults: RateCardGroup[]): RateCardGroup[] {
  const cmsById = new Map(fromFirestore.map((g) => [g.id, g]));
  const merged: RateCardGroup[] = [];

  for (const def of fromDefaults) {
    merged.push(mergeRateCardGroup(cmsById.get(def.id), def));
    cmsById.delete(def.id);
  }
  for (const extra of cmsById.values()) merged.push(extra);

  return sortByOrder(merged);
}

/** Keep admin-only drafts (not yet in Firestore) when a snapshot arrives. */
export function mergeSiteContentWithLocalDraft(remote: SiteContent, local: SiteContent): SiteContent {
  const remoteSlideIds = new Set(remote.photoHeroSlides.map((s) => s.id));
  const localOnlySlides = local.photoHeroSlides.filter((s) => !remoteSlideIds.has(s.id));
  const remotePhotoIds = new Set(remote.photoGallery.map((p) => p.id));
  const localOnlyPhotos = local.photoGallery.filter((p) => !remotePhotoIds.has(p.id));
  if (!localOnlySlides.length && !localOnlyPhotos.length) return remote;
  return {
    ...remote,
    photoHeroSlides: localOnlySlides.length
      ? sortByOrder([...remote.photoHeroSlides, ...localOnlySlides])
      : remote.photoHeroSlides,
    photoGallery: localOnlyPhotos.length
      ? sortByOrder([...remote.photoGallery, ...localOnlyPhotos])
      : remote.photoGallery,
  };
}

function parseBadge(raw: unknown): PortfolioBadge | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = asString(o.label).trim();
  if (!label) return null;
  const toneRaw = asString(o.tone);
  const tone = BADGE_TONES.includes(toneRaw as BadgeTone) ? (toneRaw as BadgeTone) : "slate";
  return { label, tone };
}

function parseLink(raw: unknown): PortfolioLink | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = asString(o.label).trim();
  const href = asString(o.href).trim();
  if (!label || !href) return null;
  return { label, href };
}

function parseSocial(raw: unknown): SiteSocialLink | null {
  return parseLink(raw);
}

function parseProject(raw: unknown, index: number): PortfolioProject | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = asString(o.title).trim();
  if (!title) return null;
  const badges = Array.isArray(o.badges) ? (o.badges.map(parseBadge).filter(Boolean) as PortfolioBadge[]) : [];
  const links = Array.isArray(o.links) ? (o.links.map(parseLink).filter(Boolean) as PortfolioLink[]) : [];
  return {
    id: asString(o.id).trim() || newId(),
    title,
    description: asString(o.description),
    images: asStringArray(o.images),
    badges,
    links,
    order: typeof o.order === "number" ? o.order : index,
  };
}

function parseServiceCard(raw: unknown, index: number): SiteServiceCard | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = asString(o.title).trim();
  if (!title) return null;
  const accentRaw = asString(o.accent);
  const accent = SERVICE_ACCENTS.includes(accentRaw as ServiceAccent) ? (accentRaw as ServiceAccent) : "orange";
  const iconRaw = asString(o.icon);
  const icon = SERVICE_ICONS.includes(iconRaw as ServiceIcon) ? (iconRaw as ServiceIcon) : "camera";
  return {
    id: asString(o.id).trim() || newId(),
    title,
    description: asString(o.description),
    href: asString(o.href, "/"),
    accent,
    icon,
    order: typeof o.order === "number" ? o.order : index,
  };
}

const PHOTO_ORIENTATIONS = ["auto", "landscape", "portrait", "square"] as const;

function parsePhotoOrientation(raw: unknown): SitePhotoItem["orientation"] {
  const s = asString(raw);
  return PHOTO_ORIENTATIONS.includes(s as (typeof PHOTO_ORIENTATIONS)[number])
    ? (s as SitePhotoItem["orientation"])
    : "auto";
}

function parsePhoto(raw: unknown, index: number, fallbackCategoryId: string): SitePhotoItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const src = asString(o.src).trim();
  const categoryId = asString(o.categoryId).trim() || fallbackCategoryId;
  const width = typeof o.width === "number" && o.width > 0 ? o.width : undefined;
  const height = typeof o.height === "number" && o.height > 0 ? o.height : undefined;
  let aspectRatio = typeof o.aspectRatio === "number" && o.aspectRatio > 0 ? o.aspectRatio : undefined;
  if (!aspectRatio && width && height) aspectRatio = width / height;
  const tall = asBool(o.tall);
  const orientation = parsePhotoOrientation(o.orientation);
  return {
    id: asString(o.id).trim() || newId(),
    src,
    alt: asString(o.alt, "Photo"),
    categoryId,
    tall,
    featured: asBool(o.featured),
    order: typeof o.order === "number" ? o.order : index,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    orientation: orientation ?? (tall ? "portrait" : "auto"),
  };
}

function parsePhotoCategory(raw: unknown, index: number): PhotoCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = asString(o.label).trim();
  if (!label) return null;
  return {
    id: asString(o.id).trim() || newId(),
    slug: asString(o.slug, label.toLowerCase().replace(/\s+/g, "-")),
    label,
    description: asString(o.description),
    order: typeof o.order === "number" ? o.order : index,
    visible: asBool(o.visible, true),
  };
}

function parseHeroSlide(raw: unknown, index: number): PhotoHeroSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o.id).trim() || newId();
  const src = asString(o.src).trim();
  const srcLq = asString(o.srcLq).trim();
  // Keep slides without images so admin can add placeholders (storefront filters empty slides).
  const animRaw = asString(o.animation);
  const animation = parseHeroAnimation(animRaw, "filmDissolve");
  const caption = asString(o.caption).trim();
  return {
    id,
    src,
    srcLq,
    alt: asString(o.alt, "Hero"),
    ...(caption ? { caption } : {}),
    order: typeof o.order === "number" ? o.order : index,
    animation,
  };
}

function parseVideoCategory(raw: unknown, index: number): VideoCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = asString(o.label).trim();
  if (!label) return null;
  return {
    id: asString(o.id).trim() || newId(),
    slug: asString(o.slug, label.toLowerCase().replace(/\s+/g, "-")),
    label,
    order: typeof o.order === "number" ? o.order : index,
    visible: asBool(o.visible, true),
  };
}

function parseVideo(raw: unknown, index: number, fallbackCategoryId: string): SiteVideoItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = asString(o.title).trim();
  const embedId = extractYoutubeId(asString(o.embedId));
  if (!title || !embedId) return null;
  return {
    id: asString(o.id).trim() || newId(),
    title,
    description: asString(o.description),
    embedId,
    categoryId: asString(o.categoryId).trim() || fallbackCategoryId,
    featured: asBool(o.featured),
    visible: asBool(o.visible, true),
    order: typeof o.order === "number" ? o.order : index,
  };
}

function parseRatePackage(raw: unknown, index: number): RateCardPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o.name).trim();
  if (!name) return null;
  const detail = asString(o.detail);
  return {
    id: asString(o.id).trim() || newId(),
    name,
    price: asString(o.price, "Custom"),
    priceSuffix: asString(o.priceSuffix),
    detail,
    features: parseFeatures(o.features, detail),
    includes: parseStringList(o.includes),
    deliveryNote: asString(o.deliveryNote),
    highlight: asBool(o.highlight),
    popularLabel: asString(o.popularLabel, "Most Popular"),
    ctaLabel: asString(o.ctaLabel, "Inquire on WhatsApp"),
    visible: asBool(o.visible, true),
  };
}

function parseRateGroup(raw: unknown, index: number): RateCardGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = asString(o.label).trim();
  if (!label) return null;
  const packages = (Array.isArray(o.packages) ? o.packages : [])
    .map((item, i) => parseRatePackage(item, i))
    .filter(Boolean) as RateCardPackage[];
  const catRaw = asString(o.category);
  const category = RATE_CARD_CATEGORIES.includes(catRaw as RateCardCategory)
    ? (catRaw as RateCardCategory)
    : label.toLowerCase().includes("wedding")
      ? "wedding"
      : label.toLowerCase().includes("video")
        ? "videography"
        : label.toLowerCase().includes("portrait") || label.toLowerCase().includes("studio")
          ? "portraits"
          : label.toLowerCase().includes("corporate")
            ? "corporate"
            : "other";
  const id = asString(o.id).trim() || newId();
  return {
    id,
    label,
    category,
    sectionTitle: asString(o.sectionTitle),
    description: asString(o.description),
    footnote: asString(o.footnote),
    deliveryNote: asString(o.deliveryNote),
    linkedGalleryCategoryId: asString(
      o.linkedGalleryCategoryId,
      RATE_GROUP_DEFAULT_GALLERY_IDS[id] ?? "",
    ),
    order: typeof o.order === "number" ? o.order : index,
    visible: asBool(o.visible, true),
    packages,
  };
}

function parseProcessStep(raw: unknown): ProcessStep | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = asString(o.title).trim();
  if (!title) return null;
  return {
    step: asString(o.step, "01"),
    title,
    text: asString(o.text),
  };
}

function parsePhotoContract(raw: unknown, fallback: PhotoContract): PhotoContract {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const slug = asString(o.slug, fallback.slug) as PhotoContractSlug;
  const safeSlug = PHOTO_CONTRACT_SLUGS.includes(slug) ? slug : fallback.slug;
  return {
    slug: safeSlug,
    title: asString(o.title, fallback.title).trim() || fallback.title,
    shortLabel: asString(o.shortLabel, fallback.shortLabel).trim() || fallback.shortLabel,
    description: asString(o.description, fallback.description),
    markdown: asString(o.markdown, fallback.markdown),
    downloadPdfUrl: asString(o.downloadPdfUrl, fallback.downloadPdfUrl ?? ""),
  };
}

function mergePhotoContracts(fromDoc: PhotoContract[]): PhotoContract[] {
  return DEFAULT_PHOTO_CONTRACTS.map((def) => {
    const cms = fromDoc.find((c) => c.slug === def.slug);
    return cms ? parsePhotoContract(cms, def) : def;
  });
}

function parseExtractionSettings(raw: unknown): ExtractionSettings {
  const d = DEFAULT_EXTRACTION_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const accessPin = asString(o.accessPin, d.accessPin).trim();
  return {
    accessPin: accessPin || d.accessPin,
  };
}

function parseDevelopmentSettings(raw: unknown): DevelopmentSettings {
  const d = DEFAULT_DEVELOPMENT_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const storyParagraphs = asStringArray(o.storyParagraphs);
  return {
    heroEyebrow: asString(o.heroEyebrow, d.heroEyebrow),
    heroTitle: asString(o.heroTitle, d.heroTitle),
    heroSubtitle: asString(o.heroSubtitle, d.heroSubtitle),
    storyTitle: asString(o.storyTitle, d.storyTitle),
    storyParagraphs: storyParagraphs.length ? storyParagraphs : d.storyParagraphs,
    cvSectionTitle: asString(o.cvSectionTitle, d.cvSectionTitle),
    cvDescription: asString(o.cvDescription, d.cvDescription),
    cvDownloadUrl: asString(o.cvDownloadUrl, d.cvDownloadUrl),
    cvFileName: asString(o.cvFileName, d.cvFileName),
  };
}

function parsePhotographySettings(raw: unknown): PhotographySettings {
  const d = DEFAULT_PHOTOGRAPHY_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const animRaw = asString(o.globalHeroAnimation);
  const globalHeroAnimation = parseHeroAnimation(animRaw, d.globalHeroAnimation);
  return {
    whatsappNumber: asString(o.whatsappNumber, d.whatsappNumber),
    whatsappBookingEnabled: asBool(o.whatsappBookingEnabled, d.whatsappBookingEnabled),
    rateCardsEnabled: asBool(o.rateCardsEnabled, d.rateCardsEnabled),
    bookingIntro: asString(o.bookingIntro, d.bookingIntro),
    heroTitle: asString(o.heroTitle, d.heroTitle),
    heroSubtitle: asString(o.heroSubtitle, d.heroSubtitle),
    globalHeroAnimation,
    rateCardPageTitle: asString(o.rateCardPageTitle, d.rateCardPageTitle),
    rateCardPageSubtitle: asString(o.rateCardPageSubtitle, d.rateCardPageSubtitle),
    rateCardHeaderTagline: asString(o.rateCardHeaderTagline, d.rateCardHeaderTagline),
    rateCardWhatsappNumbers: (() => {
      const parsed = parseStringList(o.rateCardWhatsappNumbers);
      return parsed.length ? parsed : d.rateCardWhatsappNumbers;
    })(),
  };
}

function parseDevSkillEntry(raw: unknown, orderFallback: number): DevSkillEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o.name).trim();
  if (!name) return null;
  const categoryRaw = asString(o.category);
  const category = DEV_SKILL_CATEGORIES.includes(categoryRaw as DevSkillCategory)
    ? (categoryRaw as DevSkillCategory)
    : "Backend & APIs";
  const profRaw = asString(o.proficiency);
  const proficiency = DEV_SKILL_PROFICIENCIES.includes(profRaw as DevSkillProficiency)
    ? (profRaw as DevSkillProficiency)
    : "Advanced";
  return {
    id: asString(o.id, newId()),
    order: typeof o.order === "number" && Number.isFinite(o.order) ? o.order : orderFallback,
    category,
    name,
    proficiency,
    detail: asString(o.detail),
  };
}

function resolveDevSkillEntries(doc: Record<string, unknown>, defaults: SiteContent): DevSkillEntry[] {
  const parsed = sortByOrder(
    (Array.isArray(doc.devSkillEntries) ? doc.devSkillEntries : [])
      .map((item, i) => parseDevSkillEntry(item, i))
      .filter(Boolean) as DevSkillEntry[],
  );
  if (parsed.length) return parsed;
  const legacy = asStringArray(doc.devSkills);
  if (legacy.length) return migrateDevSkillsFromStrings(legacy);
  return defaults.devSkillEntries;
}

function parseBrand(raw: unknown, legacyProfile: Record<string, unknown>, legacyContact: Record<string, unknown>): SiteBrand {
  const d = DEFAULT_SITE_CONTENT.brand;
  const brandRaw = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const socials = Array.isArray(brandRaw.socials)
    ? (brandRaw.socials.map(parseSocial).filter(Boolean) as SiteSocialLink[])
    : [];

  return {
    name: asString(brandRaw.name, asString(legacyProfile.name, d.name)),
    tagline: asString(brandRaw.tagline, asString(legacyProfile.tagline, d.tagline)),
    heroImage: asString(brandRaw.heroImage, d.heroImage),
    logoUrl: asString(brandRaw.logoUrl, asString(legacyProfile.imageUrl, d.logoUrl)),
    navInitials: asString(brandRaw.navInitials, asString(legacyProfile.navInitials, d.navInitials)),
    email: asString(brandRaw.email, asString(legacyContact.email, d.email)),
    phone: asString(brandRaw.phone, asString(legacyContact.phone, d.phone)),
    youtube: asString(brandRaw.youtube, d.youtube),
    socials: socials.length ? socials : d.socials,
  };
}

export function parseSiteContent(raw: unknown): SiteContent {
  if (!raw || typeof raw !== "object") return DEFAULT_SITE_CONTENT;
  const doc = raw as Record<string, unknown>;
  const legacyProfile = (doc.profile ?? {}) as Record<string, unknown>;
  const legacyContact = (doc.contact ?? {}) as Record<string, unknown>;
  const defaults = DEFAULT_SITE_CONTENT;

  const photoCategories = sortByOrder(
    (Array.isArray(doc.photoCategories) ? doc.photoCategories : [])
      .map(parsePhotoCategory)
      .filter(Boolean) as PhotoCategory[],
  );
  const resolvedCategories = photoCategories.length ? photoCategories : defaults.photoCategories;
  const fallbackCategoryId =
    resolvedCategories.find((c) => c.visible)?.id ??
    resolvedCategories[0]?.id ??
    UNCATEGORIZED_CATEGORY_ID;

  const photoGallery = sortByOrder(
    (Array.isArray(doc.photoGallery) ? doc.photoGallery : [])
      .map((item, i) => parsePhoto(item, i, fallbackCategoryId))
      .filter(Boolean) as SitePhotoItem[],
  );

  const photoHeroSlides = sortByOrder(
    (Array.isArray(doc.photoHeroSlides) ? doc.photoHeroSlides : [])
      .map(parseHeroSlide)
      .filter(Boolean) as PhotoHeroSlide[],
  );

  const videoCategories = sortByOrder(
    (Array.isArray(doc.videoCategories) ? doc.videoCategories : [])
      .map(parseVideoCategory)
      .filter(Boolean) as VideoCategory[],
  );
  const resolvedVideoCategories = videoCategories.length ? videoCategories : defaults.videoCategories;
  const fallbackVideoCategoryId = resolvedVideoCategories[0]?.id ?? "vid-events";

  const videoGallery = sortByOrder(
    (Array.isArray(doc.videoGallery) ? doc.videoGallery : [])
      .map((item, i) => parseVideo(item, i, fallbackVideoCategoryId))
      .filter(Boolean) as SiteVideoItem[],
  );

  const rateCardGroupsFromDoc = (Array.isArray(doc.rateCardGroups) ? doc.rateCardGroups : [])
    .map(parseRateGroup)
    .filter(Boolean) as RateCardGroup[];
  const rateCardGroups = mergeRateCardGroups(rateCardGroupsFromDoc, defaults.rateCardGroups);

  const processSteps = Array.isArray(doc.processSteps)
    ? (doc.processSteps.map(parseProcessStep).filter(Boolean) as ProcessStep[])
    : defaults.processSteps;

  const featuredProjects = sortByOrder(
    (Array.isArray(doc.featuredProjects) ? doc.featuredProjects : [])
      .map(parseProject)
      .filter(Boolean) as PortfolioProject[],
  );

  const serviceCards = sortByOrder(
    (Array.isArray(doc.serviceCards) ? doc.serviceCards : [])
      .map(parseServiceCard)
      .filter(Boolean) as SiteServiceCard[],
  );

  const devSkillEntries = resolveDevSkillEntries(doc, defaults);

  let resolvedHeroSlides = photoHeroSlides.length ? photoHeroSlides : defaults.photoHeroSlides;
  if (!photoHeroSlides.length && photoGallery.length) {
    resolvedHeroSlides = photoGallery.slice(0, 3).map((p, i) => ({
      id: `migrated-hero-${p.id}`,
      src: p.src,
      srcLq: "",
      alt: p.alt,
      order: i,
      animation: defaults.photographySettings.globalHeroAnimation,
    }));
  }

  return {
    brand: parseBrand(doc.brand, legacyProfile, legacyContact),
    serviceCards: serviceCards.length ? serviceCards : defaults.serviceCards,
    featuredProjects: featuredProjects.length ? featuredProjects : defaults.featuredProjects,
    devSkillEntries,
    developmentSettings: parseDevelopmentSettings(doc.developmentSettings),
    extractionSettings: parseExtractionSettings(doc.extractionSettings),
    photoGallery: photoGallery.length ? photoGallery : defaults.photoGallery,
    photoHeroSlides: resolvedHeroSlides,
    photoCategories: resolvedCategories,
    videoGallery: videoGallery.length ? videoGallery : defaults.videoGallery,
    videoCategories: resolvedVideoCategories,
    rateCardGroups,
    processSteps: processSteps.length ? processSteps : defaults.processSteps,
    photographySettings: parsePhotographySettings(doc.photographySettings),
    photoContracts: mergePhotoContracts(
      (Array.isArray(doc.photoContracts) ? doc.photoContracts : [])
        .map((item, i) => parsePhotoContract(item, DEFAULT_PHOTO_CONTRACTS[i] ?? DEFAULT_PHOTO_CONTRACTS[0]!))
        .filter(Boolean) as PhotoContract[],
    ),
  };
}

export async function fetchSiteContent(): Promise<SiteContent> {
  const db = tryGetFirestoreDb();
  if (!db) return DEFAULT_SITE_CONTENT;
  const snap = await getDoc(doc(db, DOC_PATH));
  if (!snap.exists()) return DEFAULT_SITE_CONTENT;
  return parseSiteContent(snap.data());
}

export function subscribeSiteContent(
  onData: (content: SiteContent) => void,
  onError?: (err: unknown) => void,
): Unsubscribe | null {
  const db = tryGetFirestoreDb();
  if (!db) {
    onData(DEFAULT_SITE_CONTENT);
    return null;
  }
  return onSnapshot(
    doc(db, DOC_PATH),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SITE_CONTENT);
        return;
      }
      onData(parseSiteContent(snap.data()));
    },
    (err) => onError?.(err),
  );
}

/** Persist storefront CMS via authenticated API (Admin SDK writes Firestore). */
export async function saveSiteContent(content: SiteContent): Promise<void> {
  await apiFetch("/api/portfolio/site", {
    method: "PUT",
    body: JSON.stringify(content),
  });
}

/** @deprecated Use subscribeSiteContent */
export const subscribePortfolioSiteContent = subscribeSiteContent;

/** @deprecated Use parseSiteContent */
export const parsePortfolioSiteContent = parseSiteContent;

/** @deprecated Use saveSiteContent */
export const savePortfolioSiteContent = saveSiteContent;

export { newId as newPortfolioId };

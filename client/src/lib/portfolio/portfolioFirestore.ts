import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
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
import { DEFAULT_SITE_CONTENT } from "./siteDefaults";
import type {
  BadgeTone,
  HeroAnimation,
  PhotoCategory,
  PhotoHeroSlide,
  PhotographySettings,
  PortfolioBadge,
  PortfolioLink,
  PortfolioProject,
  ProcessStep,
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
const HERO_ANIMATIONS: HeroAnimation[] = ["fade", "slide", "kenburns"];

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

function parsePhoto(raw: unknown, index: number, fallbackCategoryId: string): SitePhotoItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const src = asString(o.src).trim();
  if (!src) return null;
  const categoryId = asString(o.categoryId).trim() || fallbackCategoryId;
  return {
    id: asString(o.id).trim() || newId(),
    src,
    alt: asString(o.alt, "Photo"),
    categoryId,
    tall: asBool(o.tall),
    featured: asBool(o.featured),
    order: typeof o.order === "number" ? o.order : index,
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
    description: asString(o.description) || undefined,
    order: typeof o.order === "number" ? o.order : index,
    visible: asBool(o.visible, true),
  };
}

function parseHeroSlide(raw: unknown, index: number): PhotoHeroSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const src = asString(o.src).trim();
  if (!src) return null;
  const animRaw = asString(o.animation);
  const animation = HERO_ANIMATIONS.includes(animRaw as HeroAnimation) ? (animRaw as HeroAnimation) : "fade";
  const caption = asString(o.caption).trim();
  return {
    id: asString(o.id).trim() || newId(),
    src,
    alt: asString(o.alt, "Hero"),
    caption: caption || undefined,
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

function extractYoutubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0] ?? "";
    if (url.searchParams.get("v")) return url.searchParams.get("v") ?? "";
    const parts = url.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  } catch {
    /* not a URL */
  }
  return trimmed;
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
    order: typeof o.order === "number" ? o.order : index,
  };
}

function parseRatePackage(raw: unknown, index: number): RateCardPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o.name).trim();
  if (!name) return null;
  return {
    id: asString(o.id).trim() || newId(),
    name,
    price: asString(o.price, "Custom"),
    detail: asString(o.detail),
    highlight: asBool(o.highlight),
  };
}

function parseRateGroup(raw: unknown, index: number): RateCardGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = asString(o.label).trim();
  if (!label) return null;
  const packages = sortByOrder(
    (Array.isArray(o.packages) ? o.packages : [])
      .map(parseRatePackage)
      .filter(Boolean) as RateCardPackage[],
  );
  return {
    id: asString(o.id).trim() || newId(),
    label,
    order: typeof o.order === "number" ? o.order : index,
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

function parsePhotographySettings(raw: unknown): PhotographySettings {
  const d = DEFAULT_PHOTOGRAPHY_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const animRaw = asString(o.globalHeroAnimation);
  const globalHeroAnimation = HERO_ANIMATIONS.includes(animRaw as HeroAnimation)
    ? (animRaw as HeroAnimation)
    : d.globalHeroAnimation;
  return {
    whatsappNumber: asString(o.whatsappNumber, d.whatsappNumber),
    whatsappBookingEnabled: asBool(o.whatsappBookingEnabled, d.whatsappBookingEnabled),
    bookingIntro: asString(o.bookingIntro, d.bookingIntro),
    heroTitle: asString(o.heroTitle, d.heroTitle),
    heroSubtitle: asString(o.heroSubtitle, d.heroSubtitle),
    globalHeroAnimation,
  };
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

  const rateCardGroups = sortByOrder(
    (Array.isArray(doc.rateCardGroups) ? doc.rateCardGroups : [])
      .map(parseRateGroup)
      .filter(Boolean) as RateCardGroup[],
  );

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

  const devSkills = asStringArray(doc.devSkills);

  let resolvedHeroSlides = photoHeroSlides.length ? photoHeroSlides : defaults.photoHeroSlides;
  if (!photoHeroSlides.length && photoGallery.length) {
    resolvedHeroSlides = photoGallery.slice(0, 3).map((p, i) => ({
      id: `migrated-hero-${p.id}`,
      src: p.src,
      alt: p.alt,
      order: i,
      animation: defaults.photographySettings.globalHeroAnimation,
    }));
  }

  return {
    brand: parseBrand(doc.brand, legacyProfile, legacyContact),
    serviceCards: serviceCards.length ? serviceCards : defaults.serviceCards,
    featuredProjects: featuredProjects.length ? featuredProjects : defaults.featuredProjects,
    devSkills: devSkills.length ? devSkills : defaults.devSkills,
    photoGallery: photoGallery.length ? photoGallery : defaults.photoGallery,
    photoHeroSlides: resolvedHeroSlides,
    photoCategories: resolvedCategories,
    videoGallery: videoGallery.length ? videoGallery : defaults.videoGallery,
    videoCategories: resolvedVideoCategories,
    rateCardGroups: rateCardGroups.length ? rateCardGroups : defaults.rateCardGroups,
    processSteps: processSteps.length ? processSteps : defaults.processSteps,
    photographySettings: parsePhotographySettings(doc.photographySettings),
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

export async function saveSiteContent(content: SiteContent): Promise<void> {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firebase is not configured");
  await setDoc(
    doc(db, DOC_PATH),
    {
      ...content,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** @deprecated Use subscribeSiteContent */
export const subscribePortfolioSiteContent = subscribeSiteContent;

/** @deprecated Use parseSiteContent */
export const parsePortfolioSiteContent = parseSiteContent;

/** @deprecated Use saveSiteContent */
export const savePortfolioSiteContent = saveSiteContent;

export { newId as newPortfolioId };

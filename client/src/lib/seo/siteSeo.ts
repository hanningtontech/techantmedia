import type { SiteBrand } from "@/lib/portfolio/portfolioTypes";
import { DEFAULT_PHOTO_CATEGORIES } from "@/lib/portfolio/photographyDefaults";
import { DEFAULT_SITE_CONTENT } from "@/lib/portfolio/siteDefaults";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_OWNER, SITE_URL } from "./constants";
import {
  breadcrumbSchema,
  faqPageSchema,
  organizationSchema,
  personSchema,
  profilePageSchema,
  serviceSchema,
  stackSchemas,
  webSiteSchema,
  type FaqItem,
} from "./schema";

export type PageSeoConfig = {
  title: string;
  description: string;
  /** Path only, e.g. `/development` */
  path: string;
  noindex?: boolean;
  ogImage?: string;
  ogType?: "website" | "profile";
  jsonLd?: Record<string, unknown>[];
};

const NOINDEX_PREFIXES = [
  "/admin",
  "/tutor/",
  "/student/",
  "/photography/account",
  "/photography/my-gallery",
  "/written-qns",
  "/livestream",
  "/live",
];

const GALLERY_SLUGS = DEFAULT_PHOTO_CATEGORIES.filter((c) => c.visible && c.slug !== "uncategorized").map(
  (c) => c.slug,
);

const CONTRACT_SLUGS = ["photography-videography", "vixen-release"] as const;

function isNoindexPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  if (p.startsWith("/inspos/") && p !== "/inspos") return true;
  return NOINDEX_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

function absUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function baseBrand(brand?: Partial<SiteBrand>): SiteBrand {
  const d = DEFAULT_SITE_CONTENT.brand;
  return { ...d, ...brand };
}

function defaultStack(brand: SiteBrand, description: string): Record<string, unknown>[] {
  const image = brand.logoUrl || brand.heroImage || DEFAULT_OG_IMAGE;
  return stackSchemas(
    webSiteSchema(description),
    organizationSchema({
      description: brand.tagline,
      email: brand.email,
      phone: brand.phone,
      image,
    }),
  );
}

export const HOME_FAQ: FaqItem[] = [
  {
    question: "What is TechantMedia?",
    answer:
      "TechantMedia is a Kenya-based creative and technology studio led by Hannington Kuria Njuguna, offering professional photography, videography, full-stack web development, and NCLEX nursing exam tutoring.",
  },
  {
    question: "What services does TechantMedia offer?",
    answer:
      "TechantMedia provides wedding and event photography, brand videography, production-ready web apps and admin dashboards, and structured NCLEX prep with practice banks and tutor support.",
  },
  {
    question: "How do I book photography or development work?",
    answer:
      "Use the Contact page at TechantMedia to share your project scope, timeline, and budget. Photography clients can also review packages on the rate card and sign contracts online.",
  },
];

export const DEV_FAQ: FaqItem[] = [
  {
    question: "Who builds the web applications at TechantMedia?",
    answer:
      "Hannington Njuguna is the full-stack developer behind TechantMedia, shipping React and TypeScript front ends, Node.js APIs, Firebase backends, and AI-assisted features for client and internal products.",
  },
  {
    question: "What technologies does TechantMedia use for development?",
    answer:
      "Core stacks include React, TypeScript, Node.js, Firebase/Firestore, Tailwind CSS, Android (Kotlin), Python (FastAPI), and AI agents integrated into mobile and web experiences.",
  },
];

export const PHOTO_FAQ: FaqItem[] = [
  {
    question: "What photography services does TechantMedia provide?",
    answer:
      "TechantMedia delivers wedding, engagement, corporate, studio, product, and event photography plus cinematic videography, with published galleries and transparent rate cards.",
  },
  {
    question: "Where is TechantMedia photography based?",
    answer:
      "TechantMedia serves clients across Kenya with on-location and studio sessions; contact details and booking are listed on the site for scheduling and quotes.",
  },
];

export const NCLEX_FAQ: FaqItem[] = [
  {
    question: "What is TechantMedia NCLEX tutoring?",
    answer:
      "TechantMedia NCLEX tutoring is structured exam preparation with practice question banks, rationales, cohort support, and tutor-led sessions for nursing graduates targeting US licensure.",
  },
];

export const PORTFOLIO_FAQ: FaqItem[] = [
  {
    question: "What does Hannington Kuria Njuguna specialize in for video?",
    answer:
      "Hannington Kuria Njuguna is a technical video specialist focused on VFX breakdowns, rotoscoping, color pipelines, narrative editing, and AI training data annotation workflows.",
  },
];

export function getSeoForPath(pathname: string, brandInput?: Partial<SiteBrand>): PageSeoConfig {
  const path = pathname.split("?")[0] || "/";
  const brand = baseBrand(brandInput);
  const ogImage = brand.logoUrl || brand.heroImage || DEFAULT_OG_IMAGE;

  if (isNoindexPath(path)) {
    return {
      title: `${SITE_NAME} (private)`,
      description: "Private application area.",
      path,
      noindex: true,
      ogImage,
    };
  }

  const base = defaultStack(brand, brand.tagline);

  if (path === "/") {
    const desc =
      "TechantMedia is a Kenya-based creative and technology studio for photography, videography, full-stack development, and NCLEX tutoring — led by Hannington Kuria Njuguna.";
    return {
      title: `${SITE_NAME} — Photography, Development & NCLEX Tutoring`,
      description: desc,
      path: "/",
      ogImage,
      jsonLd: [...base, faqPageSchema(HOME_FAQ)],
    };
  }

  if (path === "/photography") {
    const desc =
      "TechantMedia photography and videography covers weddings, corporate, studio, and brand work with published galleries, rate cards, and online contracts.";
    return {
      title: `Photography & Videography | ${SITE_NAME}`,
      description: desc,
      path,
      ogImage,
      jsonLd: [
        ...base,
        serviceSchema({
          name: "Photography & Videography",
          description: desc,
          path,
        }),
        faqPageSchema(PHOTO_FAQ),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Photography", path },
        ]),
      ],
    };
  }

  const galleryMatch = path.match(/^\/photography\/gallery\/([^/]+)$/);
  if (galleryMatch) {
    const slug = galleryMatch[1]!;
    const cat = DEFAULT_PHOTO_CATEGORIES.find((c) => c.slug === slug);
    const label = cat?.label ?? slug;
    const desc =
      cat?.description ??
      `TechantMedia ${label} gallery showcases professional ${label.toLowerCase()} photography and related work samples.`;
    return {
      title: `${label} Gallery | ${SITE_NAME} Photography`,
      description: `The ${label} gallery at TechantMedia is a curated portfolio of ${label.toLowerCase()} photography${cat?.description ? ` — ${cat.description}` : ""}.`,
      path,
      ogImage,
      jsonLd: [
        ...base,
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Photography", path: "/photography" },
          { name: label, path },
        ]),
      ],
    };
  }

  if (path === "/photography/contracts") {
    return {
      title: `Photography Contracts | ${SITE_NAME}`,
      description:
        "TechantMedia photography contracts are downloadable booking agreements for photo and video services with clear terms, client details, and delivery expectations.",
      path,
      ogImage,
      jsonLd: base,
    };
  }

  const contractMatch = path.match(/^\/photography\/contracts\/([^/]+)$/);
  if (contractMatch) {
    const slug = contractMatch[1]!;
    const title =
      slug === "vixen-release" ? "Vixen Release Form" : "Photography & Videography Contract";
    return {
      title: `${title} | ${SITE_NAME}`,
      description: `The ${title} at TechantMedia defines booking terms, client responsibilities, and delivery standards for professional photo and video production.`,
      path,
      ogImage,
      jsonLd: base,
    };
  }

  if (path === "/development") {
    const desc =
      "TechantMedia full-stack development delivers production web apps, admin dashboards, payments, APIs, and AI-assisted features — built by Hannington Njuguna.";
    return {
      title: `Full-Stack Development | ${SITE_NAME}`,
      description: desc,
      path,
      ogImage,
      jsonLd: [
        ...base,
        serviceSchema({ name: "Full-Stack Development", description: desc, path }),
        faqPageSchema(DEV_FAQ),
        personSchema({
          jobTitle: "Full-Stack Developer",
          description: desc,
          image: ogImage,
        }),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Development", path },
        ]),
      ],
    };
  }

  if (path === "/tutoring" || path === "/nclex-platform") {
    const desc =
      "TechantMedia NCLEX tutoring provides structured nursing exam prep with practice banks, rationales, and tutor-led cohort support for US licensure candidates.";
    return {
      title: `NCLEX Tutoring | ${SITE_NAME}`,
      description: desc,
      path,
      ogImage,
      jsonLd: [
        ...base,
        serviceSchema({ name: "NCLEX Tutoring", description: desc, path: "/nclex-platform" }),
        faqPageSchema(NCLEX_FAQ),
      ],
    };
  }

  if (path === "/contact") {
    return {
      title: `Contact | ${SITE_NAME}`,
      description:
        "Contact TechantMedia for photography, videography, web development, or NCLEX tutoring — email, phone, and project inquiries for Kenya and international clients.",
      path,
      ogImage,
      jsonLd: base,
    };
  }

  if (path === "/portfolio") {
    const desc =
      "Hannington Kuria Njuguna is a technical video specialist and AI data annotator — VFX breakdowns, rotoscoping, color pipelines, and narrative editing for AI video training.";
    return {
      title: `${SITE_OWNER} — Technical Video Specialist & AI Data Annotator`,
      description: desc,
      path,
      ogType: "profile",
      ogImage,
      jsonLd: [
        ...base,
        personSchema({
          jobTitle: "Technical Video Specialist & AI Data Annotator",
          description: desc,
          image: ogImage,
        }),
        profilePageSchema(path, desc),
        faqPageSchema(PORTFOLIO_FAQ),
      ],
    };
  }

  if (path === "/developer-portfolio") {
    return {
      title: `Developer Portfolio | ${SITE_OWNER}`,
      description:
        "Hannington Kuria Njuguna's developer portfolio highlights full-stack projects, mobile apps, and engineering work across TechantMedia client deliveries.",
      path,
      ogImage,
      jsonLd: base,
    };
  }

  if (path === "/inspos") {
    return {
      title: `Inspiration Boards | ${SITE_NAME}`,
      description:
        "TechantMedia inspiration boards collect visual references for photography and creative direction on client projects.",
      path,
      ogImage,
      jsonLd: base,
    };
  }

  if (path === "/simulation") {
    return {
      title: `Block Game Simulation Dashboard | ${SITE_NAME}`,
      description:
        "Interactive block game simulation with configurable grids, bomb counts, house edge, multiplier algorithms, live analytics, and Monte Carlo auto-play.",
      path,
      ogImage,
      jsonLd: base,
    };
  }

  if (path === "/game" || path === "/game/chart") {
    return {
      title: path === "/game/chart" ? `Session Chart | Block Game | ${SITE_NAME}` : `Block Game | ${SITE_NAME}`,
      description: "Play the block reveal game with KES wallet, fair multipliers, and live session charts.",
      path,
      ogImage,
      jsonLd: base,
    };
  }

  return {
    title: `${SITE_NAME}`,
    description: brand.tagline,
    path,
    ogImage,
    jsonLd: base,
  };
}

/** Paths included in sitemap.xml (build script mirrors this list). */
export function getPublicSitemapPaths(): string[] {
  const paths = [
    "/",
    "/photography",
    "/development",
    "/tutoring",
    "/nclex-platform",
    "/contact",
    "/portfolio",
    "/developer-portfolio",
    "/photography/contracts",
    "/inspos",
  ];
  for (const slug of GALLERY_SLUGS) paths.push(`/photography/gallery/${slug}`);
  for (const slug of CONTRACT_SLUGS) paths.push(`/photography/contracts/${slug}`);
  return paths;
}

export function canonicalUrl(path: string): string {
  return absUrl(path);
}

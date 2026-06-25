import type { DevSkillCategory, DevSkillEntry, DevSkillProficiency } from "./portfolioTypes";

function newId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `devskill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export const DEV_SKILL_CATEGORIES: DevSkillCategory[] = [
  "Frontend",
  "Backend & APIs",
  "Mobile",
  "Cloud & Data",
  "AI & Automation",
  "DevOps & Security",
];

export const DEV_SKILL_PROFICIENCIES: DevSkillProficiency[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

function skill(
  order: number,
  category: DevSkillCategory,
  name: string,
  proficiency: DevSkillProficiency,
  detail: string,
): DevSkillEntry {
  return { id: newId(), order, category, name, proficiency, detail };
}

/** Default competencies — notes drawn from My Story, CV themes, and featured projects. */
export const DEFAULT_DEV_SKILL_ENTRIES: DevSkillEntry[] = [
  skill(
    0,
    "Frontend",
    "React + TypeScript",
    "Expert",
    "Passmartshop storefront, admin dashboards, and this portfolio — component-driven UIs with typed props and safer refactors across releases.",
  ),
  skill(
    1,
    "Frontend",
    "Tailwind CSS",
    "Advanced",
    "Rapid, consistent layout for TechantMedia pages — responsive spacing, dark themes, and accessible focus states without heavy custom CSS.",
  ),
  skill(
    2,
    "Frontend",
    "SEO & modern web UX",
    "Advanced",
    "Xiaomi Store Kenya — improved discoverability and refreshed UI so product pages load fast and convert better on mobile.",
  ),
  skill(
    3,
    "Backend & APIs",
    "Node.js + Express",
    "Expert",
    "REST APIs behind e‑commerce and admin tools — auth middleware, webhooks, and structured error responses for client dashboards.",
  ),
  skill(
    4,
    "Backend & APIs",
    "PHP",
    "Advanced",
    "Early e‑commerce builds — server-rendered pages and form flows before moving critical paths to Node and Firebase.",
  ),
  skill(
    5,
    "Backend & APIs",
    "Python + FastAPI",
    "Intermediate",
    "Lightweight services and automation endpoints where Python’s ecosystem fits best (scripts, data tasks, internal tools).",
  ),
  skill(
    6,
    "Mobile",
    "Android (Kotlin)",
    "Advanced",
    "Maasai Mara University app and DJMovies — native navigation, media playback, and admin-backed content catalogs.",
  ),
  skill(
    7,
    "Mobile",
    "Android (Java)",
    "Advanced",
    "Where I started in 2021 — activity lifecycles and Gradle builds before standardizing on Kotlin for new features.",
  ),
  skill(
    8,
    "Cloud & Data",
    "Firebase / Firestore",
    "Expert",
    "Real-time CMS for portfolio and Passmartshop admin — auth, security rules, and hosted APIs without managing servers.",
  ),
  skill(
    9,
    "Cloud & Data",
    "MongoDB",
    "Advanced",
    "Flexible schemas for dynamic apps — nested documents and aggregation when relational models would slow iteration.",
  ),
  skill(
    10,
    "Cloud & Data",
    "MySQL",
    "Intermediate",
    "Relational storage for classic LAMP-style sites — normalized tables, migrations, and reporting queries.",
  ),
  skill(
    11,
    "AI & Automation",
    "AI agents & chatbots",
    "Advanced",
    "Embedded in mobile and web apps so users get instant answers — cuts support load and matches how I ship features in weeks, not months.",
  ),
  skill(
    12,
    "AI & Automation",
    "AI-assisted development",
    "Expert",
    "Core workflow pillar — spec-to-code, test ideas, and refactor safely; same mindset called out in my story and CV.",
  ),
  skill(
    13,
    "DevOps & Security",
    "CI/CD & Hosting",
    "Advanced",
    "Firebase Hosting and repeatable deploys for client storefronts — preview builds, env separation, and rollback-friendly releases.",
  ),
  skill(
    14,
    "DevOps & Security",
    "Application security",
    "Intermediate",
    "Hardening auth flows, validating uploads, and tightening Firestore rules — building trust alongside features as threats evolve.",
  ),
];

const NAME_ALIASES: Record<string, string> = {
  "react + typescript": "React + TypeScript",
  "react": "React + TypeScript",
  "node.js + express": "Node.js + Express",
  "node": "Node.js + Express",
  "firebase / firestore": "Firebase / Firestore",
  firebase: "Firebase / Firestore",
  "tailwind css": "Tailwind CSS",
  tailwind: "Tailwind CSS",
  "android (kotlin)": "Android (Kotlin)",
  android: "Android (Kotlin)",
  "python + fastapi": "Python + FastAPI",
  python: "Python + FastAPI",
  "ci/cd & hosting": "CI/CD & Hosting",
  "ci/cd": "CI/CD & Hosting",
};

function guessCategory(name: string): DevSkillCategory {
  const n = name.toLowerCase();
  if (n.includes("react") || n.includes("tailwind") || n.includes("css") || n.includes("seo") || n.includes("frontend"))
    return "Frontend";
  if (n.includes("android") || n.includes("kotlin") || n.includes("java") || n.includes("mobile")) return "Mobile";
  if (n.includes("firebase") || n.includes("mongo") || n.includes("mysql") || n.includes("firestore") || n.includes("data"))
    return "Cloud & Data";
  if (n.includes("ai") || n.includes("chatbot") || n.includes("agent") || n.includes("llm")) return "AI & Automation";
  if (n.includes("ci") || n.includes("host") || n.includes("security") || n.includes("devops")) return "DevOps & Security";
  return "Backend & APIs";
}

/** Upgrade legacy string tags from Firestore to structured entries with default notes where names match. */
export function migrateDevSkillsFromStrings(labels: string[]): DevSkillEntry[] {
  const byName = new Map(DEFAULT_DEV_SKILL_ENTRIES.map((s) => [s.name.toLowerCase(), s]));
  return labels
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw, order) => {
      const key = NAME_ALIASES[raw.toLowerCase()] ?? raw;
      const match = byName.get(key.toLowerCase());
      if (match) {
        return { ...match, id: newId(), order };
      }
      return {
        id: newId(),
        order,
        category: guessCategory(raw),
        name: raw,
        proficiency: "Advanced" as DevSkillProficiency,
        detail: "",
      };
    });
}

export function newDevSkillId(): string {
  return newId();
}

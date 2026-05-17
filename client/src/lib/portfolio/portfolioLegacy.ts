import type { PortfolioSiteContent, SiteContent } from "./portfolioTypes";

/** Static sections for legacy `/portfolio` only — not editable in admin. */
const LEGACY_SECTIONS: Omit<
  PortfolioSiteContent,
  "profile" | "featuredProjects" | "contact" | "footer"
> = {
  about: {
    paragraphs: [
      "I'm a full‑stack developer who builds complete product ecosystems—customer‑facing web apps, admin dashboards, and Android experiences—backed by clean data models and reliable infrastructure.",
    ],
  },
  expertise: [
    {
      id: "web",
      title: "Web Development",
      color: "orange",
      order: 0,
      items: ["React + TypeScript", "Vite", "Tailwind CSS", "Admin dashboards & UX"],
    },
    {
      id: "backend",
      title: "Backend & Data",
      color: "blue",
      order: 1,
      items: ["Firebase (Firestore, Storage, Hosting)", "Node + Express", "Payments: M‑Pesa Daraja, Stripe"],
    },
    {
      id: "mobile",
      title: "Mobile, AI & Automation",
      color: "green",
      order: 2,
      items: ["Android apps (native)", "Python + FastAPI", "AI agents (Gemini / Google ADK)"],
    },
  ],
  nextProjects: [],
  process: {
    intro: "Structured development with clear documentation and aligned delivery.",
    heading: "Documentation areas",
    items: ["API specifications", "Firestore schemas", "Deployment procedures"],
  },
  experience: {
    intro: "Shipping complete systems—frontend, backend, integrations, and deployment.",
    items: [],
  },
  education: {
    intro: "Strong fundamentals + continuous learning through real product delivery.",
    items: [],
  },
};

export function toLegacyPortfolio(site: SiteContent): PortfolioSiteContent {
  const year = new Date().getFullYear();
  return {
    ...LEGACY_SECTIONS,
    profile: {
      navInitials: site.brand.navInitials,
      name: site.brand.name,
      tagline: site.brand.tagline,
      subtitle: site.brand.tagline,
      imageUrl: site.brand.logoUrl,
    },
    featuredProjects: site.featuredProjects,
    contact: {
      heading: "Let's Connect!",
      intro: "Reach out for collaborations, freelance work, or full‑time opportunities.",
      email: site.brand.email,
      phone: site.brand.phone,
      githubLabel: "GitHub",
      githubUrl: site.brand.socials.find((s) => s.label === "GitHub")?.href ?? "https://github.com",
    },
    footer: {
      copyright: `© ${year} ${site.brand.name}. All rights reserved.`,
      tagline: site.brand.tagline,
    },
  };
}

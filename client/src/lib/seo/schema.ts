import { SITE_NAME, SITE_OWNER, SITE_URL } from "./constants";

export type FaqItem = { question: string; answer: string };

export function faqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function webSiteSchema(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function organizationSchema(opts: {
  description: string;
  email: string;
  phone: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: opts.description,
    image: opts.image,
    email: opts.email,
    telephone: opts.phone,
    areaServed: { "@type": "Country", name: "Kenya" },
    founder: { "@type": "Person", name: SITE_OWNER },
    sameAs: [
      "https://www.youtube.com/@techantmedia",
    ],
    knowsAbout: [
      "Photography",
      "Videography",
      "Full-stack web development",
      "NCLEX tutoring",
      "AI-assisted software development",
    ],
  };
}

export function personSchema(opts: { jobTitle: string; description: string; image?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE_OWNER,
    url: SITE_URL,
    jobTitle: opts.jobTitle,
    description: opts.description,
    image: opts.image,
    worksFor: { "@id": `${SITE_URL}/#organization` },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function serviceSchema(opts: {
  name: string;
  description: string;
  path: string;
  providerName?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    provider: {
      "@type": "ProfessionalService",
      name: opts.providerName ?? SITE_NAME,
      url: SITE_URL,
    },
    areaServed: { "@type": "Country", name: "Kenya" },
  };
}

export function profilePageSchema(path: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}${path}`,
    mainEntity: {
      "@type": "Person",
      name: SITE_OWNER,
      description,
    },
  };
}

export function stackSchemas(...schemas: Record<string, unknown>[]) {
  return schemas;
}

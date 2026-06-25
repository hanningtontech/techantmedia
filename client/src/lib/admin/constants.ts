/** Primary owner — Google or email link only (no password on admin login). */
export const SUPER_ADMIN_EMAIL = "hanningtonkuria5@gmail.com";

export type AdminNavId =
  | "site.brand"
  | "site.home"
  | "offpages.extraction"
  | "offpages.livestream"
  | "offpages.blockGame"
  | "dev.projects"
  | "dev.skills"
  | "dev.story"
  | "xai.header"
  | "xai.links"
  | "xai.skills"
  | "xai.caseStudies"
  | "photo.hero"
  | "photo.categories"
  | "photo.categoryNew"
  | "photo.photos"
  | "photo.inspos"
  | "photo.video"
  | "photo.rates"
  | "photo.booking"
  | "photo.contracts"
  | "photo.clients"
  | "photo.clientGallery"
  | "tutor.overview"
  | "settings.admins";

export type AdminNavGroup = {
  id: string;
  label: string;
  accent: "orange" | "teal" | "violet" | "slate";
  items: { id: AdminNavId; label: string }[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "site",
    label: "Site",
    accent: "slate",
    items: [
      { id: "site.brand", label: "Brand & contact" },
      { id: "site.home", label: "Home page cards" },
    ],
  },
  {
    id: "offpages",
    label: "Off pages",
    accent: "slate",
    items: [
      { id: "offpages.extraction", label: "Data extraction" },
      { id: "offpages.livestream", label: "Livestream countdown" },
      { id: "offpages.blockGame", label: "Block game" },
    ],
  },
  {
    id: "dev",
    label: "Development",
    accent: "teal",
    items: [
      { id: "dev.story", label: "Page & my story" },
      { id: "dev.projects", label: "Projects" },
      { id: "dev.skills", label: "Skills" },
    ],
  },
  {
    id: "xai",
    label: "xAI video portfolio",
    accent: "violet",
    items: [
      { id: "xai.header", label: "Profile & CV" },
      { id: "xai.links", label: "Links" },
      { id: "xai.skills", label: "Skills" },
      { id: "xai.caseStudies", label: "Case studies" },
    ],
  },
  {
    id: "photo",
    label: "Photography",
    accent: "orange",
    items: [
      { id: "photo.hero", label: "Hero slideshow" },
      { id: "photo.categories", label: "Categories" },
      { id: "photo.categoryNew", label: "Add category" },
      { id: "photo.photos", label: "Gallery photos" },
      { id: "photo.inspos", label: "Client inspos" },
      { id: "photo.video", label: "Videography" },
      { id: "photo.rates", label: "Rate cards" },
      { id: "photo.booking", label: "Booking & process" },
      { id: "photo.contracts", label: "Contracts & releases" },
      { id: "photo.clients", label: "Client accounts" },
      { id: "photo.clientGallery", label: "Client galleries" },
    ],
  },
  {
    id: "tutor",
    label: "Tutoring",
    accent: "violet",
    items: [{ id: "tutor.overview", label: "NCLEX tutoring" }],
  },
  {
    id: "settings",
    label: "Settings",
    accent: "slate",
    items: [{ id: "settings.admins", label: "Admin accounts" }],
  },
];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function adminNavLabel(id: AdminNavId): string {
  for (const g of ADMIN_NAV_GROUPS) {
    const item = g.items.find((i) => i.id === id);
    if (item) return item.label;
  }
  return "Admin";
}

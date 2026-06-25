/** Contact & links for the minimal site-wide footer (home, dev, tutoring, contact, etc.). */
export const GENERAL_FOOTER = {
  phone: "0759550133",
  email: "hanningtonkuria5@gmail.com",
  githubHref: "https://github.com",
} as const;

/** Primary email on rate card dialogs and photography contact blocks. */
export const PHOTOGRAPHY_RATE_CARD_EMAIL = "techantphotography@gmail.com";

/** Photography / videography footer — business contact & socials. */
export const PHOTOGRAPHY_FOOTER = {
  phones: ["0759550133", "0726980150"] as const,
  emails: [PHOTOGRAPHY_RATE_CARD_EMAIL, "hello@techantmedia.com"] as const,
  socialOrder: ["Instagram", "TikTok", "YouTube", "LinkedIn"] as const,
  defaultSocials: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "TikTok", href: "https://tiktok.com" },
    { label: "YouTube", href: "https://www.youtube.com/@techantmedia" },
    { label: "LinkedIn", href: "https://linkedin.com" },
  ] as const,
};

export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("0") ? `254${digits.slice(1)}` : digits;
  return `tel:+${normalized}`;
}

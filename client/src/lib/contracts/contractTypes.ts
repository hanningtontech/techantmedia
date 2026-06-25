export type PhotoContractSlug = "photography-videography" | "vixen-release";

export interface PhotoContract {
  slug: PhotoContractSlug;
  title: string;
  shortLabel: string;
  description: string;
  markdown: string;
  /** Optional admin-uploaded PDF template (takes priority for Download PDF). */
  downloadPdfUrl?: string;
}

export const PHOTO_CONTRACT_SLUGS: PhotoContractSlug[] = ["photography-videography", "vixen-release"];

export function contractHref(slug: PhotoContractSlug): string {
  return `/photography/contracts/${slug}`;
}

export function contractIndexHref(): string {
  return "/photography/contracts";
}

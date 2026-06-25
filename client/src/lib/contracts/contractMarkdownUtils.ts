/** Logo used in contract header and print watermark (20% opacity). */
export const CONTRACT_LOGO_URL = "/techant-contract-logo.png";

/** Long hand-fill line for print / PDF (visible when printing or saving as PDF). */
export const FILL_LONG = "________________________________________________________";
export const FILL_MEDIUM = "________________________________________";
export const FILL_SHORT = "____________________";

/** Split markdown into ## sections for print page-break control (keeps fill-in underscores). */
export function splitContractSections(markdown: string): string[] {
  const md = markdown.trim();
  if (!md) return [];
  const parts = md.split(/\n(?=##\s)/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

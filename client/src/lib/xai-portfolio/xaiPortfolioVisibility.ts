import type { XaiPortfolioContent } from "./xaiPortfolioTypes";

export function isXaiPortfolioPublicEnabled(content: Pick<XaiPortfolioContent, "publicEnabled">): boolean {
  return content.publicEnabled !== false;
}

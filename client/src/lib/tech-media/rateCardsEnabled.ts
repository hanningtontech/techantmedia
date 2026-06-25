import type { PhotographySettings } from "@/lib/portfolio/portfolioTypes";

export function isRateCardsEnabled(settings: PhotographySettings): boolean {
  return settings.rateCardsEnabled !== false;
}

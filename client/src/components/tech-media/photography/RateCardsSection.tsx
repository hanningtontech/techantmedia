import type { PhotoCategory, PhotographySettings, RateCardGroup, SiteBrand } from "@/lib/portfolio/portfolioTypes";
import { RateCardsPricing } from "./RateCardsPricing";

type Props = {
  groups: RateCardGroup[];
  photoCategories: PhotoCategory[];
  settings: PhotographySettings;
  brand: SiteBrand;
};

export function RateCardsSection({ groups, photoCategories, settings, brand }: Props) {
  return (
    <RateCardsPricing
      groups={groups}
      photoCategories={photoCategories}
      settings={settings}
      brand={brand}
      variant="section"
    />
  );
}

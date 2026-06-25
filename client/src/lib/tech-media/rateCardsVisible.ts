import type { RateCardGroup, RateCardPackage } from "@/lib/portfolio/portfolioTypes";

export function isRateCardGroupListed(group: RateCardGroup): boolean {
  return group.visible !== false;
}

export function isRateCardPackageListed(pkg: RateCardPackage): boolean {
  return pkg.visible !== false;
}

/** Groups and packages marked listed, preserving order. Drops empty groups. */
export function listedRateCardGroups(groups: RateCardGroup[]): RateCardGroup[] {
  return [...groups]
    .sort((a, b) => a.order - b.order)
    .filter(isRateCardGroupListed)
    .map((g) => ({
      ...g,
      packages: g.packages.filter(isRateCardPackageListed),
    }))
    .filter((g) => g.packages.length > 0);
}

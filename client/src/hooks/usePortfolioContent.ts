import { useMemo } from "react";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { toLegacyPortfolio } from "@/lib/portfolio/portfolioLegacy";

/** Legacy `/portfolio` page — maps live site CMS data to the old portfolio shape. */
export function usePortfolioContent() {
  const { content, loading, error } = useSiteContent();
  const legacy = useMemo(() => toLegacyPortfolio(content), [content]);
  return { content: legacy, loading, error };
}

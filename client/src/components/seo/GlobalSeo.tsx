import { useLocation } from "wouter";
import { PageSeo } from "@/components/seo/PageSeo";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { getSeoForPath } from "@/lib/seo/siteSeo";

/** Route-aware title, meta, Open Graph, Twitter, canonical, and JSON-LD for every page. */
export function GlobalSeo() {
  const [location] = useLocation();
  const { content } = useSiteContent();
  const config = getSeoForPath(location, content.brand);
  return <PageSeo config={config} />;
}

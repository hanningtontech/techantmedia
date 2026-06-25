import { useEffect, useRef } from "react";
import { canonicalUrl } from "@/lib/seo/siteSeo";
import { SITE_NAME } from "@/lib/seo/constants";
import type { PageSeoConfig } from "@/lib/seo/siteSeo";

type Props = {
  config: PageSeoConfig;
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function PageSeo({ config }: Props) {
  const jsonLdIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const { title, description, path, noindex, ogImage, ogType = "website", jsonLd = [] } = config;
    const url = canonicalUrl(path);

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    upsertLink("canonical", url);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "en_KE");
    if (ogImage) upsertMeta("property", "og:image", ogImage);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    if (ogImage) upsertMeta("name", "twitter:image", ogImage);

    for (const id of jsonLdIdsRef.current) {
      document.getElementById(id)?.remove();
    }
    const nextIds: string[] = [];
    jsonLd.forEach((schema, index) => {
      const id = `jsonld-${index}-${path.replace(/\W/g, "-")}`;
      const script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
      nextIds.push(id);
    });
    jsonLdIdsRef.current = nextIds;

    return () => {
      for (const id of jsonLdIdsRef.current) {
        document.getElementById(id)?.remove();
      }
      jsonLdIdsRef.current = [];
    };
  }, [config]);

  return null;
}

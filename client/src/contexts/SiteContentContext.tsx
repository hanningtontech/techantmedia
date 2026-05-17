import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SITE_CONTENT } from "@/lib/portfolio/siteDefaults";
import { subscribeSiteContent } from "@/lib/portfolio/portfolioFirestore";
import type { SiteContent } from "@/lib/portfolio/portfolioTypes";

type Ctx = {
  content: SiteContent;
  loading: boolean;
  error: string | null;
};

const SiteContentContext = createContext<Ctx>({
  content: DEFAULT_SITE_CONTENT,
  loading: true,
  error: null,
});

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeSiteContent(
      (data) => {
        setContent(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load site content");
        setLoading(false);
      },
    );
    if (!unsub) setLoading(false);
    return () => unsub?.();
  }, []);

  return <SiteContentContext.Provider value={{ content, loading, error }}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}

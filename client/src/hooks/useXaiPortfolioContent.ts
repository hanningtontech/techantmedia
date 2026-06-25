import { useEffect, useState } from "react";
import { DEFAULT_XAI_PORTFOLIO } from "@/lib/xai-portfolio/xaiPortfolioDefaults";
import { subscribeXaiPortfolioContent } from "@/lib/xai-portfolio/xaiPortfolioFirestore";
import type { XaiPortfolioContent } from "@/lib/xai-portfolio/xaiPortfolioTypes";

export function useXaiPortfolioContent() {
  const [content, setContent] = useState<XaiPortfolioContent>(DEFAULT_XAI_PORTFOLIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeXaiPortfolioContent((data) => {
      setContent(data);
      setLoading(false);
      setError(null);
    });
    if (!unsub) {
      setLoading(false);
    }
    return () => unsub?.();
  }, []);

  return { content, loading, error };
}

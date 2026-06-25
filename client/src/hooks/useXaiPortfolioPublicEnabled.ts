import { useEffect, useState } from "react";
import { DEFAULT_XAI_PORTFOLIO } from "@/lib/xai-portfolio/xaiPortfolioDefaults";
import { subscribeXaiPortfolioContent } from "@/lib/xai-portfolio/xaiPortfolioFirestore";
import { isXaiPortfolioPublicEnabled } from "@/lib/xai-portfolio/xaiPortfolioVisibility";

export function useXaiPortfolioPublicEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => isXaiPortfolioPublicEnabled(DEFAULT_XAI_PORTFOLIO));

  useEffect(() => {
    const unsub = subscribeXaiPortfolioContent((data) => {
      setEnabled(isXaiPortfolioPublicEnabled(data));
    });
    return () => unsub?.();
  }, []);

  return enabled;
}

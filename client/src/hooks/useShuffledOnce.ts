import { useRef } from "react";
import { shuffleArray } from "@/lib/shuffle";

/**
 * Shuffles `items` once per mount / resetKey / content fingerprint — e.g. after a hard refresh
 * or when gallery data first loads. Avoids re-shuffling on every render.
 */
export function useShuffledOnce<T>(items: readonly T[], resetKey = "default"): T[] {
  const cacheRef = useRef<{ key: string; result: T[] } | null>(null);

  const ids =
    items.length > 0
      ? items
          .map((item) =>
            typeof item === "object" && item !== null && "id" in item
              ? String((item as { id: string }).id)
              : "",
          )
          .join("|")
      : "";

  const combinedKey = `${resetKey}::${ids}`;

  if (cacheRef.current?.key !== combinedKey) {
    cacheRef.current = {
      key: combinedKey,
      result: items.length > 0 ? shuffleArray(items) : [],
    };
  }

  return cacheRef.current.result;
}

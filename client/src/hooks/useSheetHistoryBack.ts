import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

/**
 * Android / browser back closes the sheet without leaving the game page.
 * Pushes a history entry while open; popstate closes the sheet.
 * Optional interceptPopRef: return true to handle back internally (e.g. nested sub-views).
 */
export function useSheetHistoryBack(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  key = "sheet",
  interceptPopRef?: MutableRefObject<(() => boolean) | null>,
) {
  const historyPushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const state = { [`${key}Open`]: true };
    window.history.pushState(state, "");
    historyPushedRef.current = true;

    const onPopState = () => {
      if (interceptPopRef?.current?.()) return;
      historyPushedRef.current = false;
      onOpenChange(false);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [interceptPopRef, key, onOpenChange, open]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onOpenChange(false);
        if (historyPushedRef.current) {
          historyPushedRef.current = false;
          window.history.back();
        }
        return;
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  return handleOpenChange;
}

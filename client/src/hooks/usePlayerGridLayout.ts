import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { computePlayerGridLayout } from "@/lib/game/constants";

function fallbackContainerWidth(): number {
  if (typeof window === "undefined") return 360;
  return Math.max(280, window.innerWidth - 24);
}

/** Measures container width + optional max height so the board fits without clipping. */
export function usePlayerGridLayout(
  cols: number,
  rows: number,
  controlsReservePx = 0,
  measureTargetRef?: RefObject<HTMLElement | null>,
  maxBoardHeight = 0,
  widthInsetPx = 0,
  edgeToEdge = false,
  layoutFillRatio?: number,
  fillBox = false,
  maxBox?: { w?: number; h?: number },
) {
  const internalRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);

  useEffect(() => {
    const el = measureTargetRef?.current ?? internalRef.current;
    if (!el) return;

    const update = () => {
      setPageWidth(el.getBoundingClientRect().width);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [measureTargetRef]);

  const boardWidth = Math.max(
    80,
    (pageWidth || fallbackContainerWidth()) - controlsReservePx - widthInsetPx,
  );

  const layout = useMemo(
    () =>
      computePlayerGridLayout(
        cols,
        rows,
        boardWidth,
        maxBoardHeight > 0 ? maxBoardHeight : undefined,
        { fillWidth: edgeToEdge, fillRatio: layoutFillRatio, fillBox, maxBoxW: maxBox?.w, maxBoxH: maxBox?.h },
      ),
    [cols, rows, boardWidth, maxBoardHeight, edgeToEdge, layoutFillRatio, fillBox, maxBox?.w, maxBox?.h],
  );

  return { internalRef, ...layout };
}

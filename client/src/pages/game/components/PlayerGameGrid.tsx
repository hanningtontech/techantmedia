import { useEffect, useRef, useState, type RefObject } from "react";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { usePlayerGridLayout } from "@/hooks/usePlayerGridLayout";
import { bombShakeDurationMs } from "@/lib/game/bombRevealTiming";
import { cn } from "@/lib/utils";
import "@/pages/simulation/simulationEffects.css";
import "../playerGameCells.css";

/** Minimal flash-only burst — no particles or rings (GPU-friendly). */
function BombExplosionOverlay() {
  return (
    <div className="sim-explosion-ultra pointer-events-none absolute inset-0 z-10" aria-hidden>
      <div className="sim-explosion-ultra__flash" />
    </div>
  );
}

export function PlayerGameGrid({
  layoutMeasureRef,
  controlsReservePx = 0,
  maxBoardHeight = 0,
  widthInsetPx = 0,
  alignStart = false,
  edgeToEdge = false,
  hideHint = false,
  className,
  layoutFillRatio,
  fillBox = false,
  maxBox,
  onTraySize,
  onCellClick,
}: {
  layoutMeasureRef?: RefObject<HTMLElement | null>;
  controlsReservePx?: number;
  maxBoardHeight?: number;
  widthInsetPx?: number;
  alignStart?: boolean;
  edgeToEdge?: boolean;
  hideHint?: boolean;
  className?: string;
  layoutFillRatio?: number;
  fillBox?: boolean;
  maxBox?: { w?: number; h?: number };
  onTraySize?: (size: { width: number; height: number }) => void;
  onCellClick?: () => void;
}) {
  const {
    config,
    cells,
    status,
    clickCell,
    selectedIndex,
    explosionCell,
    bombPopCell,
    bombAnimationsEnabled,
    bombCascadeActive,
    boardEpoch,
    roundSettled,
    gridColorId,
    gridStyleId,
  } = useBlockGamePlayer();

  const [shaking, setShaking] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const { internalRef, cellPx, gap, boardW, boardH } = usePlayerGridLayout(
    config.cols,
    config.rows,
    controlsReservePx,
    layoutMeasureRef,
    maxBoardHeight,
    widthInsetPx,
    edgeToEdge,
    layoutFillRatio,
    fillBox,
    maxBox,
  );
  const compactHint = maxBoardHeight > 0 && maxBoardHeight < 320;
  const roundEnded = status === "lost" || status === "won" || status === "cashed_out";
  const boardLocked = bombCascadeActive || (explosionCell != null && status === "playing");

  useEffect(() => {
    if (!bombAnimationsEnabled || explosionCell == null) return;
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), bombShakeDurationMs(true));
    return () => window.clearTimeout(t);
  }, [explosionCell, boardEpoch, bombAnimationsEnabled]);

  useEffect(() => {
    if (!onTraySize || !trayRef.current) return;
    const measure = () => {
      const tray = trayRef.current;
      if (!tray) return;
      onTraySize({ width: tray.offsetWidth, height: tray.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(trayRef.current);
    return () => ro.disconnect();
  }, [onTraySize, boardW, boardH, cellPx]);

  return (
    <div
      ref={layoutMeasureRef ? undefined : internalRef}
      className={cn(
        "flex min-w-0 flex-col overflow-x-hidden",
        fillBox
          ? "w-full shrink-0 items-center justify-center"
          : edgeToEdge
            ? "w-full items-stretch"
            : alignStart
              ? "shrink-0 items-start"
              : "w-full min-h-0 flex-1 shrink items-center",
        `game-theme--${gridColorId}`,
        `game-style--${gridStyleId}`,
        className,
      )}
    >
      {!hideHint && (
        <p
          className={cn(
            "mb-1.5 w-full shrink-0 px-0.5 text-zinc-400 sm:mb-2",
            edgeToEdge ? "px-3 text-left" : alignStart ? "text-left" : "text-center",
            compactHint ? "text-[10px] leading-snug sm:text-xs" : "text-xs sm:text-sm",
          )}
        >
          {status === "idle" && !roundSettled ? (
            <>Pick size, colour & style — set stake — start a round.</>
          ) : status === "playing" ? (
            <>Tap to reveal · withdraw anytime</>
          ) : status === "lost" ? (
            <>Bomb hit — board revealed. Play again when ready.</>
          ) : roundSettled ? (
            <>Round complete — play again or open your session chart.</>
          ) : (
            <>Ready for the next round.</>
          )}
        </p>
      )}

      <div
        ref={trayRef}
        className={cn(
          "game-board-tray max-w-full",
          edgeToEdge ? "game-board-tray--edge w-full rounded-none border-x-0" : "w-fit",
          fillBox ? "mx-auto" : alignStart && !edgeToEdge ? "mr-auto" : "mx-auto",
          fillBox && "game-board-tray--fill-box",
          bombCascadeActive && bombAnimationsEnabled && "game-board-tray--cascade",
        )}
      >
        <div
          ref={gridRef}
          key={boardEpoch}
          className={cn(
            "inline-grid max-w-full shrink-0",
            edgeToEdge && "mx-auto",
            shaking && bombAnimationsEnabled && "sim-grid-shake--player",
          )}
          style={{
            gridTemplateColumns: `repeat(${config.cols}, ${cellPx}px)`,
            gap: `${gap}px`,
            width: boardW,
            maxWidth: "100%",
            height: boardH,
          }}
          role="grid"
          aria-label={`Game board ${config.rows} by ${config.cols}`}
        >
          {cells.map((cell, index) => {
            const isHidden = cell === "hidden";
            const isExploding = bombAnimationsEnabled && explosionCell === index && cell === "bomb";
            const isPopping = bombAnimationsEnabled && bombPopCell === index && cell === "bomb";
            const isSelected = selectedIndex === index && isHidden && !isExploding;

            return (
              <button
                key={index}
                type="button"
                disabled={!isHidden || status !== "playing" || roundEnded || boardLocked}
                onClick={(e) => {
                  e.preventDefault();
                  if (isHidden && status === "playing" && !roundEnded && !boardLocked) {
                    onCellClick?.();
                  }
                  clickCell(index);
                }}
                style={{
                  width: cellPx,
                  height: cellPx,
                  fontSize: Math.max(8, Math.min(Math.round(cellPx * 0.42), cellPx - 4)),
                }}
                className={cn(
                  "game-cell",
                  isHidden && "game-cell--hidden",
                  cell === "safe" && "game-cell--safe",
                  cell === "bomb" && "game-cell--bomb",
                  isSelected && "game-cell--selected",
                  isExploding && "sim-bomb-cell--player z-20",
                  isPopping && "game-cell--bomb-pop",
                  !isHidden && "cursor-default",
                )}
              >
                <span className="game-cell__shine" aria-hidden />
                <span className="game-cell__rim" aria-hidden />
                <span className="game-cell__icon">
                  {!isHidden ? (cell === "safe" ? "✓" : "💣") : null}
                </span>
                {isExploding && <BombExplosionOverlay />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

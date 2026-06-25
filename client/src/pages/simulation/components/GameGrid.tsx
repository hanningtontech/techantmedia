import { useEffect, useRef, useState } from "react";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { cn } from "@/lib/utils";
import { simHint, simPanelGrid, type SimViewVariant } from "../simulationStyles";
import { SimExpandablePanel } from "./SimExpandablePanel";
import "../simulationEffects.css";

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function BombExplosionOverlay({ size }: { size: number }) {
  const radius = Math.max(size * 0.55, 14);
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <div className="sim-explosion-flash" />
      <div className="sim-explosion-core" />
      <div className="sim-explosion-ring" />
      <div className="sim-explosion-ring sim-explosion-ring--delayed" />
      {PARTICLE_ANGLES.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const dx = `${Math.cos(rad) * radius}px`;
        const dy = `${Math.sin(rad) * radius}px`;
        return (
          <div
            key={deg}
            className="sim-explosion-particle"
            style={{ "--dx": dx, "--dy": dy } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

function cellPixelSize(total: number, cols: number, expanded: boolean): number {
  if (expanded) {
    if (total > 200) return 20;
    if (total > 80) return 28;
    if (total > 25) return 36;
    return 48;
  }
  if (total <= 16) return 40;
  if (total <= 25) return 36;
  if (total <= 49) return 32;
  if (total <= 100) return 28;
  if (total <= 200) return 22;
  return Math.max(14, Math.min(18, Math.floor(280 / cols)));
}

function cellGap(total: number): number {
  if (total > 100) return 2;
  if (total > 25) return 3;
  return 4;
}

export function GameGridInner({ variant }: { variant: SimViewVariant }) {
  const {
    config,
    cells,
    selectedIndex,
    status,
    clickCell,
    playMode,
    boardEpoch,
    roundSettled,
    explosionCell,
  } = useBlockGameSimulation();

  const gridRef = useRef<HTMLDivElement>(null);
  const [shaking, setShaking] = useState(false);

  const expanded = variant === "expanded";
  const roundEnded = status === "lost" || status === "won" || status === "cashed_out";
  const total = cells.length;
  const px = cellPixelSize(total, config.cols, expanded);
  const gap = cellGap(total);
  const boardW = config.cols * px + (config.cols - 1) * gap;
  const fontSize =
    px >= 40 ? "text-sm" : px >= 32 ? "text-xs" : px >= 24 ? "text-[11px]" : "text-[10px]";

  useEffect(() => {
    if (explosionCell == null) return;
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 600);
    return () => window.clearTimeout(t);
  }, [explosionCell, boardEpoch]);

  return (
    <>
      {!expanded && (
        <p className={cn(simHint, "mb-3 shrink-0")}>
          {status === "idle" && !roundSettled ? (
            <>Set deposit & use controls below the grid.</>
          ) : status === "playing" ? (
            <>
              {config.rows}×{config.cols} · {config.bombs} bombs · pick cells to reveal safe (
              <span className="text-emerald-500">✓</span>) or bomb (
              <span className="text-red-500">💣</span>) — withdraw when ready
            </>
          ) : status === "lost" ? (
            <>
              Bomb hit — full board revealed. Open <span className="text-violet-400">Results</span> or{" "}
              <span className="text-violet-400">Play again</span> below.
            </>
          ) : roundSettled ? (
            <>Round complete — use controls below for results or next game.</>
          ) : (
            <>
              {config.rows}×{config.cols} · {config.bombs} bombs · {status}
            </>
          )}
          <span className="ml-2 text-zinc-600">
            · <span className="text-emerald-500">safe</span> / <span className="text-red-500">bomb</span>
          </span>
        </p>
      )}

      {expanded && (
        <p className="mb-4 text-sm text-zinc-400">
          {config.rows}×{config.cols} · {config.bombs} bombs ·{" "}
          {status === "playing"
            ? "Click hidden cells — safe boxes stay open. Withdraw when you want to stop."
            : status === "lost"
              ? "All cells revealed after bomb — check results or play again."
              : roundEnded || roundSettled
                ? "Round finished — see controls below."
                : `Game ${status}.`}
        </p>
      )}

      <div
        className={cn(
          "inline-block max-w-full overflow-visible rounded-xl border border-white/10 bg-black/30",
          expanded ? "p-5" : "p-3",
        )}
      >
        <div
          ref={gridRef}
          key={boardEpoch}
          className={cn("inline-grid shrink-0", shaking && "sim-grid-shake")}
          style={{
            gridTemplateColumns: `repeat(${config.cols}, ${px}px)`,
            gap: `${gap}px`,
            width: boardW,
          }}
          role="grid"
          aria-label={`Game board ${config.rows} by ${config.cols}`}
        >
          {cells.map((cell, index) => {
            const isHidden = cell === "hidden";
            const isSelected = selectedIndex === index;
            const isExploding = explosionCell === index && cell === "bomb";
            return (
              <button
                key={index}
                type="button"
                disabled={!isHidden || status !== "playing" || playMode === "auto" || roundEnded}
                onClick={() => clickCell(index)}
                style={{ width: px, height: px }}
                className={cn(
                  "relative rounded-lg border font-semibold leading-none transition-colors",
                  fontSize,
                  isHidden &&
                    "border-white/15 bg-zinc-800/90 hover:border-violet-400/70 hover:bg-violet-500/20",
                  cell === "safe" && "border-emerald-500/60 bg-emerald-500/35 text-emerald-100",
                  cell === "bomb" && "border-red-500/60 bg-red-500/40 text-red-100",
                  isExploding && "sim-bomb-cell z-20 border-red-400 bg-red-600/50 shadow-[0_0_20px_rgba(239,68,68,0.7)]",
                  isSelected && !isExploding && "ring-2 ring-violet-400 ring-offset-2 ring-offset-[#08080c]",
                  !isHidden && "cursor-default",
                )}
              >
                {!isHidden ? (cell === "safe" ? "✓" : "💣") : "·"}
                {isExploding && <BombExplosionOverlay size={px} />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function GameGrid() {
  const { config } = useBlockGameSimulation();

  return (
    <SimExpandablePanel
      title="Interactive grid"
      description={`${config.rows}×${config.cols} — click to reveal safe cells or bombs.`}
      panelClassName={cn(simPanelGrid, "h-fit w-fit max-w-full shrink-0")}
      dialogClassName="sm:max-w-5xl"
      expandedContent={<GameGridInner variant="expanded" />}
    >
      <GameGridInner variant="inline" />
    </SimExpandablePanel>
  );
}

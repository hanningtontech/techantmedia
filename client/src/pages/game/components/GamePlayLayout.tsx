import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { cn } from "@/lib/utils";
import { PlayerWalletBar } from "./PlayerWalletBar";
import { PlayerGameGrid } from "./PlayerGameGrid";
import { PlayerPlayControls } from "./PlayerPlayControls";
import { PlayerSessionTable } from "./PlayerSessionTable";
import { PlayerChartPanel } from "./PlayerChartPanel";

const LG_BREAKPOINT = 1024;
const ROW_GAP_PX = 12;
/** Keeps desktop grid cell size unchanged after moving controls below the board. */
const DESKTOP_GRID_RESERVE_PX = 220;

function useStackedLayout() {
  const [stacked, setStacked] = useState(
    () => typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`);
    const update = () => setStacked(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return stacked;
}

/**
 * Phone: wallet (collapsible) + grid fits middle + pinned action bar.
 * Grid height is computed from measured top/bottom chrome so no cells are clipped.
 */
function PhoneGamePlayLayout() {
  const { chartPanelMode } = useBlockGamePlayer();
  const chartOpen = chartPanelMode === "open";
  const topRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [boardMax, setBoardMax] = useState(0);

  const measureBoard = useCallback(() => {
    const topH = topRef.current?.getBoundingClientRect().height ?? 0;
    const ctrlH = controlsRef.current?.getBoundingClientRect().height ?? 0;
    const safeBottom =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)")) || 0;
    const gap = 8;
    const avail = window.innerHeight - topH - ctrlH - gap - safeBottom;
    setBoardMax(Math.max(80, avail));
  }, []);

  useEffect(() => {
    measureBoard();
    const roTop = new ResizeObserver(measureBoard);
    const roCtrl = new ResizeObserver(measureBoard);
    if (topRef.current) roTop.observe(topRef.current);
    if (controlsRef.current) roCtrl.observe(controlsRef.current);
    window.addEventListener("resize", measureBoard);
    return () => {
      roTop.disconnect();
      roCtrl.disconnect();
      window.removeEventListener("resize", measureBoard);
    };
  }, [chartOpen, measureBoard]);

  return (
    <div
      className={cn(
        "flex h-svh max-h-svh w-full flex-col overflow-hidden",
        chartOpen && "overflow-y-auto",
      )}
    >
      <div ref={topRef} className="shrink-0 px-2 pt-2">
        <PlayerWalletBar phoneMode />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-0 py-1">
        <PlayerGameGrid maxBoardHeight={boardMax} edgeToEdge hideHint />
      </div>

      <div
        ref={controlsRef}
        className="shrink-0 border-t border-white/10 bg-[#06060a]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
      >
        <PlayerPlayControls phone />
      </div>

      {chartOpen && (
        <section className="shrink-0 px-2 pb-6" aria-label="Session chart">
          <PlayerChartPanel className="h-[min(42vh,340px)]" />
        </section>
      )}
    </div>
  );
}

/**
 * Desktop: grid left, controls right (always visible).
 * Phone: dedicated compact single-screen layout (see PhoneGamePlayLayout).
 */
export function GamePlayLayout() {
  const { chartPanelMode } = useBlockGamePlayer();
  const chartOpen = chartPanelMode === "open";
  const isStacked = useStackedLayout();
  const isPhone = usePhoneGameLayout();
  const pageRef = useRef<HTMLDivElement>(null);
  const playSectionRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const gridColRef = useRef<HTMLDivElement>(null);
  const [controlsBlockSize, setControlsBlockSize] = useState(isStacked ? 120 : 200);
  const [maxBoardHeight, setMaxBoardHeight] = useState(0);
  const [gridColHeight, setGridColHeight] = useState(320);
  const isDesktopWide = !isPhone && !isStacked;

  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;

    const measure = () => {
      setControlsBlockSize(isStacked ? el.offsetHeight : el.offsetWidth);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isStacked]);

  const measurePlayArea = useCallback(() => {
    const section = playSectionRef.current;
    if (!section) return;

    const top = section.getBoundingClientRect().top;
    const safeBottom =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)")) || 0;
    const bottomPad = (chartOpen ? 16 : 12) + safeBottom;

    let avail = window.innerHeight - top - bottomPad;
    if (isStacked) {
      avail -= controlsBlockSize + ROW_GAP_PX;
    }

    setMaxBoardHeight(Math.max(120, avail));
  }, [chartOpen, controlsBlockSize, isStacked]);

  useEffect(() => {
    const onResize = () => measurePlayArea();
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [measurePlayArea]);

  useEffect(() => {
    measurePlayArea();
    const ro = new ResizeObserver(measurePlayArea);
    if (pageRef.current) ro.observe(pageRef.current);
    if (playSectionRef.current) ro.observe(playSectionRef.current);
    return () => ro.disconnect();
  }, [measurePlayArea, chartOpen, isStacked]);

  useEffect(() => {
    if (!isDesktopWide) return;
    const el = gridColRef.current;
    if (!el) return;
    const measure = () => setGridColHeight(Math.max(200, el.offsetHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktopWide, chartOpen, maxBoardHeight]);

  const controlsReserve = isStacked ? 0 : isDesktopWide ? DESKTOP_GRID_RESERVE_PX : controlsBlockSize + ROW_GAP_PX;

  if (isPhone) {
    return <PhoneGamePlayLayout />;
  }

  return (
    <div
      ref={pageRef}
      className={cn(
        "mx-auto flex w-full flex-col py-2 sm:py-3 lg:py-4",
        isDesktopWide ? "w-[80vw] max-w-[80vw] px-0" : "max-w-6xl px-3 sm:px-4 lg:gap-1",
        isPhone ? "gap-2 px-0 py-2" : "gap-0",
        !chartOpen && cn("h-svh max-h-svh overflow-x-hidden", isPhone ? "overflow-y-auto" : "overflow-y-hidden"),
      )}
    >
      <header className="mb-1 shrink-0 px-3 text-center sm:mb-1.5 sm:px-4 sm:text-left">
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl lg:mb-0">Block Game</h1>
        <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block sm:text-sm lg:mt-1">
          Real play · KES wallet · Same fair multiplier as our simulation engine
        </p>
      </header>

      <div className="shrink-0 px-3 sm:px-4">
        <PlayerWalletBar />
      </div>

      <section
        ref={playSectionRef}
        className={cn(
          "flex min-h-0 w-full min-w-0",
          chartOpen ? "flex-1" : "shrink-0",
          isStacked
            ? "flex-col items-stretch justify-start gap-2 overflow-x-hidden px-3"
            : isDesktopWide
              ? "flex-1 items-start justify-center overflow-hidden"
              : "flex-1 items-start justify-start overflow-hidden",
        )}
        aria-label="Game board"
      >
        {isDesktopWide ? (
          <div className="flex w-full items-start gap-4 lg:gap-5">
            <div ref={gridColRef} className="flex shrink-0 flex-col items-start gap-2">
              <PlayerGameGrid
                layoutMeasureRef={pageRef}
                controlsReservePx={DESKTOP_GRID_RESERVE_PX}
                maxBoardHeight={maxBoardHeight}
                alignStart
                widthInsetPx={0}
                edgeToEdge={false}
              />
              <PlayerPlayControls layout="desktop" />
            </div>
            <div className="min-w-[min(100%,18rem)] flex-1 self-stretch">
              <PlayerSessionTable targetHeight={gridColHeight} />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex max-w-full",
              isStacked ? "w-full flex-col gap-2" : "items-center gap-3 md:gap-4 lg:gap-5",
            )}
          >
            <PlayerGameGrid
              layoutMeasureRef={isStacked ? playSectionRef : pageRef}
              controlsReservePx={controlsReserve}
              maxBoardHeight={maxBoardHeight}
              alignStart={!isStacked}
              widthInsetPx={0}
              edgeToEdge={isPhone}
            />

            {!isStacked && (
              <div
                ref={controlsRef}
                className="shrink-0 w-44 sm:w-48 md:w-52 lg:w-56"
              >
                <PlayerPlayControls layout="side" singleColumn={false} pinned />
              </div>
            )}

            {isStacked && (
              <div ref={controlsRef} className="w-full shrink-0">
                <PlayerPlayControls layout="stack" singleColumn pinned />
              </div>
            )}
          </div>
        )}
      </section>

      {chartOpen && (
        <section className="shrink-0 px-3 pb-8 sm:px-4" aria-label="Session chart">
          <PlayerChartPanel className="h-[min(48vh,380px)] lg:h-[440px]" />
        </section>
      )}
    </div>
  );
}

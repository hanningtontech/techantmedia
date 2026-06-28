import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { useGameViewportLayout } from "@/hooks/useGameViewportLayout";
import {
  GAME_GRID_SIDEBAR_GAP,
  resolveDesktopGridColumnPx,
} from "@/lib/game/gameLayoutConstants";
import { cn } from "@/lib/utils";
import { PlayerWalletBar } from "./PlayerWalletBar";
import { GameSalutation } from "./GameSalutation";
import { PlayerGameGrid } from "./PlayerGameGrid";
import { PlayerPlayControls } from "./PlayerPlayControls";
import { PlayerSessionTable } from "./PlayerSessionTable";
import { PlayerChartPanel } from "./PlayerChartPanel";

const ROW_GAP_PX = 12;
/** Fixed inline chart height on phone — fits x-axis inside viewport without scrolling. */
const PHONE_INLINE_CHART_PX = 228;

/**
 * Phone: wallet (collapsible) + grid fits middle + pinned action bar.
 * Grid height is computed from measured top/bottom chrome so no cells are clipped.
 */
function PhoneGamePlayLayout() {
  const { chartPanelMode, status } = useBlockGamePlayer();
  const chartOpen = chartPanelMode === "open";
  const topRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [boardMax, setBoardMax] = useState(0);
  const [walletExpanded, setWalletExpanded] = useState(false);

  const collapseWalletOnGridTap = useCallback(() => {
    if (status === "playing" && walletExpanded) {
      setWalletExpanded(false);
    }
  }, [status, walletExpanded]);

  const measureBoard = useCallback(() => {
    const topH = topRef.current?.getBoundingClientRect().height ?? 0;
    const ctrlH = controlsRef.current?.getBoundingClientRect().height ?? 0;
    const safeBottom =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)")) || 0;
    const chartH = chartOpen ? PHONE_INLINE_CHART_PX + 12 : 0;
    const gap = chartOpen ? 6 : 8;
    const avail = window.innerHeight - topH - ctrlH - chartH - gap - safeBottom;
    setBoardMax(Math.max(80, avail));
  }, [chartOpen]);

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
  }, [chartOpen, measureBoard, walletExpanded]);

  return (
    <div className="flex h-svh max-h-svh w-full flex-col overflow-hidden">
      <div ref={topRef} className="shrink-0 space-y-1 px-2 pt-2">
        <GameSalutation className="px-0.5" />
        <PlayerWalletBar
          phoneMode
          phoneWalletExpanded={walletExpanded}
          onPhoneWalletExpandedChange={setWalletExpanded}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-1">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <PlayerGameGrid
            maxBoardHeight={boardMax}
            edgeToEdge
            hideHint
            onCellClick={collapseWalletOnGridTap}
          />
        </div>

        {chartOpen && (
          <section
            className="mx-2 mb-1 shrink-0 overflow-hidden"
            style={{ height: PHONE_INLINE_CHART_PX }}
            aria-label="Session chart"
          >
            <PlayerChartPanel className="h-full" />
          </section>
        )}
      </div>

      <div
        ref={controlsRef}
        className="shrink-0 border-t border-white/10 bg-[#06060a]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
      >
        <PlayerPlayControls phone />
      </div>
    </div>
  );
}

/**
 * Desktop: grid left, wallet + session table right (width > 700px).
 * Phone: dedicated stacked layout (width ≤ 700px).
 */
export function GamePlayLayout() {
  const { chartPanelMode } = useBlockGamePlayer();
  const chartOpen = chartPanelMode === "open";
  const { isPhone, isDesktopWithSession } = useGameViewportLayout();
  const pageRef = useRef<HTMLDivElement>(null);
  const playSectionRef = useRef<HTMLElement>(null);
  const desktopControlsRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const gridMeasureRef = useRef<HTMLDivElement>(null);
  const gridColRef = useRef<HTMLDivElement>(null);
  const [desktopControlsHeight, setDesktopControlsHeight] = useState(100);
  const [maxBoardHeight, setMaxBoardHeight] = useState(0);
  const [playColHeight, setPlayColHeight] = useState(0);
  const [boardTrayWidth, setBoardTrayWidth] = useState(0);
  const [gridColumnWidth, setGridColumnWidth] = useState(0);

  useEffect(() => {
    if (!isDesktopWithSession) return;
    const el = desktopControlsRef.current;
    if (!el) return;

    const measure = () => setDesktopControlsHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktopWithSession, chartOpen, maxBoardHeight]);

  const measurePlayArea = useCallback(() => {
    const section = playSectionRef.current;
    if (!section) return;

    const top = section.getBoundingClientRect().top;
    const safeBottom =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)")) || 0;
    const bottomPad = 12 + safeBottom;

    const avail = window.innerHeight - top - bottomPad - desktopControlsHeight - ROW_GAP_PX;
    setMaxBoardHeight(Math.max(120, avail));
  }, [desktopControlsHeight]);

  useEffect(() => {
    const onResize = () => measurePlayArea();
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measurePlayArea]);

  useEffect(() => {
    measurePlayArea();
    const ro = new ResizeObserver(measurePlayArea);
    if (pageRef.current) ro.observe(pageRef.current);
    if (playSectionRef.current) ro.observe(playSectionRef.current);
    return () => ro.disconnect();
  }, [measurePlayArea, chartOpen]);

  useEffect(() => {
    if (!isDesktopWithSession) return;
    const el = gridColRef.current;
    if (!el) return;
    const measure = () => setPlayColHeight(Math.max(0, el.offsetHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktopWithSession, chartOpen, maxBoardHeight]);

  const measureDesktopRow = useCallback(() => {
    if (!isDesktopWithSession) return;
    const shell = pageRef.current?.clientWidth ?? 0;
    setGridColumnWidth(resolveDesktopGridColumnPx(shell));
  }, [isDesktopWithSession]);

  useEffect(() => {
    if (!isDesktopWithSession) return;
    measureDesktopRow();
    const ro = new ResizeObserver(measureDesktopRow);
    if (pageRef.current) ro.observe(pageRef.current);
    window.addEventListener("resize", measureDesktopRow);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureDesktopRow);
    };
  }, [isDesktopWithSession, measureDesktopRow]);

  if (isPhone) {
    return <PhoneGamePlayLayout />;
  }

  return (
    <div
      ref={pageRef}
      className={cn(
        "mx-auto flex w-[80vw] max-w-[80vw] flex-col px-3 py-2 sm:px-4 sm:py-3 lg:py-4",
        "min-h-svh overflow-x-hidden overflow-y-auto",
      )}
    >
      <div className="flex w-full flex-col gap-3">
        <header className="shrink-0 text-center sm:text-left">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl lg:mb-0">Block Game</h1>
          <GameSalutation className="mt-0.5" />
          <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block sm:text-sm lg:mt-1">
            Real play · KES wallet · Same fair multiplier as our simulation engine
          </p>
        </header>

        <div className="flex w-full items-start justify-start" style={{ gap: GAME_GRID_SIDEBAR_GAP }}>
          <section
            ref={playSectionRef}
            className="relative min-w-0 shrink-0 overflow-hidden"
            style={{
              width:
                boardTrayWidth > 0
                  ? boardTrayWidth
                  : gridColumnWidth > 0
                    ? gridColumnWidth
                    : undefined,
            }}
            aria-label="Game board"
          >
            <div
              ref={gridMeasureRef}
              className="pointer-events-none absolute h-0 overflow-hidden opacity-0"
              style={gridColumnWidth > 0 ? { width: gridColumnWidth } : undefined}
              aria-hidden
            />
            <div ref={gridColRef} className="flex w-full flex-col items-stretch gap-2">
              <PlayerGameGrid
                layoutMeasureRef={gridMeasureRef}
                controlsReservePx={0}
                maxBoardHeight={maxBoardHeight}
                alignStart
                widthInsetPx={0}
                edgeToEdge={false}
                layoutFillRatio={1}
                className="w-full max-w-full"
                onTraySize={({ width }) => setBoardTrayWidth(width)}
              />
              <div
                ref={desktopControlsRef}
                className="shrink-0 self-start"
                style={boardTrayWidth > 0 ? { width: boardTrayWidth } : undefined}
              >
                <PlayerPlayControls layout="desktop" alignWithGrid />
              </div>
            </div>
          </section>

          <aside
            ref={sidebarRef}
            className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden"
            style={playColHeight > 0 ? { height: playColHeight } : undefined}
          >
            <PlayerWalletBar />
            <PlayerSessionTable fillParent className="min-h-0 w-full flex-1" />
          </aside>
        </div>
      </div>

      {chartOpen && (
        <section className="mt-2 shrink-0 pb-8" aria-label="Session chart">
          <PlayerChartPanel className="h-[min(48vh,380px)] lg:h-[440px]" />
        </section>
      )}
    </div>
  );
}

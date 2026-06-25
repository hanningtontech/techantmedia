import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  computeVisibleRange,
  computeCandleGeometry,
  layoutCandlesCenter,
  layoutCandlesRight,
  maxPanOffsetCenter,
  nearestCandleIndex,
  nearestPlacedCandleIndex,
  panByPixels,
  panByWheelSteps,
  visibleCountForWidth,
} from "@/lib/simulation/chartViewport";
import type { SimCandle } from "@/lib/simulation/candleSeries";
import type { ChartTimeframe, SimChartTick } from "@/lib/simulation/timeChartHistory";
import { chartLocalTimeZone, formatTimeAxisLabel, liveChartCenterTimeMs, liveChartTimeAtSlot } from "@/lib/simulation/timeChartHistory";
import { cn } from "@/lib/utils";
import { CandleDetailDialog } from "./CandleDetailDialog";

type IndexedCandle = SimCandle & { _idx: number; _slot: number };

export interface ChartSeries {
  id: string;
  label: string;
  shortLabel: string;
  candles: SimCandle[];
}

const TV = {
  bg: "#131722",
  grid: "#1e222d",
  gridBold: "#2a2e39",
  bull: "#26a69a",
  bear: "#ef5350",
  text: "#d1d4dc",
  muted: "#787b86",
  crosshair: "rgba(120,123,134,0.45)",
  volume: "rgba(41,98,255,0.45)",
};

type ChartDisplayMode = "candles" | "line" | "area";

const CHART_MODES: { id: ChartDisplayMode; label: string }[] = [
  { id: "candles", label: "Candles" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];
const PAD = { top: 28, right: 68, bottom: 22, left: 8 };
const VOLUME_H_RATIO = 0.14;
/** Minimum stick length past the body so every candle shows a thin wick. */
const MIN_WICK_PX = 3;

function fmtPrice(n: number) {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${abs.toFixed(digits)}`;
}

function fmtPriceAxis(n: number) {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  if (Math.abs(n) < 0.005) return "0.00";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${abs.toFixed(digits)}`;
}

function fmtOhlc(n: number) {
  return fmtPrice(n);
}

export interface ChartLiveStats {
  games: number;
  target: number;
  players: number;
  activePlayer: number;
  userNet: number;
  houseNet: number;
  rtp: number;
  targetRtp: number;
  progressPct: number;
}

export function ForexCandlestickChart({
  series,
  live,
  defaultSeriesId,
  liveStats,
  className,
  timeframes = [],
  timeframeId = "1s",
  onTimeframeChange,
  chartHistory = [],
}: {
  series: ChartSeries[];
  live?: boolean;
  defaultSeriesId?: string;
  liveStats?: ChartLiveStats;
  className?: string;
  timeframes?: ChartTimeframe[];
  timeframeId?: string;
  onTimeframeChange?: (id: string) => void;
  chartHistory?: SimChartTick[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startOffset: number; startPricePan: number }>({
    active: false,
    startX: 0,
    startY: 0,
    startOffset: 0,
    startPricePan: 0,
  });

  const [size, setSize] = useState({ w: 800, h: 400 });
  const [activeId, setActiveId] = useState(defaultSeriesId ?? series[0]?.id ?? "");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [pricePan, setPricePan] = useState(0);
  const [followLatest, setFollowLatest] = useState(true);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [displayMode, setDisplayMode] = useState<ChartDisplayMode>("candles");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; candleIdx: number } | null>(null);
  const [detailCandleIdx, setDetailCandleIdx] = useState<number | null>(null);
  const [axisNow, setAxisNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setAxisNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const active = series.find((s) => s.id === activeId) ?? series[0];
  const userCandles = series.find((s) => s.id === "user")?.candles ?? series[0]?.candles ?? [];
  const houseCandles = series.find((s) => s.id === "house")?.candles ?? [];
  const allCandles = active?.candles ?? [];

  const useCenterAnchor = live === true;
  const visibleCount = useMemo(() => visibleCountForWidth(size.w, zoom), [size.w, zoom]);

  const panMax = useMemo(() => {
    if (useCenterAnchor) return maxPanOffsetCenter(allCandles.length, visibleCount);
    return computeVisibleRange(allCandles.length, { visibleCount, scrollOffset: 0 }).maxOffset;
  }, [allCandles.length, useCenterAnchor, visibleCount]);

  const placedCandles = useMemo((): IndexedCandle[] => {
    if (allCandles.length === 0) return [];
    if (useCenterAnchor) {
      return layoutCandlesCenter(allCandles, visibleCount, scrollOffset).map(({ item, globalIndex, slot }) => ({
        ...(item as SimCandle),
        _idx: globalIndex,
        _slot: slot,
      }));
    }
    return layoutCandlesRight(allCandles, visibleCount, scrollOffset).map(({ item, globalIndex, slot }) => ({
      ...(item as SimCandle),
      _idx: globalIndex,
      _slot: slot,
    }));
  }, [allCandles, scrollOffset, useCenterAnchor, visibleCount]);

  const chartTimeframeMs = useMemo(
    () => timeframes.find((tf) => tf.id === timeframeId)?.ms ?? 1_000,
    [timeframeId, timeframes],
  );

  const fixedLiveXLabels = useMemo(() => {
    if (!useCenterAnchor || allCandles.length === 0) return null;
    const centerTimeMs = liveChartCenterTimeMs(allCandles[allCandles.length - 1], axisNow);
    const plotW = Math.max(100, size.w - PAD.left - PAD.right);
    const slotW = plotW / Math.max(visibleCount, 1);
    const labelEvery = Math.max(1, Math.ceil(visibleCount / Math.max(4, Math.floor(plotW / 90))));
    const labels: { x: number; label: string; idx: number }[] = [];
    for (let slot = 0; slot < visibleCount; slot += labelEvery) {
      labels.push({
        x: PAD.left + (slot + 0.5) * slotW,
        label: formatTimeAxisLabel(
          liveChartTimeAtSlot(slot, visibleCount, chartTimeframeMs, centerTimeMs),
          chartTimeframeMs,
        ),
        idx: slot,
      });
    }
    const lastSlot = visibleCount - 1;
    if (labels[labels.length - 1]?.idx !== lastSlot) {
      labels.push({
        x: PAD.left + (lastSlot + 0.5) * slotW,
        label: formatTimeAxisLabel(
          liveChartTimeAtSlot(lastSlot, visibleCount, chartTimeframeMs, centerTimeMs),
          chartTimeframeMs,
        ),
        idx: lastSlot,
      });
    }
    return labels;
  }, [allCandles, axisNow, chartTimeframeMs, size.w, useCenterAnchor, visibleCount]);

  const canPanOlder = !useCenterAnchor && scrollOffset < panMax;
  const canPanNewer = !useCenterAnchor && scrollOffset > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box && box.width > 0 && box.height > 0) {
        setSize({ w: box.width, h: box.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (live) {
      setFollowLatest(true);
      setScrollOffset(0);
    }
  }, [live]);

  useEffect(() => {
    if (followLatest) setScrollOffset(0);
  }, [allCandles.length, followLatest]);

  useEffect(() => {
    setScrollOffset((o) => Math.min(o, panMax));
  }, [panMax]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(16, z + 0.5));
    setFollowLatest(false);
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.5, z - 0.5));
  }, []);

  const goToLatest = useCallback(() => {
    setScrollOffset(0);
    setPricePan(0);
    setFollowLatest(true);
    setSelectedIdx(null);
  }, []);

  const openContextMenu = useCallback((e: ReactMouseEvent, candleIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, candleIdx });
  }, []);

  const zoomToCandle = useCallback(
    (candleIdx: number) => {
      if (useCenterAnchor) {
        const newPan = Math.min(panMax, Math.max(0, allCandles.length - 1 - candleIdx));
        setScrollOffset(newPan);
      } else {
        const count = Math.min(visibleCount, allCandles.length);
        const maxOffset = Math.max(0, allCandles.length - count);
        const centerFromEnd = allCandles.length - candleIdx - 1;
        const half = Math.floor(visibleCount / 2);
        const newOffset = Math.max(0, centerFromEnd - half);
        setScrollOffset(Math.min(newOffset, maxOffset));
      }
      setFollowLatest(false);
      setSelectedIdx(candleIdx);
    },
    [allCandles.length, panMax, useCenterAnchor, visibleCount],
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const handleChartContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (allCandles.length === 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const plotLeft = PAD.left;
      const plotRight = size.w - PAD.right;
      if (x < plotLeft || x > plotRight) return;
      const slotW = (plotRight - plotLeft) / Math.max(visibleCount, 1);
      const idx = useCenterAnchor
        ? nearestPlacedCandleIndex(x, plotLeft, slotW, placedCandles)
        : nearestCandleIndex(
            x,
            plotLeft,
            slotW,
            placedCandles[0]?._idx ?? 0,
            placedCandles.length,
          );
      if (idx == null) return;
      openContextMenu(e, idx);
    },
    [allCandles.length, openContextMenu, placedCandles, size.w, useCenterAnchor, visibleCount],
  );

  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (useCenterAnchor) {
        if (e.ctrlKey || e.metaKey) {
          if (e.deltaY < 0) zoomIn();
          else if (e.deltaY > 0) zoomOut();
        } else {
          setPricePan((p) => {
            const step = 0.06;
            return p + (e.deltaY > 0 ? step : -step);
          });
        }
        return;
      }
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (horizontal) {
        const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
        setFollowLatest(false);
        setScrollOffset((o) => panByWheelSteps(o, delta, panMax, 2, 0));
      } else if (e.ctrlKey || e.metaKey) {
        if (e.deltaY < 0) zoomIn();
        else if (e.deltaY > 0) zoomOut();
      } else {
        setFollowLatest(false);
        setPricePan((p) => {
          const step = 0.06;
          return p + (e.deltaY > 0 ? step : -step);
        });
      }
    },
    [panMax, useCenterAnchor, zoomIn, zoomOut],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (allCandles.length === 0) return;
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startOffset: scrollOffset,
        startPricePan: pricePan,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [allCandles.length, pricePan, scrollOffset],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setCrosshair({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (!dragRef.current.active) return;

      if (useCenterAnchor) {
        const deltaY = e.clientY - dragRef.current.startY;
        setPricePan(dragRef.current.startPricePan + deltaY * 0.003);
        return;
      }

      const slotW = (size.w - PAD.left - PAD.right) / Math.max(visibleCount, 1);
      const deltaX = e.clientX - dragRef.current.startX;
      setFollowLatest(false);
      setScrollOffset(panByPixels(dragRef.current.startOffset, -deltaX, slotW, panMax, 0));
    },
    [panMax, size.w, useCenterAnchor, visibleCount],
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handlePointerLeave = useCallback(() => {
    dragRef.current.active = false;
    setCrosshair(null);
  }, []);

  const chart = useMemo(() => {
    const W = size.w;
    const H = size.h;
    const candles = placedCandles;
    const mode = displayMode;
    const slotCount = visibleCount;

    if (candles.length === 0 || W < 10 || H < 10) {
      return {
        seriesLayer: [] as ReactNode[],
        volumeBars: [] as ReactNode[],
        yMin: -10,
        yMax: 10,
        plotLeft: PAD.left,
        plotRight: W - PAD.right,
        plotTop: PAD.top,
        plotBottom: H - PAD.bottom,
        mainBottom: H - PAD.bottom,
        xLabels: [] as { x: number; label: string; idx: number }[],
        yScale: (_v: number) => H / 2,
        currentY: H / 2,
        currentPrice: 0,
        slotW: 10,
        zeroLineY: H / 2,
      };
    }

    let yLo = Infinity;
    let yHi = -Infinity;
    let maxVol = 0;
    for (const c of candles) {
      yLo = Math.min(yLo, c.low);
      yHi = Math.max(yHi, c.high);
      if (mode !== "candles") {
        yLo = Math.min(yLo, c.close);
        yHi = Math.max(yHi, c.close);
      }
      maxVol = Math.max(maxVol, c.volume);
    }
    const padY = Math.max(8, (yHi - yLo) * 0.12 || 20);
    const range = yHi - yLo + padY * 2;
    const panPx = pricePan * range;
    yLo -= padY - panPx;
    yHi += padY - panPx;

    const plotLeft = PAD.left;
    const plotRight = W - PAD.right;
    const plotTop = PAD.top;
    const plotBottom = H - PAD.bottom;
    const volumeH = Math.max(18, (plotBottom - plotTop) * VOLUME_H_RATIO);
    const mainBottom = plotBottom - volumeH - 4;
    const plotW = plotRight - plotLeft;
    const { slotW, bodyW, wickW } = computeCandleGeometry(plotW, slotCount);

    const yScale = (v: number) => plotTop + ((yHi - v) / (yHi - yLo)) * (mainBottom - plotTop);
    const zeroLineY = yScale(0);

    const cxAt = (slot: number) => plotLeft + slot * slotW + slotW / 2;

    let seriesLayer: ReactNode[] = [];

    if (mode === "candles") {
      seriesLayer = candles.map((c) => {
        const cx = cxAt(c._slot);
        const yOpen = yScale(c.open);
        const yClose = yScale(c.close);
        const top = Math.min(yOpen, yClose);
        const h = Math.max(1, Math.abs(yClose - yOpen));
        const color = c.bullish ? TV.bull : TV.bear;
        const sel = selectedIdx === c._idx;
        // Keep a thin visible stick on every candle (extend slightly past the body when flat).
        const yHigh = Math.min(yScale(c.high), top - MIN_WICK_PX);
        const yLow = Math.max(yScale(c.low), top + h + MIN_WICK_PX);

        return (
          <g
            key={`${c.id}-${c._idx}`}
            onClick={() => setSelectedIdx(sel ? null : c._idx)}
            onContextMenu={(e) => openContextMenu(e, c._idx)}
            className="cursor-pointer"
          >
            {sel && (
              <rect
                x={plotLeft + c._slot * slotW}
                y={plotTop}
                width={slotW}
                height={mainBottom - plotTop}
                fill="rgba(41,98,255,0.06)"
              />
            )}
            <line
              x1={cx}
              x2={cx}
              y1={yHigh}
              y2={yLow}
              stroke={color}
              strokeWidth={wickW}
              strokeLinecap="round"
            />
            <rect
              x={cx - bodyW / 2}
              y={top}
              width={bodyW}
              height={h}
              fill={color}
              stroke={sel ? "#2962ff" : "none"}
              strokeWidth={sel ? 1 : 0}
              rx={bodyW > 4 ? 0.5 : 0}
            />
          </g>
        );
      });
    } else {
      const pts = candles.map((c) => `${cxAt(c._slot)},${yScale(c.close)}`).join(" ");
      const lineColor = candles[candles.length - 1]!.close >= 0 ? TV.bull : TV.bear;

      if (mode === "area") {
        const baseline = zeroLineY >= plotTop && zeroLineY <= mainBottom ? zeroLineY : mainBottom;
        const first = candles[0]!;
        const lastC = candles[candles.length - 1]!;
        const areaPath = [
          `M ${cxAt(first._slot)},${baseline}`,
          ...candles.map((c) => `L ${cxAt(c._slot)},${yScale(c.close)}`),
          `L ${cxAt(lastC._slot)},${baseline}`,
          "Z",
        ].join(" ");
        seriesLayer = [
          <defs key="area-grad">
            <linearGradient id="sim-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>,
          <path key="area-fill" d={areaPath} fill="url(#sim-area-grad)" stroke="none" />,
          <polyline
            key="area-line"
            points={pts}
            fill="none"
            stroke={lineColor}
            strokeWidth={candles.length <= 12 ? 2.25 : candles.length <= 40 ? 1.75 : 1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />,
          ...candles.map((c) => {
            const sel = selectedIdx === c._idx;
            const r = candles.length <= 12 ? 3.5 : candles.length <= 40 ? 2.5 : 1.5;
            return (
              <circle
                key={`pt-${c.id}`}
                cx={cxAt(c._slot)}
                cy={yScale(c.close)}
                r={sel ? r + 1 : r}
                fill={sel ? "#2962ff" : lineColor}
                stroke={sel ? "#fff" : "none"}
                strokeWidth={sel ? 1 : 0}
                onClick={() => setSelectedIdx(sel ? null : c._idx)}
                onContextMenu={(e) => openContextMenu(e, c._idx)}
                className="cursor-pointer"
              />
            );
          }),
        ];
      } else {
        seriesLayer = [
          <polyline
            key="line"
            points={pts}
            fill="none"
            stroke={lineColor}
            strokeWidth={candles.length <= 12 ? 2.25 : candles.length <= 40 ? 1.75 : 1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />,
          ...candles.map((c) => {
            const sel = selectedIdx === c._idx;
            const r = candles.length <= 12 ? 3.5 : candles.length <= 40 ? 2.5 : 1.5;
            return (
              <circle
                key={`pt-${c.id}`}
                cx={cxAt(c._slot)}
                cy={yScale(c.close)}
                r={sel ? r + 1 : r}
                fill={sel ? "#2962ff" : lineColor}
                stroke={sel ? "#fff" : "none"}
                strokeWidth={sel ? 1 : 0}
                onClick={() => setSelectedIdx(sel ? null : c._idx)}
                onContextMenu={(e) => openContextMenu(e, c._idx)}
                className="cursor-pointer"
              />
            );
          }),
        ];
      }
    }

    const volumeBars = candles.map((c) => {
      const barH = maxVol > 0 ? (c.volume / maxVol) * (volumeH - 2) : 0;
      const volW = Math.max(1, slotW * (slotCount <= 16 ? 0.88 : slotCount <= 48 ? 0.72 : 0.55));
      const x = plotLeft + c._slot * slotW + (slotW - volW) / 2;
      return (
        <rect
          key={`vol-${c.id}-${c._idx}`}
          x={x}
          y={plotBottom - barH}
          width={volW}
          height={Math.max(1, barH)}
          fill={TV.volume}
          opacity={0.85}
        />
      );
    });

    const labelEvery = Math.max(1, Math.ceil(candles.length / Math.max(4, Math.floor(plotW / 90))));
    const xLabels = candles
      .map((c, i) => ({
        idx: c._idx,
        label: c.label.replace("*", ""),
        x: cxAt(c._slot),
      }))
      .filter((_, i) => i % labelEvery === 0 || i === candles.length - 1);

    const last = candles[candles.length - 1]!;
    const currentPrice = last.close;
    const currentY = yScale(currentPrice);

    return {
      seriesLayer,
      volumeBars,
      yMin: yLo,
      yMax: yHi,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      mainBottom,
      xLabels,
      yScale,
      currentY,
      currentPrice,
      slotW,
      zeroLineY,
    };
  }, [placedCandles, pricePan, size, selectedIdx, displayMode, openContextMenu, visibleCount]);

  const yTicks = useMemo(() => {
    const steps = Math.max(4, Math.floor((size.h - 40) / 70));
    const rangeY = chart.yMax - chart.yMin;
    return Array.from({ length: steps }, (_, i) => chart.yMin + (rangeY * i) / (steps - 1));
  }, [chart.yMax, chart.yMin, size.h]);

  const zeroY = chart.yScale(0);
  const showZero = zeroY >= chart.plotTop && zeroY <= chart.mainBottom;

  const crosshairCandleIdx =
    crosshair != null
      ? useCenterAnchor
        ? nearestPlacedCandleIndex(crosshair.x, chart.plotLeft, chart.slotW, placedCandles)
        : nearestCandleIndex(
            crosshair.x,
            chart.plotLeft,
            chart.slotW,
            placedCandles[0]?._idx ?? 0,
            placedCandles.length,
          )
      : null;
  const crosshairCandle = crosshairCandleIdx != null ? allCandles[crosshairCandleIdx] : null;
  const crosshairPlaced = placedCandles.find((c) => c._idx === crosshairCandleIdx);
  const crosshairX =
    crosshairPlaced != null
      ? chart.plotLeft + (crosshairPlaced._slot + 0.5) * chart.slotW
      : crosshair?.x ?? 0;

  const focus =
    selectedIdx != null ? allCandles[selectedIdx] : crosshairCandle ?? allCandles[allCandles.length - 1];
  const focusChange =
    focus && allCandles.length > 1
      ? focus.close - focus.open
      : 0;
  const focusBull = focusChange >= 0;

  const timeframeLabel = timeframes.find((tf) => tf.id === timeframeId)?.label;
  const detailUserCandle = detailCandleIdx != null ? userCandles[detailCandleIdx] ?? null : null;
  const detailHouseCandle = detailCandleIdx != null ? houseCandles[detailCandleIdx] ?? null : null;

  const crosshairY =
    crosshair && crosshair.y >= chart.plotTop && crosshair.y <= chart.mainBottom
      ? crosshair.y
      : null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)} style={{ background: TV.bg }}>
      <div
        className="flex shrink-0 items-center gap-1 border-b px-2 py-1"
        style={{ borderColor: TV.gridBold, background: TV.bg }}
      >
        {series.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setActiveId(s.id);
              setSelectedIdx(null);
            }}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              activeId === s.id ? "text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc]",
            )}
          >
            {s.shortLabel}
          </button>
        ))}
        <span className="mx-1 text-[#2a2e39]">|</span>
        {CHART_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setDisplayMode(m.id)}
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
              displayMode === m.id ? "text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc]",
            )}
          >
            {m.label}
          </button>
        ))}
        <span className="mx-1 text-[#2a2e39]">|</span>
        <div className="flex max-w-[40%] gap-0.5 overflow-x-auto">
          {timeframes.map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => onTimeframeChange?.(tf.id)}
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                timeframeId === tf.id ? "text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc]",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
        {live && (
          <span className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#26a69a]">
            ● Live
          </span>
        )}
        {live && (
          <span className="ml-1 hidden shrink-0 text-[9px] text-[#787b86] sm:inline" title="Chart times use your device clock">
            {chartLocalTimeZone()}
          </span>
        )}
        {!followLatest && (
          <button
            type="button"
            onClick={goToLatest}
            className="ml-1 flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-[#2962ff] hover:bg-[#2a2e39]"
            title="Jump to latest"
          >
            <RotateCcw className="h-3 w-3" />
            Latest
          </button>
        )}
        {liveStats && (
          <span className="ml-2 hidden shrink-0 text-[10px] tabular-nums text-[#787b86] sm:inline">
            G {liveStats.games.toLocaleString()}/{liveStats.target.toLocaleString()}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={zoomOut} className="flex h-6 w-6 items-center justify-center rounded text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]" aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={zoomIn} className="flex h-6 w-6 items-center justify-center rounded text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]" aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        onContextMenu={handleChartContextMenu}
      >
        {allCandles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-xs text-[#787b86]">
            <p>No session data yet.</p>
            <p className="text-[10px] text-[#434651]">Play a game or run auto sim — candles build from your session history.</p>
          </div>
        ) : (
          <>
            {focus && (
              <div className="pointer-events-none absolute left-2 top-1 z-10 flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[11px] tabular-nums">
                <span className="font-semibold text-[#d1d4dc]">{active?.label}</span>
                <span className="text-[#787b86]">·</span>
                {displayMode === "candles" ? (
                  <>
                    <span className="text-[#787b86]">O <span style={{ color: focus.open >= 0 ? TV.bull : TV.bear }}>{fmtOhlc(focus.open)}</span></span>
                    <span className="text-[#787b86]">H <span style={{ color: TV.bull }}>{fmtOhlc(focus.high)}</span></span>
                    <span className="text-[#787b86]">L <span style={{ color: TV.bear }}>{fmtOhlc(focus.low)}</span></span>
                  </>
                ) : null}
                <span className="text-[#787b86]">C <span style={{ color: focus.close >= 0 ? TV.bull : TV.bear }}>{fmtOhlc(focus.close)}</span></span>
                <span style={{ color: focusBull ? TV.bull : TV.bear }}>{fmtPrice(focusChange)}</span>
                {focus.timeStart != null && <span className="text-[#434651]">{focus.label}</span>}
              </div>
            )}

            {canPanOlder && !useCenterAnchor && (
              <div className="pointer-events-none absolute right-2 top-1 z-10 text-[9px] text-[#434651]">
                Scroll ↑↓ price · Ctrl+scroll zoom · Shift+scroll time
              </div>
            )}
            {useCenterAnchor && (
              <div className="pointer-events-none absolute right-2 top-1 z-10 text-[9px] text-[#434651]">
                Drag ↑↓ price · Ctrl+scroll zoom · +/- compress candles
              </div>
            )}

            <svg width={size.w} height={size.h} className="block" role="img" aria-label="Simulation candlestick chart">
              <defs>
                <clipPath id="chart-plot-clip">
                  <rect x={chart.plotLeft} y={chart.plotTop} width={chart.plotRight - chart.plotLeft} height={chart.plotBottom - chart.plotTop} />
                </clipPath>
              </defs>
              <rect width={size.w} height={size.h} fill={TV.bg} />
              {yTicks.map((tick) => {
                const y = chart.yScale(tick);
                return <line key={`h-${tick}`} x1={chart.plotLeft} x2={chart.plotRight} y1={y} y2={y} stroke={TV.grid} strokeWidth={1} />;
              })}
              {Array.from({ length: Math.min(visibleCount, 24) }, (_, i) => {
                const step = Math.max(1, Math.ceil(visibleCount / 24));
                if (i % step !== 0) return null;
                const x = chart.plotLeft + i * chart.slotW;
                return <line key={`v-${i}`} x1={x} x2={x} y1={chart.plotTop} y2={chart.plotBottom} stroke={TV.grid} strokeWidth={1} />;
              })}
              {showZero && (
                <line x1={chart.plotLeft} x2={chart.plotRight} y1={zeroY} y2={zeroY} stroke={TV.gridBold} strokeWidth={1} strokeDasharray="4 4" />
              )}
              <g clipPath="url(#chart-plot-clip)">{chart.seriesLayer}</g>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.mainBottom + 2} y2={chart.mainBottom + 2} stroke={TV.gridBold} strokeWidth={1} />
              <g clipPath="url(#chart-plot-clip)">{chart.volumeBars}</g>
              <text x={chart.plotLeft + 2} y={chart.plotBottom - 2} fill={TV.muted} fontSize={8}>Vol</text>
              <line x1={chart.plotLeft} x2={chart.plotRight} y1={chart.currentY} y2={chart.currentY} stroke={chart.currentPrice >= 0 ? TV.bull : TV.bear} strokeWidth={1} strokeDasharray="3 3" opacity={0.85} />
              {yTicks.map((tick) => {
                const y = chart.yScale(tick);
                const isCurrent = Math.abs(tick - chart.currentPrice) < (chart.yMax - chart.yMin) * 0.04;
                if (isCurrent) return null;
                return (
                  <text key={`yl-${tick}`} x={chart.plotRight + 6} y={y + 3.5} fill={tick > 0 ? TV.bull : tick < 0 ? TV.bear : TV.muted} fontSize={10}>
                    {fmtPriceAxis(tick)}
                  </text>
                );
              })}
              <rect x={chart.plotRight + 2} y={chart.currentY - 9} width={62} height={18} rx={2} fill={chart.currentPrice >= 0 ? TV.bull : TV.bear} />
              <text x={chart.plotRight + 33} y={chart.currentY + 4} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="600">
                {fmtPriceAxis(chart.currentPrice)}
              </text>
              {(fixedLiveXLabels ?? chart.xLabels).map(({ x, label, idx }) => (
                <text key={`x-${idx}`} x={x} y={size.h - 6} textAnchor="middle" fill={selectedIdx === idx || crosshairCandleIdx === idx ? "#2962ff" : TV.muted} fontSize={9}>
                  {label}
                </text>
              ))}
              {crosshair && crosshair.x >= chart.plotLeft && crosshair.x <= chart.plotRight && (
                <>
                  <line x1={crosshairX} x2={crosshairX} y1={chart.plotTop} y2={chart.plotBottom} stroke={TV.crosshair} strokeWidth={1} strokeDasharray="4 3" />
                  {crosshairY != null && (
                    <line x1={chart.plotLeft} x2={chart.plotRight} y1={crosshairY} y2={crosshairY} stroke={TV.crosshair} strokeWidth={1} strokeDasharray="4 3" />
                  )}
                </>
              )}
            </svg>

            {crosshairCandle && crosshair && (
              <div
                className="pointer-events-none absolute z-20 rounded border px-1.5 py-0.5 text-[9px] tabular-nums"
                style={{
                  left: Math.min(crosshair.x + 8, size.w - 120),
                  top: Math.max(4, crosshair.y - 28),
                  borderColor: TV.gridBold,
                  background: "rgba(28,32,48,0.92)",
                  color: TV.text,
                }}
              >
                <div className="text-[#787b86]">{crosshairCandle.label}</div>
                <div style={{ color: crosshairCandle.close >= 0 ? TV.bull : TV.bear }}>{fmtPrice(crosshairCandle.close)}</div>
              </div>
            )}

            <span className="pointer-events-none absolute bottom-6 left-2 text-[10px] font-semibold text-[#434651]">SimChart</span>

            {contextMenu && (
              <div
                className="fixed z-50 min-w-[148px] rounded-md border py-1 shadow-lg"
                style={{
                  left: contextMenu.x,
                  top: contextMenu.y,
                  borderColor: TV.gridBold,
                  background: "#1c2030",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="flex w-full px-3 py-1.5 text-left text-[11px] text-[#d1d4dc] hover:bg-[#2a2e39]"
                  onClick={() => {
                    setDetailCandleIdx(contextMenu.candleIdx);
                    setSelectedIdx(contextMenu.candleIdx);
                    setContextMenu(null);
                  }}
                >
                  View candle details…
                </button>
                <button
                  type="button"
                  className="flex w-full px-3 py-1.5 text-left text-[11px] text-[#d1d4dc] hover:bg-[#2a2e39]"
                  onClick={() => {
                    setSelectedIdx(contextMenu.candleIdx);
                    setContextMenu(null);
                  }}
                >
                  Highlight candle
                </button>
                <button
                  type="button"
                  className="flex w-full px-3 py-1.5 text-left text-[11px] text-[#d1d4dc] hover:bg-[#2a2e39]"
                  onClick={() => {
                    zoomToCandle(contextMenu.candleIdx);
                    setContextMenu(null);
                  }}
                >
                  Zoom to candle
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <CandleDetailDialog
        open={detailCandleIdx != null}
        onOpenChange={(open) => {
          if (!open) setDetailCandleIdx(null);
        }}
        userCandle={detailUserCandle}
        houseCandle={detailHouseCandle}
        chartHistory={chartHistory}
        timeframeLabel={timeframeLabel}
      />

      {liveStats && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-0.5 border-t px-3 py-1.5 text-[10px] tabular-nums" style={{ borderColor: TV.gridBold, background: "#1c2030" }}>
          <span className="text-[#787b86]">
            Net <span style={{ color: liveStats.userNet >= 0 ? TV.bull : TV.bear }}>{fmtPrice(liveStats.userNet)}</span>
            <span className="text-[#434651]"> / </span>
            <span style={{ color: liveStats.houseNet >= 0 ? TV.bull : TV.bear }}>{fmtPrice(liveStats.houseNet)}</span>
          </span>
          <span className="text-[#787b86]">Games <span className="text-[#d1d4dc]">{liveStats.games.toLocaleString()}</span></span>
          <span className="text-[#787b86]">RTP <span className="text-[#d1d4dc]">{(liveStats.rtp * 100).toFixed(1)}%</span></span>
          <span className="ml-auto text-[#787b86]">{liveStats.progressPct}%</span>
        </div>
      )}
    </div>
  );
}

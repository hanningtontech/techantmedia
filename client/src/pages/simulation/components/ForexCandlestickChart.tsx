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
import { computeChartLayout } from "@/lib/simulation/chartLayout";
import {
  buildPriceScale,
  currentPriceBadgeWidth,
  formatOhlc,
  formatPriceAxis,
  formatPriceDisplay,
  priceToY,
  type ChartSeriesMode,
} from "@/lib/simulation/chartPriceScale";
import { buildCenterAnchoredTimeLabels, buildTimeAxisLabels, liveCenterTimeMsFromCandles } from "@/lib/simulation/chartTimeScale";
import {
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
import {
  CHART_TIMEFRAMES,
  chartLocalTimeZone,
  formatCandleTimeRange,
  summarizeCandlePeriod,
} from "@/lib/simulation/timeChartHistory";
import { cn } from "@/lib/utils";
import { CandleDetailDialog } from "./CandleDetailDialog";
import { ForexCandlestickChartToolbar } from "./ForexCandlestickChartToolbar";

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

const MIN_WICK_PX = 3;

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
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startOffset: number;
    startPricePan: number;
    axis: "time" | "price" | null;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startOffset: 0,
    startPricePan: 0,
    axis: null,
  });

  const [size, setSize] = useState({ w: 800, h: 400 });
  const [activeId, setActiveId] = useState(defaultSeriesId ?? series[0]?.id ?? "");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [pricePan, setPricePan] = useState(0);
  const [followLatest, setFollowLatest] = useState(true);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [displayMode, setDisplayMode] = useState<ChartSeriesMode>("candles");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; candleIdx: number } | null>(null);
  const [detailCandleIdx, setDetailCandleIdx] = useState<number | null>(null);
  const [axisNow, setAxisNow] = useState(() => Date.now());

  const useCenterAnchor = live === true;

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setAxisNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const active = series.find((s) => s.id === activeId) ?? series[0];
  const userCandles = series.find((s) => s.id === "user")?.candles ?? series[0]?.candles ?? [];
  const houseCandles = series.find((s) => s.id === "house")?.candles ?? [];
  const allCandles = active?.candles ?? [];

  const layout = useMemo(() => computeChartLayout(size.w, size.h), [size.w, size.h]);
  const visibleCount = useMemo(
    () => visibleCountForWidth(size.w, zoom, layout.pad.left, layout.pad.right),
    [layout.pad.left, layout.pad.right, size.w, zoom],
  );

  const panMax = useMemo(() => {
    if (useCenterAnchor) return maxPanOffsetCenter(allCandles.length, visibleCount);
    const count = Math.min(visibleCount, allCandles.length);
    return Math.max(0, allCandles.length - count);
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

  const chartTimeframeMs = useMemo(() => {
    const found = CHART_TIMEFRAMES.find((t) => t.id === timeframeId);
    return found?.ms ?? CHART_TIMEFRAMES[0]!.ms;
  }, [timeframeId]);

  const latestCandleAnchor = useMemo(() => {
    const last = allCandles[allCandles.length - 1];
    if (!last) return 0;
    return last.gameEnd ?? last.timeEnd ?? last.id;
  }, [allCandles]);

  const canPanOlder = scrollOffset < panMax;
  const canPanNewer = scrollOffset > 0;

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
  }, [latestCandleAnchor, followLatest]);

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

  const plotMetrics = useMemo(() => {
    const W = size.w;
    const H = size.h;
    const pad = layout.pad;
    const plotLeft = pad.left;
    const plotRight = W - pad.right;
    const plotTop = pad.top;
    const plotBottom = H - pad.bottom;
    const volumeH = Math.max(14, (plotBottom - plotTop) * layout.volumeRatio);
    const mainBottom = plotBottom - volumeH - 4;
    const plotW = plotRight - plotLeft;
    const { slotW, bodyW, wickW } = computeCandleGeometry(plotW, visibleCount);
    return { plotLeft, plotRight, plotTop, plotBottom, mainBottom, plotW, slotW, bodyW, wickW, volumeH };
  }, [layout, size, visibleCount]);

  const priceScale = useMemo(
    () => buildPriceScale(placedCandles, displayMode, plotMetrics.mainBottom - plotMetrics.plotTop, pricePan),
    [displayMode, placedCandles, plotMetrics.mainBottom, plotMetrics.plotTop, pricePan],
  );

  const yScale = useCallback(
    (v: number) => priceToY(v, priceScale.range, plotMetrics.plotTop, plotMetrics.mainBottom),
    [plotMetrics.mainBottom, plotMetrics.plotTop, priceScale.range],
  );

  const xLabels = useMemo(() => {
    if (useCenterAnchor) {
      const centerTimeMs = liveCenterTimeMsFromCandles(allCandles, axisNow);
      return buildCenterAnchoredTimeLabels(
        visibleCount,
        plotMetrics.plotLeft,
        plotMetrics.slotW,
        chartTimeframeMs,
        centerTimeMs,
        layout.minLabelGapPx,
        layout.fonts.axis,
      );
    }
    return buildTimeAxisLabels(
      placedCandles.map((c) => ({ candle: c, globalIndex: c._idx, slot: c._slot })),
      plotMetrics.plotLeft,
      plotMetrics.slotW,
      chartTimeframeMs,
      layout.minLabelGapPx,
      layout.fonts.axis,
    );
  }, [
    allCandles,
    axisNow,
    chartTimeframeMs,
    layout.fonts.axis,
    layout.minLabelGapPx,
    placedCandles,
    plotMetrics.plotLeft,
    plotMetrics.slotW,
    useCenterAnchor,
    visibleCount,
  ]);

  const badgeW = useMemo(() => {
    const last = placedCandles[placedCandles.length - 1];
    const price = last?.close ?? 0;
    return Math.min(layout.priceAxisWidth - 4, currentPriceBadgeWidth(price, layout.fonts.badge));
  }, [layout.fonts.badge, layout.priceAxisWidth, placedCandles]);

  const handleChartContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (allCandles.length === 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const { plotLeft, plotRight, slotW } = plotMetrics;
      if (x < plotLeft || x > plotRight) return;
      const idx = useCenterAnchor
        ? (nearestPlacedCandleIndex(x, plotLeft, slotW, placedCandles) ?? placedCandles[0]?._idx ?? 0)
        : nearestCandleIndex(x, plotLeft, slotW, placedCandles[0]?._idx ?? 0, placedCandles.length);
      openContextMenu(e, idx);
    },
    [allCandles.length, openContextMenu, placedCandles, plotMetrics, useCenterAnchor],
  );

  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (useCenterAnchor) {
        if (e.ctrlKey || e.metaKey) {
          if (e.deltaY < 0) zoomIn();
          else if (e.deltaY > 0) zoomOut();
        } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
          setFollowLatest(false);
          setScrollOffset((o) => panByWheelSteps(o, delta, panMax, 2, 0));
        } else {
          setPricePan((p) => {
            const step = 0.06;
            return p + (e.deltaY > 0 ? step : -step);
          });
        }
        return;
      }
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (e.ctrlKey || e.metaKey) {
        if (e.deltaY < 0) zoomIn();
        else if (e.deltaY > 0) zoomOut();
      } else if (horizontal) {
        const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
        setFollowLatest(false);
        setScrollOffset((o) => panByWheelSteps(o, delta, panMax, 2, 0));
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
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : 0;
      const onPriceAxis = rect && x >= plotMetrics.plotRight - 4;
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startOffset: scrollOffset,
        startPricePan: pricePan,
        axis: onPriceAxis ? "price" : "time",
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [allCandles.length, plotMetrics.plotRight, pricePan, scrollOffset],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setCrosshair({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (!dragRef.current.active) return;

      if (dragRef.current.axis === "price") {
        const deltaY = e.clientY - dragRef.current.startY;
        setPricePan(dragRef.current.startPricePan + deltaY * 0.003);
        return;
      }

      const deltaX = e.clientX - dragRef.current.startX;
      if (useCenterAnchor || dragRef.current.axis === "time") {
        setFollowLatest(false);
        setScrollOffset(
          panByPixels(dragRef.current.startOffset, -deltaX, plotMetrics.slotW, panMax, 0),
        );
      }
    },
    [panMax, plotMetrics.slotW, useCenterAnchor],
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    dragRef.current.axis = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handlePointerLeave = useCallback(() => {
    dragRef.current.active = false;
    dragRef.current.axis = null;
    setCrosshair(null);
  }, []);

  const chart = useMemo(() => {
    const { plotLeft, plotRight, plotTop, plotBottom, mainBottom, slotW, bodyW, wickW, volumeH } =
      plotMetrics;
    const candles = placedCandles;
    const mode = displayMode;

    if (candles.length === 0 || size.w < 10 || size.h < 10) {
      return {
        seriesLayer: [] as ReactNode[],
        volumeBars: [] as ReactNode[],
        currentY: size.h / 2,
        currentPrice: 0,
        zeroLineY: size.h / 2,
      };
    }

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
        const yHigh = Math.min(yScale(c.high), top - MIN_WICK_PX);
        const yLow = Math.max(yScale(c.low), top + h + MIN_WICK_PX);

        return (
          <g
            key={`${c.id}-${c._idx}`}
            onClick={() => setSelectedIdx(sel ? null : c._idx)}
            onContextMenu={(ev) => openContextMenu(ev, c._idx)}
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
            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={wickW} strokeLinecap="round" />
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
    } else if (mode === "bars") {
      const tickW = Math.max(2, Math.min(bodyW, slotW * 0.35));
      seriesLayer = candles.map((c) => {
        const cx = cxAt(c._slot);
        const color = c.bullish ? TV.bull : TV.bear;
        const sel = selectedIdx === c._idx;
        const yHigh = yScale(c.high);
        const yLow = yScale(c.low);
        const yOpen = yScale(c.open);
        const yClose = yScale(c.close);

        return (
          <g
            key={`bar-${c.id}-${c._idx}`}
            onClick={() => setSelectedIdx(sel ? null : c._idx)}
            onContextMenu={(ev) => openContextMenu(ev, c._idx)}
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
            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={wickW} strokeLinecap="round" />
            <line
              x1={cx - tickW}
              x2={cx}
              y1={yOpen}
              y2={yOpen}
              stroke={color}
              strokeWidth={Math.max(1, wickW)}
              strokeLinecap="round"
            />
            <line
              x1={cx}
              x2={cx + tickW}
              y1={yClose}
              y2={yClose}
              stroke={color}
              strokeWidth={Math.max(1, wickW)}
              strokeLinecap="round"
            />
          </g>
        );
      });
    } else {
      const pts = candles.map((c) => `${cxAt(c._slot)},${yScale(c.close)}`).join(" ");
      const lineColor = candles[candles.length - 1]!.close >= 0 ? TV.bull : TV.bear;
      const zeroLineY = yScale(0);
      const dotR = candles.length <= 12 ? 3.5 : candles.length <= 40 ? 2.5 : 1.5;
      const strokeW = candles.length <= 12 ? 2.25 : candles.length <= 40 ? 1.75 : 1.25;

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
            strokeWidth={strokeW}
            strokeLinejoin="round"
            strokeLinecap="round"
          />,
          ...candles.map((c) => {
            const sel = selectedIdx === c._idx;
            return (
              <circle
                key={`pt-${c.id}`}
                cx={cxAt(c._slot)}
                cy={yScale(c.close)}
                r={sel ? dotR + 1 : dotR}
                fill={sel ? "#2962ff" : lineColor}
                stroke={sel ? "#fff" : "none"}
                strokeWidth={sel ? 1 : 0}
                onClick={() => setSelectedIdx(sel ? null : c._idx)}
                onContextMenu={(ev) => openContextMenu(ev, c._idx)}
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
            strokeWidth={strokeW}
            strokeLinejoin="round"
            strokeLinecap="round"
          />,
          ...candles.map((c) => {
            const sel = selectedIdx === c._idx;
            return (
              <circle
                key={`pt-${c.id}`}
                cx={cxAt(c._slot)}
                cy={yScale(c.close)}
                r={sel ? dotR + 1 : dotR}
                fill={sel ? "#2962ff" : lineColor}
                stroke={sel ? "#fff" : "none"}
                strokeWidth={sel ? 1 : 0}
                onClick={() => setSelectedIdx(sel ? null : c._idx)}
                onContextMenu={(ev) => openContextMenu(ev, c._idx)}
                className="cursor-pointer"
              />
            );
          }),
        ];
      }
    }

    const maxVol = candles.reduce((m, c) => Math.max(m, c.volume), 0);
    const volumeBars = candles.map((c) => {
      const barH = maxVol > 0 ? (c.volume / maxVol) * (volumeH - 2) : 0;
      const volW = Math.max(1, slotW * (visibleCount <= 16 ? 0.88 : visibleCount <= 48 ? 0.72 : 0.55));
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

    const last = candles[candles.length - 1]!;
    return {
      seriesLayer,
      volumeBars,
      currentY: yScale(last.close),
      currentPrice: last.close,
      zeroLineY: yScale(0),
    };
  }, [
    displayMode,
    openContextMenu,
    placedCandles,
    plotMetrics,
    selectedIdx,
    size.h,
    size.w,
    visibleCount,
    yScale,
  ]);

  const zeroY = chart.zeroLineY;
  const showZero = zeroY >= plotMetrics.plotTop && zeroY <= plotMetrics.mainBottom;

  const crosshairCandleIdx =
    crosshair != null
      ? useCenterAnchor
        ? nearestPlacedCandleIndex(
            crosshair.x,
            plotMetrics.plotLeft,
            plotMetrics.slotW,
            placedCandles,
          )
        : nearestCandleIndex(
            crosshair.x,
            plotMetrics.plotLeft,
            plotMetrics.slotW,
            placedCandles[0]?._idx ?? 0,
            placedCandles.length,
          )
      : null;
  const crosshairCandle = crosshairCandleIdx != null ? allCandles[crosshairCandleIdx] : null;
  const crosshairPlaced = placedCandles.find((c) => c._idx === crosshairCandleIdx);
  const crosshairX =
    crosshairPlaced != null
      ? plotMetrics.plotLeft + (crosshairPlaced._slot + 0.5) * plotMetrics.slotW
      : crosshair?.x ?? 0;

  const focus =
    selectedIdx != null ? allCandles[selectedIdx] : crosshairCandle ?? allCandles[allCandles.length - 1];
  const focusChange = focus && allCandles.length > 1 ? focus.close - focus.open : 0;
  const focusBull = focusChange >= 0;

  const focusPeriodStats = useMemo(() => {
    if (!focus || chartHistory.length === 0) return null;
    return summarizeCandlePeriod(chartHistory, focus);
  }, [chartHistory, focus]);

  const timeframeLabel = CHART_TIMEFRAMES.find((tf) => tf.id === timeframeId)?.label ?? timeframeId;

  const crosshairPeriodStats = useMemo(() => {
    if (!crosshairCandle || chartHistory.length === 0) return null;
    return summarizeCandlePeriod(chartHistory, crosshairCandle);
  }, [chartHistory, crosshairCandle]);
  const detailUserCandle = detailCandleIdx != null ? (userCandles[detailCandleIdx] ?? null) : null;
  const detailHouseCandle = detailCandleIdx != null ? (houseCandles[detailCandleIdx] ?? null) : null;

  const crosshairY =
    crosshair && crosshair.y >= plotMetrics.plotTop && crosshair.y <= plotMetrics.mainBottom
      ? crosshair.y
      : null;

  const axisFont = layout.fonts.axis;
  const statusFont = layout.fonts.status;
  const hintFont = layout.fonts.hint;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)} style={{ background: TV.bg }}>
      <ForexCandlestickChartToolbar
        series={series}
        activeId={activeId}
        onSeriesChange={(id) => {
          setActiveId(id);
          setSelectedIdx(null);
        }}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        timeframeId={timeframeId}
        onTimeframeChange={onTimeframeChange}
        live={live}
        layout={layout}
        followLatest={followLatest}
        onGoToLatest={goToLatest}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        liveStats={liveStats}
        totalCandles={allCandles.length}
      />

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
            <p className="text-[10px] text-[#434651]">
              Play a game or run auto sim — candles build from your session history.
            </p>
          </div>
        ) : (
          <>
            {focus && (
              <div
                className="pointer-events-none absolute left-1 top-0.5 z-10 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 tabular-nums sm:left-2 sm:top-1 sm:gap-x-2"
                style={{ fontSize: statusFont, maxWidth: layout.statusLineMaxWidth }}
              >
                <span className="font-semibold text-[#d1d4dc]">{active?.label}</span>
                <span
                  className="rounded px-1 py-px text-[9px] font-semibold text-[#2962ff]"
                  style={{ background: "rgba(41,98,255,0.12)" }}
                >
                  {timeframeLabel}
                </span>
                <span className="hidden text-[#787b86] sm:inline">·</span>
                {(displayMode === "candles" || displayMode === "bars") && layout.toolbar.showOhlcHighLow && (
                  <>
                    <span className="text-[#787b86]">
                      O <span style={{ color: focus.open >= 0 ? TV.bull : TV.bear }}>{formatOhlc(focus.open)}</span>
                    </span>
                    <span className="text-[#787b86]">
                      H <span style={{ color: TV.bull }}>{formatOhlc(focus.high)}</span>
                    </span>
                    <span className="text-[#787b86]">
                      L <span style={{ color: TV.bear }}>{formatOhlc(focus.low)}</span>
                    </span>
                  </>
                )}
                <span className="text-[#787b86]">
                  C <span style={{ color: focus.close >= 0 ? TV.bull : TV.bear }}>{formatOhlc(focus.close)}</span>
                </span>
                <span style={{ color: focusBull ? TV.bull : TV.bear }}>{formatPriceDisplay(focusChange)}</span>
                {focusPeriodStats && (
                  <span className="hidden text-[#787b86] md:inline">
                    Vol {formatPriceDisplay(focusPeriodStats.totalVolume)} · {focusPeriodStats.gamesPlayed} rnd
                  </span>
                )}
                {focus.timeStart != null && (
                  <span className="hidden text-[#434651] lg:inline">{focus.label}</span>
                )}
                {layout.toolbar.showTimezone && (
                  <span className="hidden text-[#434651] xl:inline">{chartLocalTimeZone()}</span>
                )}
              </div>
            )}

            {layout.toolbar.showHints && (
              <div
                className="pointer-events-none absolute right-1 top-0.5 z-10 max-w-[48%] text-right text-[#434651] sm:right-2 sm:top-1 sm:max-w-none"
                style={{ fontSize: hintFont }}
              >
                {useCenterAnchor
                  ? "Live center · drag ↔ history · scroll price · shift+scroll time"
                  : "Drag ↔ time · price axis · Shift+scroll · Ctrl zoom"}
              </div>
            )}

            <svg width={size.w} height={size.h} className="block" role="img" aria-label="Block game candlestick chart">
              <defs>
                <clipPath id="chart-plot-clip">
                  <rect
                    x={plotMetrics.plotLeft}
                    y={plotMetrics.plotTop}
                    width={plotMetrics.plotRight - plotMetrics.plotLeft}
                    height={plotMetrics.plotBottom - plotMetrics.plotTop}
                  />
                </clipPath>
              </defs>
              <rect width={size.w} height={size.h} fill={TV.bg} />

              {priceScale.ticks.map((tick) => {
                const y = yScale(tick);
                if (y < plotMetrics.plotTop - 1 || y > plotMetrics.plotBottom + 1) return null;
                return (
                  <line
                    key={`h-${tick}`}
                    x1={plotMetrics.plotLeft}
                    x2={plotMetrics.plotRight}
                    y1={y}
                    y2={y}
                    stroke={TV.grid}
                    strokeWidth={1}
                  />
                );
              })}

              {Array.from({ length: Math.min(visibleCount, 24) }, (_, i) => {
                const step = Math.max(1, Math.ceil(visibleCount / 24));
                if (i % step !== 0) return null;
                const x = plotMetrics.plotLeft + i * plotMetrics.slotW;
                return (
                  <line
                    key={`v-${i}`}
                    x1={x}
                    x2={x}
                    y1={plotMetrics.plotTop}
                    y2={plotMetrics.plotBottom}
                    stroke={TV.grid}
                    strokeWidth={1}
                  />
                );
              })}

              {showZero && (
                <line
                  x1={plotMetrics.plotLeft}
                  x2={plotMetrics.plotRight}
                  y1={zeroY}
                  y2={zeroY}
                  stroke={TV.gridBold}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              )}

              <g clipPath="url(#chart-plot-clip)">{chart.seriesLayer}</g>

              <line
                x1={plotMetrics.plotLeft}
                x2={plotMetrics.plotRight}
                y1={plotMetrics.mainBottom + 2}
                y2={plotMetrics.mainBottom + 2}
                stroke={TV.gridBold}
                strokeWidth={1}
              />
              <g clipPath="url(#chart-plot-clip)">{chart.volumeBars}</g>

              {plotMetrics.mainBottom - plotMetrics.plotTop > 50 && (
                <text
                  x={plotMetrics.plotLeft + 2}
                  y={plotMetrics.plotBottom - 2}
                  fill={TV.muted}
                  fontSize={Math.max(7, axisFont - 1)}
                >
                  Vol
                </text>
              )}

              <line
                x1={plotMetrics.plotLeft}
                x2={plotMetrics.plotRight}
                y1={chart.currentY}
                y2={chart.currentY}
                stroke={chart.currentPrice >= 0 ? TV.bull : TV.bear}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.85}
              />

              {priceScale.ticks.map((tick) => {
                const y = yScale(tick);
                const isCurrent = Math.abs(tick - chart.currentPrice) < (priceScale.range.max - priceScale.range.min) * 0.04;
                if (isCurrent || y < plotMetrics.plotTop || y > plotMetrics.plotBottom) return null;
                return (
                  <text
                    key={`yl-${tick}`}
                    x={plotMetrics.plotRight + 4}
                    y={y + axisFont * 0.35}
                    fill={tick > 0 ? TV.bull : tick < 0 ? TV.bear : TV.muted}
                    fontSize={axisFont}
                  >
                    {formatPriceAxis(tick)}
                  </text>
                );
              })}

              <rect
                x={plotMetrics.plotRight + 2}
                y={chart.currentY - axisFont * 0.9}
                width={badgeW}
                height={axisFont + 8}
                rx={2}
                fill={chart.currentPrice >= 0 ? TV.bull : TV.bear}
              />
              <text
                x={plotMetrics.plotRight + 2 + badgeW / 2}
                y={chart.currentY + axisFont * 0.3}
                textAnchor="middle"
                fill="#fff"
                fontSize={axisFont}
                fontWeight="600"
              >
                {formatPriceAxis(chart.currentPrice)}
              </text>

              {xLabels.map(({ x, label, idx }) => (
                <text
                  key={`x-${idx}`}
                  x={x}
                  y={size.h - 4}
                  textAnchor="middle"
                  fill={selectedIdx === idx || crosshairCandleIdx === idx ? "#2962ff" : TV.muted}
                  fontSize={axisFont}
                >
                  {label}
                </text>
              ))}

              {crosshair && crosshair.x >= plotMetrics.plotLeft && crosshair.x <= plotMetrics.plotRight && (
                <>
                  <line
                    x1={crosshairX}
                    x2={crosshairX}
                    y1={plotMetrics.plotTop}
                    y2={plotMetrics.plotBottom}
                    stroke={TV.crosshair}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  {crosshairY != null && (
                    <line
                      x1={plotMetrics.plotLeft}
                      x2={plotMetrics.plotRight}
                      y1={crosshairY}
                      y2={crosshairY}
                      stroke={TV.crosshair}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                  )}
                </>
              )}
            </svg>

            {crosshairCandle && crosshair && (
              <div
                className="pointer-events-none absolute z-20 max-w-[min(200px,52vw)] rounded border px-2 py-1 tabular-nums"
                style={{
                  left: Math.min(crosshair.x + 8, size.w - 200),
                  top: Math.max(4, crosshair.y - 72),
                  borderColor: TV.gridBold,
                  background: "rgba(28,32,48,0.94)",
                  color: TV.text,
                  fontSize: hintFont,
                }}
              >
                <div className="mb-0.5 flex items-center gap-1">
                  <span className="font-semibold text-[#d1d4dc]">{timeframeLabel}</span>
                  <span className="text-[#434651]">·</span>
                  <span className="truncate text-[#787b86]">{crosshairCandle.label}</span>
                </div>
                {formatCandleTimeRange(crosshairCandle) && (
                  <div className="mb-0.5 truncate text-[9px] text-[#434651]">
                    {formatCandleTimeRange(crosshairCandle)}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-2 gap-y-0">
                  <span className="text-[#787b86]">
                    O <span style={{ color: crosshairCandle.open >= 0 ? TV.bull : TV.bear }}>{formatOhlc(crosshairCandle.open)}</span>
                  </span>
                  <span className="text-[#787b86]">
                    H <span style={{ color: TV.bull }}>{formatOhlc(crosshairCandle.high)}</span>
                  </span>
                  <span className="text-[#787b86]">
                    L <span style={{ color: TV.bear }}>{formatOhlc(crosshairCandle.low)}</span>
                  </span>
                  <span className="text-[#787b86]">
                    C <span style={{ color: crosshairCandle.close >= 0 ? TV.bull : TV.bear }}>{formatOhlc(crosshairCandle.close)}</span>
                  </span>
                </div>
                {crosshairPeriodStats && (
                  <div className="mt-0.5 text-[9px] text-[#787b86]">
                    {crosshairPeriodStats.gamesPlayed} rounds · Vol {formatPriceDisplay(crosshairPeriodStats.totalVolume)}
                  </div>
                )}
              </div>
            )}

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
        <div
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t px-2 py-1 text-[10px] tabular-nums sm:gap-x-4 sm:px-3 sm:py-1.5"
          style={{ borderColor: TV.gridBold, background: "#1c2030", fontSize: layout.fonts.toolbar - 1 }}
        >
          <span className="text-[#787b86]">
            Net{" "}
            <span style={{ color: liveStats.userNet >= 0 ? TV.bull : TV.bear }}>
              {formatPriceDisplay(liveStats.userNet)}
            </span>
            <span className="text-[#434651]"> / </span>
            <span style={{ color: liveStats.houseNet >= 0 ? TV.bull : TV.bear }}>
              {formatPriceDisplay(liveStats.houseNet)}
            </span>
          </span>
          <span className="text-[#787b86]">
            Games <span className="text-[#d1d4dc]">{liveStats.games.toLocaleString()}</span>
          </span>
          <span className="hidden text-[#787b86] sm:inline">
            RTP <span className="text-[#d1d4dc]">{(liveStats.rtp * 100).toFixed(1)}%</span>
          </span>
          <span className="ml-auto text-[#787b86]">{liveStats.progressPct}%</span>
        </div>
      )}
    </div>
  );
}

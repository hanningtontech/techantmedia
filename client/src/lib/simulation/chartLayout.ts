/** Responsive chart chrome — TradingView-style layout from viewport size. */

export type ChartBreakpoint = "xs" | "sm" | "md" | "lg";

export function chartBreakpoint(width: number): ChartBreakpoint {
  if (width < 360) return "xs";
  if (width < 520) return "sm";
  if (width < 768) return "md";
  return "lg";
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartFontSizes {
  axis: number;
  status: number;
  toolbar: number;
  badge: number;
  hint: number;
}

export interface ChartLayout {
  breakpoint: ChartBreakpoint;
  pad: ChartPadding;
  fonts: ChartFontSizes;
  priceAxisWidth: number;
  minLabelGapPx: number;
  volumeRatio: number;
  toolbar: {
    compact: boolean;
    showHints: boolean;
    showLiveStats: boolean;
    showTimezone: boolean;
    showOhlcHighLow: boolean;
  };
  statusLineMaxWidth: number;
  zoomButtonSize: number;
}

const BASE_PRICE_AXIS = 56;

/** Estimate text width for SVG label collision checks (no canvas). */
export function estimateTextWidthPx(text: string, fontSize: number): number {
  return Math.max(fontSize * 2, text.length * fontSize * 0.58);
}

export function computeChartLayout(width: number, height: number, priceLabelMaxChars = 7): ChartLayout {
  const bp = chartBreakpoint(width);
  const compact = bp === "xs" || bp === "sm";
  const short = height < 220;

  const axisFont =
    bp === "xs" ? 8 : bp === "sm" ? 9 : bp === "md" ? 10 : 10;
  const priceAxisWidth = Math.max(
    BASE_PRICE_AXIS,
    estimateTextWidthPx("+9999.99", axisFont) + 14,
    estimateTextWidthPx("−".repeat(1) + "9".repeat(priceLabelMaxChars), axisFont) + 14,
  );

  const padTop = short ? (compact ? 22 : 26) : compact ? 26 : 28;
  const padBottom = bp === "xs" ? 26 : compact ? 22 : 24;
  const padLeft = bp === "xs" ? 4 : 8;

  return {
    breakpoint: bp,
    pad: {
      top: padTop,
      right: priceAxisWidth,
      bottom: padBottom,
      left: padLeft,
    },
    fonts: {
      axis: axisFont,
      status: bp === "xs" ? 9 : bp === "sm" ? 10 : 11,
      toolbar: bp === "xs" ? 10 : 11,
      badge: axisFont,
      hint: bp === "xs" ? 8 : 9,
    },
    priceAxisWidth,
    minLabelGapPx: bp === "xs" ? 10 : bp === "sm" ? 12 : 16,
    volumeRatio: short ? 0.12 : 0.14,
    toolbar: {
      compact,
      showHints: !compact && height >= 200,
      showLiveStats: bp !== "xs",
      showTimezone: bp === "lg",
      showOhlcHighLow: bp !== "xs" && !short,
    },
    statusLineMaxWidth: Math.max(120, width - priceAxisWidth - 24),
    zoomButtonSize: compact ? 28 : 24,
  };
}

/**
 * Grid presets are tuned to a portrait aspect ratio (cols × rows where rows ≈ 1.15–1.3 × cols).
 *
 * Why: on a phone the play area is taller than it is wide. If we fill the screen width with
 * `cols` columns, each square cell is `width / cols` tall, so the board height is
 * `rows × width / cols`. Choosing `rows / cols` close to the phone's (height / width) ratio
 * means the board fills the full width AND fits the height — no shrinking, no empty side
 * margins, and the action buttons stay on screen. Keeping the ratio on the low side (~1.2)
 * makes full-width fit on almost every phone. The same grids are used on desktop.
 */
export const PLAYER_GRID_PRESETS = [
  { id: "3x4", label: "3×4", cols: 3, rows: 4 },
  { id: "4x5", label: "4×5", cols: 4, rows: 5 },
  { id: "5x6", label: "5×6", cols: 5, rows: 6 },
  { id: "6x7", label: "6×7", cols: 6, rows: 7 },
  { id: "7x8", label: "7×8", cols: 7, rows: 8 },
  { id: "8x9", label: "8×9", cols: 8, rows: 9 },
  { id: "9x11", label: "9×11", cols: 9, rows: 11 },
  { id: "10x12", label: "10×12", cols: 10, rows: 12 },
  { id: "11x13", label: "11×13", cols: 11, rows: 13 },
] as const;

export type PlayerGridPresetId = (typeof PLAYER_GRID_PRESETS)[number]["id"];

/** All presets are phone-friendly now — none are excluded. */
export const PHONE_EXCLUDED_GRID_PRESET_IDS = new Set<PlayerGridPresetId>();

/** Old preset ids → nearest new preset (matched by total cell count). */
const LEGACY_GRID_PRESET_IDS: Record<string, PlayerGridPresetId> = {
  "3x3": "3x4",
  "4x4": "4x5",
  "5x5": "5x6",
  "6x6": "6x7",
  "6x8": "6x7",
  "6x10": "7x8",
  "7x7": "7x8",
  "7x9": "7x8",
  "6x12": "8x9",
  "8x8": "8x9",
  "9x9": "8x9",
  "8x12": "9x11",
  "10x10": "9x11",
};

export function getPlayerGridPresetsForPhone(_isPhone: boolean) {
  return [...PLAYER_GRID_PRESETS];
}

export function normalizeGridPresetForPhone(
  id: PlayerGridPresetId,
  _isPhone: boolean,
): PlayerGridPresetId {
  return id;
}

/** Same dimensions on phone and desktop — presets are already portrait-friendly. */
export function resolvePlayerGridDimensions(
  preset: Pick<(typeof PLAYER_GRID_PRESETS)[number], "id" | "rows" | "cols">,
  _isPhone: boolean,
): { rows: number; cols: number } {
  return { rows: preset.rows, cols: preset.cols };
}

export const DEFAULT_PLAYER_GRID_ID: PlayerGridPresetId = "5x6";

export const GRID_COLOR_THEMES = [
  { id: "violet", label: "Violet", swatch: "#8b5cf6" },
  { id: "emerald", label: "Emerald", swatch: "#10b981" },
  { id: "amber", label: "Amber", swatch: "#f59e0b" },
  { id: "cyan", label: "Cyan", swatch: "#06b6d4" },
  { id: "rose", label: "Rose", swatch: "#f43f5e" },
] as const;

export type GridColorThemeId = (typeof GRID_COLOR_THEMES)[number]["id"];

export const DEFAULT_GRID_COLOR_ID: GridColorThemeId = "violet";

export const GRID_STYLE_THEMES = [
  { id: "classic", label: "Classic", hint: "Glossy 3D tiles" },
  { id: "glass", label: "Glass", hint: "Frosted translucent" },
  { id: "neon", label: "Neon", hint: "Sharp glow edges" },
  { id: "matte", label: "Matte", hint: "Soft flat blocks" },
  { id: "gem", label: "Gem", hint: "Faceted jewel cut" },
] as const;

export type GridStyleThemeId = (typeof GRID_STYLE_THEMES)[number]["id"];

export const DEFAULT_GRID_STYLE_ID: GridStyleThemeId = "classic";

const PREFS_KEY = "block-game-grid-prefs-v1";

export interface GridAppearancePrefs {
  gridPresetId: PlayerGridPresetId;
  colorId: GridColorThemeId;
  styleId: GridStyleThemeId;
  /** Shake, explosion overlay, and staggered bomb reveal on loss. */
  bombAnimationsEnabled?: boolean;
}

export function loadGridAppearancePrefs(): GridAppearancePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultGridAppearancePrefs();
    const parsed = JSON.parse(raw) as Partial<GridAppearancePrefs>;
    const rawId = String(parsed.gridPresetId ?? "");
    const migratedId = LEGACY_GRID_PRESET_IDS[rawId] ?? rawId;
    const gridPresetId = PLAYER_GRID_PRESETS.some((p) => p.id === migratedId)
      ? (migratedId as PlayerGridPresetId)
      : DEFAULT_PLAYER_GRID_ID;
    const colorId = GRID_COLOR_THEMES.some((t) => t.id === parsed.colorId)
      ? (parsed.colorId as GridColorThemeId)
      : DEFAULT_GRID_COLOR_ID;
    const styleId = GRID_STYLE_THEMES.some((t) => t.id === parsed.styleId)
      ? (parsed.styleId as GridStyleThemeId)
      : DEFAULT_GRID_STYLE_ID;
    const bombAnimationsEnabled = parsed.bombAnimationsEnabled !== false;
    return { gridPresetId, colorId, styleId, bombAnimationsEnabled };
  } catch {
    return defaultGridAppearancePrefs();
  }
}

export function saveGridAppearancePrefs(prefs: GridAppearancePrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function defaultGridAppearancePrefs(): GridAppearancePrefs {
  return {
    gridPresetId: DEFAULT_PLAYER_GRID_ID,
    colorId: DEFAULT_GRID_COLOR_ID,
    styleId: DEFAULT_GRID_STYLE_ID,
    bombAnimationsEnabled: true,
  };
}

/** @deprecated Use computePlayerGridLayout for responsive boards. */
export function playerCellPixelSize(total: number): number {
  if (total <= 9) return 52;
  if (total <= 16) return 48;
  if (total <= 25) return 44;
  if (total <= 36) return 40;
  if (total <= 49) return 34;
  if (total <= 64) return 30;
  if (total <= 81) return 26;
  return 22;
}

export function playerCellGap(total: number): number {
  if (total > 64) return 3;
  if (total > 25) return 4;
  return 5;
}

const TRAY_PADDING_X_MOBILE = 8;
const TRAY_PADDING_X_DESKTOP = 40;
const TRAY_PADDING_Y = 28;
const GRID_HINT_HEIGHT = 36;
/** Absolute minimum cell size — may go below themed minCell to avoid horizontal clip on phones. */
const ABS_MIN_CELL_PX = 12;

export interface PlayerGridLayout {
  cellPx: number;
  gap: number;
  boardW: number;
  boardH: number;
  trayW: number;
}

/**
 * Sizes the board to fit available width and height — cells scale on every screen
 * so the full grid stays visible without scrolling or horizontal clip.
 */
export function computePlayerGridLayout(
  cols: number,
  rows: number,
  containerWidth: number,
  maxBoardHeight?: number,
  options?: {
    fillWidth?: boolean;
    fillRatio?: number;
    fillBox?: boolean;
    maxBoxW?: number;
    maxBoxH?: number;
  },
): PlayerGridLayout {
  const fillWidth = options?.fillWidth === true;
  const fillBox = options?.fillBox === true;
  const fillRatioOverride = options?.fillRatio;
  const total = cols * rows;
  const side = Math.max(cols, rows);
  const gap = playerCellGap(total);
  const isMobile = containerWidth < 640;

  /** Maximize square cells inside a measured column (short-laptop split layout). */
  if (fillBox) {
    const maxBoxW = options?.maxBoxW ?? Infinity;
    const maxBoxH = options?.maxBoxH ?? Infinity;
    const padX = 12;
    const padY = 10;
    const usableW = Math.min(Math.max(containerWidth - padX, 80), maxBoxW);
    const rawH =
      maxBoardHeight != null && maxBoardHeight > 0
        ? Math.max(maxBoardHeight - padY, 64)
        : usableW * (rows / cols);
    const usableH = Math.min(rawH, maxBoxH);
    const cellFromW = (usableW - (cols - 1) * gap) / cols;
    const cellFromH = (usableH - (rows - 1) * gap) / rows;
    let cellPx = Math.floor(Math.min(cellFromW, cellFromH));
    cellPx = Math.max(ABS_MIN_CELL_PX, cellPx);

    const boardW = cols * cellPx + (cols - 1) * gap;
    const boardH = rows * cellPx + (rows - 1) * gap;

    return {
      cellPx,
      gap,
      boardW,
      boardH,
      trayW: Math.min(containerWidth, boardW + padX),
    };
  }

  /**
   * Phone edge-to-edge: always fill the full screen width (square cells = width / cols).
   * Presets use a portrait ratio so the board also fits the height; on the rare device where
   * it's a little tall, the board area scrolls vertically while the action bar stays pinned —
   * we never shrink the board into empty side margins.
   */
  if (isMobile && fillWidth) {
    const maxBoardW = Math.max(containerWidth, 80);
    let cellPx = Math.max(ABS_MIN_CELL_PX, Math.floor((maxBoardW - (cols - 1) * gap) / cols));
    let boardW = cols * cellPx + (cols - 1) * gap;
    let boardH = rows * cellPx + (rows - 1) * gap;

    if (maxBoardHeight != null && maxBoardHeight > 0) {
      const usableH = Math.max(maxBoardHeight - GRID_HINT_HEIGHT - TRAY_PADDING_Y, 48);
      while (boardH > usableH && cellPx > ABS_MIN_CELL_PX) {
        cellPx -= 1;
        boardW = cols * cellPx + (cols - 1) * gap;
        boardH = rows * cellPx + (rows - 1) * gap;
      }
    }

    return { cellPx, gap, boardW, boardH, trayW: maxBoardW };
  }

  const trayPad = isMobile ? TRAY_PADDING_X_MOBILE : TRAY_PADDING_X_DESKTOP;
  const usable = Math.max(containerWidth - trayPad, 80);
  const maxBoardW = usable;

  const targetByGrid = 100 + side * 42;
  const fillRatio = fillRatioOverride ?? (isMobile
    ? 1
    : side <= 4
      ? 0.6
      : side <= 6
        ? 0.68
        : side <= 8
          ? 0.75
          : 0.8);
  const targetW = isMobile
    ? maxBoardW
    : Math.min(usable, Math.max(targetByGrid, usable * fillRatio));

  const minCell = isMobile
    ? rows > cols
      ? 18
      : side >= 10
        ? 20
        : side >= 8
          ? 22
          : side >= 6
            ? 24
            : 28
    : side >= 10
      ? 20
      : side >= 8
        ? 22
        : side >= 6
          ? 26
          : side >= 4
            ? 30
            : 34;
  const maxCell = isMobile
    ? rows > cols
      ? 48
      : side >= 10
        ? 44
        : side >= 8
          ? 48
          : side >= 6
            ? 52
            : 60
    : side >= 10
      ? 52
      : side >= 8
        ? 56
        : side >= 6
          ? 60
          : side >= 4
            ? 68
            : 76;

  let cellPx = (targetW - (cols - 1) * gap) / cols;

  if (maxBoardHeight != null && maxBoardHeight > 0) {
    const usableH = Math.max(maxBoardHeight - GRID_HINT_HEIGHT - TRAY_PADDING_Y, 64);
    const cellFromH = (usableH - (rows - 1) * gap) / rows;
    cellPx = Math.min(cellPx, cellFromH);
  }

  cellPx = Math.round(Math.min(maxCell, Math.max(minCell, cellPx)));

  let boardW = cols * cellPx + (cols - 1) * gap;
  if (boardW > maxBoardW) {
    cellPx = Math.floor((maxBoardW - (cols - 1) * gap) / cols);
    cellPx = Math.max(ABS_MIN_CELL_PX, cellPx);
    boardW = cols * cellPx + (cols - 1) * gap;
  }

  let boardH = rows * cellPx + (rows - 1) * gap;

  if (maxBoardHeight != null && maxBoardHeight > 0) {
    const usableH = Math.max(maxBoardHeight - GRID_HINT_HEIGHT - TRAY_PADDING_Y, 64);
    while (boardH > usableH && cellPx > ABS_MIN_CELL_PX) {
      cellPx -= 1;
      boardW = cols * cellPx + (cols - 1) * gap;
      boardH = rows * cellPx + (rows - 1) * gap;
    }
    if (boardW > maxBoardW) {
      cellPx = Math.max(
        ABS_MIN_CELL_PX,
        Math.floor((maxBoardW - (cols - 1) * gap) / cols),
      );
      boardW = cols * cellPx + (cols - 1) * gap;
      boardH = rows * cellPx + (rows - 1) * gap;
    }
  }

  if (isMobile) {
    cellPx = Math.max(ABS_MIN_CELL_PX, Math.floor((maxBoardW - (cols - 1) * gap) / cols));
    boardW = cols * cellPx + (cols - 1) * gap;
    boardH = rows * cellPx + (rows - 1) * gap;
    if (maxBoardHeight != null && maxBoardHeight > 0) {
      const usableH = Math.max(maxBoardHeight - GRID_HINT_HEIGHT - TRAY_PADDING_Y, 64);
      while (boardH > usableH && cellPx > ABS_MIN_CELL_PX) {
        cellPx -= 1;
        boardW = cols * cellPx + (cols - 1) * gap;
        boardH = rows * cellPx + (rows - 1) * gap;
      }
    }
  }

  return {
    cellPx,
    gap,
    boardW,
    boardH,
    trayW: isMobile ? containerWidth : Math.min(containerWidth, boardW + trayPad),
  };
}

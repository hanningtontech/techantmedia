/** Minimum sidebar width on desktop; column grows with flex-1 to the page edge. */
export const DESKTOP_SIDEBAR_MIN_PX = 280;

/** Compact split wallet column beside the grid. */
export const COMPACT_SIDEBAR_WIDTH = "clamp(18rem, 28vw, 28rem)";

/** @deprecated Desktop sidebar is flex-1; kept for compact split / legacy grid templates. */
export const GAME_SIDEBAR_WIDTH = "clamp(20rem, 32vw, 32rem)";

/** Tailwind width utility for compact split wallet column. */
export const COMPACT_SIDEBAR_WIDTH_CLASS = "w-[clamp(18rem,28vw,28rem)]";

/** Compact split uses full-width wallet above the grid at this width and up. */
export const COMPACT_TOP_WALLET_MIN_WIDTH = 1024;

/** Fixed gap between game board and wallet/session sidebar — always 10px. */
export const GAME_GRID_SIDEBAR_GAP_PX = 10;
export const GAME_GRID_SIDEBAR_GAP = `${GAME_GRID_SIDEBAR_GAP_PX}px`;

/** Pixel gap for layout tier math (constant 10px). */
export function resolveGameGridSidebarGapPx(_viewportWidth?: number): number {
  return GAME_GRID_SIDEBAR_GAP_PX;
}

/** Max play-column width for grid sizing (sidebar fills the rest to the page edge). */
export function resolveDesktopGridColumnPx(shellWidth: number): number {
  return Math.max(280, shellWidth - DESKTOP_SIDEBAR_MIN_PX - GAME_GRID_SIDEBAR_GAP_PX);
}

/** @deprecated Prefer flex row: grid shrink-0 + sidebar flex-1 + GAME_GRID_SIDEBAR_GAP. */
export const GAME_PLAY_GRID_COLUMNS = `minmax(0, 1fr) ${GAME_SIDEBAR_WIDTH}`;
export const COMPACT_PLAY_GRID_COLUMNS = `minmax(0, 1fr) ${COMPACT_SIDEBAR_WIDTH}`;

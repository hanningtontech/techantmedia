import { SHORT_VIEWPORT_MAX_HEIGHT, useGameViewportLayout } from "./useGameViewportLayout";

/** Short viewport side-by-side layout (grid left, compact wallet right) — no session table. */
export function useShortLaptopGameLayout() {
  return useGameViewportLayout().isCompactSplit;
}

/** Fixed slot for action buttons — tight under the board on compact-split layout. */
export const SHORT_LAPTOP_CONTROLS_SLOT_PX = 72;

/** Extra space between page header and play board (compact-split layout). */
export const SHORT_LAPTOP_PLAY_TOP_MARGIN_PX = 40;

/** Target play board footprint on compact-split layout (responsive cap). */
export const SHORT_LAPTOP_GRID_MAX_W = 550;
export const SHORT_LAPTOP_GRID_MAX_H = 615;

/** @deprecated Use SHORT_VIEWPORT_MAX_HEIGHT */
export const SHORT_LAPTOP_MAX_HEIGHT = SHORT_VIEWPORT_MAX_HEIGHT;

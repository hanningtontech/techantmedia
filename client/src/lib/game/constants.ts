import type { GameConfig } from "@/lib/simulation/types";

export {
  PLAYER_GRID_PRESETS,
  DEFAULT_PLAYER_GRID_ID,
  type PlayerGridPresetId,
  GRID_COLOR_THEMES,
  GRID_STYLE_THEMES,
  DEFAULT_GRID_COLOR_ID,
  DEFAULT_GRID_STYLE_ID,
  type GridColorThemeId,
  type GridStyleThemeId,
  loadGridAppearancePrefs,
  saveGridAppearancePrefs,
  playerCellPixelSize,
  playerCellGap,
  computePlayerGridLayout,
  type PlayerGridLayout,
  getPlayerGridPresetsForPhone,
  normalizeGridPresetForPhone,
  resolvePlayerGridDimensions,
  PHONE_EXCLUDED_GRID_PRESET_IDS,
} from "./gridThemes";

export const FREE_STARTING_BALANCE_KES = 10;
export const MIN_STAKE_KES = 5;
export const MAX_STAKE_KES = 9999;
export const BOMB_PCT_MIN = 0.3;
export const BOMB_PCT_MAX = 0.55;

export const DEFAULT_HOUSE_EDGE = 0.03;

/** Production game config — same multiplier math as simulation (linear + house edge). */
export function basePlayerGameConfig(
  rows: number,
  cols: number,
  bombs: number,
  stake: number,
  houseEdge = DEFAULT_HOUSE_EDGE,
): GameConfig {
  return {
    stake,
    rows,
    cols,
    bombs,
    houseEdge,
    simulationRounds: 5,
    multiplierMode: "linear",
    bonusFactor: 0.1,
    customFormula: "(1 - edge) / pWin",
  };
}

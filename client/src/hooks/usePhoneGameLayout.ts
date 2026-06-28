import { useGameViewportLayout } from "./useGameViewportLayout";

/** Phone / narrow-short viewport — full-screen stacked game UI, session in settings. */
export function usePhoneGameLayout() {
  return useGameViewportLayout().isPhone;
}

export { PHONE_MAX_WIDTH } from "./useGameViewportLayout";

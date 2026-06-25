import { isCountdownComplete, parseTargetDateTime } from "@/lib/livestream/countdown";
import type { LivestreamSettings } from "@/lib/livestream/livestreamTypes";

export type LivestreamDisplayMode = "countdown" | "video" | "idle";

export function resolveLivestreamDisplayMode(
  settings: LivestreamSettings,
  now: Date = new Date(),
): LivestreamDisplayMode {
  const target = parseTargetDateTime(settings.targetDateTime);
  const countdownComplete = target ? isCountdownComplete(target, now) : false;

  if (settings.videoEnabled || countdownComplete) return "video";
  if (settings.enabled && !countdownComplete) return "countdown";
  return "idle";
}

export function shouldShowLivestreamVideo(settings: LivestreamSettings, now: Date = new Date()): boolean {
  return resolveLivestreamDisplayMode(settings, now) === "video";
}

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

let wakeLock: WakeLockSentinelLike | null = null;

function hasWakeLockApi(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/** Request screen wake lock while auto-simulation feeds the live chart. */
export async function acquireChartSimWakeLock(): Promise<void> {
  if (!hasWakeLockApi() || document.visibilityState !== "visible" || wakeLock) return;
  try {
    wakeLock = await (
      navigator as Navigator & {
        wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

export async function releaseChartSimWakeLock(): Promise<void> {
  const lock = wakeLock;
  wakeLock = null;
  if (!lock) return;
  try {
    await lock.release();
  } catch {
    /* already released */
  }
}

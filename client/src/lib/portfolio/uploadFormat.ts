/** Human-readable file size (base 1024). */
export function formatUploadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  const digits = u === 0 ? 0 : n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(digits)} ${units[u]}`;
}

/** Short duration for upload ETA / elapsed (e.g. "12s", "1m 24s"). */
export function formatUploadDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min}m ${rem}s` : `${min}m`;
}

/** Estimated time remaining from bytes transferred so far. */
export function estimateUploadEtaMs(bytesLoaded: number, bytesTotal: number, elapsedMs: number): number | null {
  if (bytesLoaded <= 0 || bytesTotal <= bytesLoaded || elapsedMs < 400) return null;
  const rate = bytesLoaded / elapsedMs;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return (bytesTotal - bytesLoaded) / rate;
}

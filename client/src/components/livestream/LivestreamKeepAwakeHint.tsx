import { Monitor } from "lucide-react";
import { useLivestreamKeepAliveContext } from "@/contexts/LivestreamKeepAliveContext";

/** Shown until screen wake lock is granted (requires a tap on some browsers). */
export function LivestreamKeepAwakeHint() {
  const { wakeLockActive, wakeLockSupported, acquireWakeLock } = useLivestreamKeepAliveContext();

  if (!wakeLockSupported || wakeLockActive) return null;

  return (
    <button
      type="button"
      onClick={() => void acquireWakeLock()}
      className="pointer-events-auto fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2.5 text-xs font-semibold text-zinc-100 shadow-lg backdrop-blur-md transition hover:border-teal-400/40 hover:bg-black/75 sm:text-sm"
    >
      <Monitor className="h-4 w-4 text-teal-400" />
      Keep screen awake
    </button>
  );
}

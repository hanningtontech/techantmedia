import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_KEY = "livestream-session-active";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

function hasWakeLockApi(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/**
 * Keeps the livestream tab session alive until closed:
 * - Screen Wake Lock (prevents display sleep while tab is visible)
 * - sessionStorage marker (survives refresh, clears when tab closes)
 * - visibility/focus hooks for child components to resync timers & media
 */
export function useLivestreamKeepAlive() {
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSupported] = useState(hasWakeLockApi);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const resumeListenersRef = useRef(new Set<() => void>());

  const onResume = useCallback((listener: () => void) => {
    resumeListenersRef.current.add(listener);
    return () => {
      resumeListenersRef.current.delete(listener);
    };
  }, []);

  const notifyResume = useCallback(() => {
    for (const listener of resumeListenersRef.current) {
      listener();
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    setWakeLockActive(false);
    if (!lock) return;
    try {
      await lock.release();
    } catch {
      /* already released */
    }
  }, []);

  const acquireWakeLock = useCallback(async () => {
    if (!hasWakeLockApi() || document.visibilityState !== "visible") return false;
    if (wakeLockRef.current) return true;
    try {
      const lock = (await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock.request(
        "screen",
      )) as WakeLockSentinelLike;
      wakeLockRef.current = lock;
      setWakeLockActive(true);
      lock.addEventListener("release", () => {
        if (wakeLockRef.current === lock) {
          wakeLockRef.current = null;
          setWakeLockActive(false);
        }
      });
      return true;
    } catch {
      setWakeLockActive(false);
      return false;
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }

    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void acquireWakeLock();
        notifyResume();
      } else {
        void releaseWakeLock();
      }
    };

    void acquireWakeLock();
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    window.addEventListener("pageshow", handleVisible);

    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
      window.removeEventListener("pageshow", handleVisible);
      void releaseWakeLock();
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
    };
  }, [acquireWakeLock, notifyResume, releaseWakeLock]);

  return {
    wakeLockActive,
    wakeLockSupported,
    acquireWakeLock,
    onResume,
  };
}

export function isLivestreamSessionActive(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) != null;
  } catch {
    return false;
  }
}

import { useEffect, useRef, useState } from "react";
import type { SimChartTick } from "@/lib/simulation/timeChartHistory";

const TICK_MS = 110;
const FAST_TICK_MS = 48;
const CATCHUP_QUEUE = 24;
const LIVE_TAIL_REPLAY = 14;

export type ChartFeedSource = "sim" | "player" | "firestore" | "none";

/**
 * Replays new ticks gradually so remote Firestore viewers see candles grow like /simulation.
 * Local sim/player session feeds skip replay (already smooth).
 */
export function useChartTickReplay(
  sourceHistory: SimChartTick[],
  options: { live: boolean; source: ChartFeedSource },
): SimChartTick[] {
  const [displayed, setDisplayed] = useState<SimChartTick[]>([]);
  const queueRef = useRef<SimChartTick[]>([]);
  const consumedSourceLenRef = useRef(0);
  const seededRef = useRef(false);

  const preferInstant = options.live;

  useEffect(() => {
    if (!options.live || preferInstant) {
      setDisplayed(sourceHistory);
      consumedSourceLenRef.current = sourceHistory.length;
      queueRef.current = [];
      seededRef.current = true;
      return;
    }

    if (sourceHistory.length < consumedSourceLenRef.current) {
      setDisplayed(sourceHistory);
      consumedSourceLenRef.current = sourceHistory.length;
      queueRef.current = [];
      seededRef.current = false;
      return;
    }

    if (!seededRef.current && sourceHistory.length > 0) {
      const tail = Math.min(LIVE_TAIL_REPLAY, sourceHistory.length);
      const base = sourceHistory.slice(0, sourceHistory.length - tail);
      const replay = sourceHistory.slice(sourceHistory.length - tail);
      const lastT = sourceHistory[sourceHistory.length - 1]?.t ?? 0;
      const staleMs = Date.now() - lastT;
      if (staleMs > 90_000) {
        setDisplayed(sourceHistory);
        queueRef.current = [];
        consumedSourceLenRef.current = sourceHistory.length;
        seededRef.current = true;
        return;
      }
      setDisplayed(base);
      queueRef.current = [...replay];
      consumedSourceLenRef.current = sourceHistory.length;
      seededRef.current = true;
      return;
    }

    if (sourceHistory.length > consumedSourceLenRef.current) {
      const newTicks = sourceHistory.slice(consumedSourceLenRef.current);
      queueRef.current.push(...newTicks);
      consumedSourceLenRef.current = sourceHistory.length;
    }
  }, [options.live, preferInstant, sourceHistory]);

  useEffect(() => {
    if (!options.live || preferInstant) return;

    const id = window.setInterval(() => {
      const q = queueRef.current;
      if (q.length === 0) return;
      const batch = q.length > CATCHUP_QUEUE ? 5 : q.length > 12 ? 3 : q.length > 4 ? 2 : 1;
      const slice = q.splice(0, batch);
      setDisplayed((prev) => [...prev, ...slice]);
    }, queueRef.current.length > CATCHUP_QUEUE ? FAST_TICK_MS : TICK_MS);

    return () => window.clearInterval(id);
  }, [options.live, preferInstant]);

  return displayed;
}

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useOptionalLivestreamKeepAlive } from "@/contexts/LivestreamKeepAliveContext";
import {
  computeCountdown,
  isCountdownComplete,
  padCountdownValue,
  parseTargetDateTime,
} from "@/lib/livestream/countdown";
import { enabledCountdownUnits } from "@/lib/livestream/livestreamFirestore";
import {
  COUNTDOWN_UNIT_LABELS,
  type CountdownUnit,
  type LivestreamSettings,
} from "@/lib/livestream/livestreamTypes";

type Props = {
  settings: LivestreamSettings;
};

export function CountdownDisplay({ settings }: Props) {
  const [now, setNow] = useState(() => new Date());
  const target = useMemo(() => parseTargetDateTime(settings.targetDateTime), [settings.targetDateTime]);
  const units = useMemo(() => enabledCountdownUnits(settings.showUnits), [settings.showUnits]);

  const keepAlive = useOptionalLivestreamKeepAlive();

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 1000);
    const unsubResume = keepAlive?.onResume(tick);
    return () => {
      window.clearInterval(id);
      unsubResume?.();
    };
  }, [keepAlive]);

  if (!target) {
    return (
      <p className="text-center text-lg text-zinc-300">The countdown will appear once a target date is configured.</p>
    );
  }

  const complete = isCountdownComplete(target, now);
  const parts = complete ? {} : computeCountdown(target, now, settings.showUnits);

  if (!units.length) {
    return (
      <p className="text-center text-lg text-zinc-300">
        {complete ? "We're live!" : "Countdown is running — enable time units in admin to display them."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-stretch justify-center gap-2.5 sm:gap-3 md:gap-4 lg:gap-6">
      {units.map((unit: CountdownUnit, idx) => {
        const value = complete ? 0 : (parts[unit] ?? 0);
        const showPad = unit === "hours" || unit === "minutes" || unit === "seconds";
        const display = showPad ? padCountdownValue(value) : String(value);

        return (
          <motion.div
            key={unit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.4 }}
            className="flex min-w-[4rem] flex-col items-center rounded-xl border border-white/15 bg-black/35 px-3 py-3 backdrop-blur-md sm:min-w-[4.75rem] sm:rounded-2xl sm:px-4 sm:py-4 md:min-w-[5.5rem] md:px-5 md:py-5 lg:min-w-[6.5rem]"
          >
            <span
              className="font-bold tabular-nums tracking-tight text-white"
              style={{ fontSize: "clamp(1.5rem, 1.1rem + 2.5vw, 3rem)" }}
            >
              {display}
            </span>
            <span className="tm-eyebrow mt-1 text-orange-300/90">{COUNTDOWN_UNIT_LABELS[unit]}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

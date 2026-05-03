import { useEffect, useState } from "react";
import type { TutoringSession } from "@/lib/firestore/tutoringSessions";
import { getTutoringSessionCountdownEndMs } from "@/lib/firestore/tutoringSessions";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionCountdown({
  session,
  className,
  label = "Session time remaining",
}: {
  session: TutoringSession;
  className?: string;
  label?: string;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const endMs = getTutoringSessionCountdownEndMs(session);
  void tick;
  if (endMs == null) {
    return (
      <div className={cn("rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-muted-foreground", className)}>
        <p className="font-medium text-slate-700">{label}</p>
        <p className="mt-1">The instructor has not started the live timer yet.</p>
      </div>
    );
  }
  const left = endMs - Date.now();
  const done = left <= 0;
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        done ? "border-amber-200 bg-amber-50" : "border-violet-200 bg-violet-50",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", done ? "text-amber-900" : "text-violet-900")}>
        {done ? "Time’s up" : formatRemaining(left)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Planned length {session.durationMinutes} min · started from server clock
      </p>
    </div>
  );
}

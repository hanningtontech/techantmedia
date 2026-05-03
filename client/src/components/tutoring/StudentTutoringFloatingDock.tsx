import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import {
  getTutoringSessionCountdownEndMs,
  getTutoringSessionUnlockRequest,
  requestTutoringSessionUnlock,
  subscribeStudentPublishedTutoringSessions,
  type TutoringSession,
} from "@/lib/firestore/tutoringSessions";
import type { NursingTrack } from "@/lib/userTypes";
import { toast } from "sonner";
import { CalendarClock, ChevronDown, ChevronUp, GraduationCap, Lock, Timer } from "lucide-react";
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

export function StudentTutoringFloatingDock() {
  const [loc] = useLocation();
  const { profile, loading, firebaseReady } = useFirebaseAuth();
  const [open, setOpen] = useState(true);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [unlockPending, setUnlockPending] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);

  const onNclexStudent = loc.startsWith("/student/nclex");
  const isStudent = profile?.role === "student";

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!firebaseReady || !profile?.uid || !isStudent) {
      setSessions([]);
      return;
    }
    const track = (profile.nursingTrack ?? null) as NursingTrack | null;
    const unsub = subscribeStudentPublishedTutoringSessions(profile.uid, track, setSessions);
    return () => unsub();
  }, [firebaseReady, profile?.uid, profile?.nursingTrack, isStudent]);

  useEffect(() => {
    if (!profile?.uid || !sessions.length) {
      setUnlockPending({});
      return;
    }
    let cancelled = false;
    const locked = sessions.filter((s) => s.locked);
    if (!locked.length) {
      setUnlockPending({});
      return;
    }
    void (async () => {
      const next: Record<string, boolean> = {};
      await Promise.all(
        locked.map(async (s) => {
          const r = await getTutoringSessionUnlockRequest(s.id, profile.uid);
          next[s.id] = r?.status === "pending";
        }),
      );
      if (!cancelled) setUnlockPending(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessions, profile?.uid]);

  const now = Date.now();
  void tick;

  const { activeTimers, upcoming, lockedList } = useMemo(() => {
    const activeTimers: TutoringSession[] = [];
    const upcoming: TutoringSession[] = [];
    const lockedList: TutoringSession[] = [];
    for (const s of sessions) {
      if (s.locked) lockedList.push(s);
      const end = getTutoringSessionCountdownEndMs(s);
      if (s.timerStartedAt && end != null && end > now) activeTimers.push(s);
      const sched = s.scheduledAt?.toMillis?.() ?? null;
      if (sched != null && sched > now) upcoming.push(s);
    }
    upcoming.sort((a, b) => (a.scheduledAt!.toMillis() ?? 0) - (b.scheduledAt!.toMillis() ?? 0));
    activeTimers.sort((a, b) => (getTutoringSessionCountdownEndMs(a) ?? 0) - (getTutoringSessionCountdownEndMs(b) ?? 0));
    return { activeTimers, upcoming, lockedList };
  }, [sessions, now]);

  const hasSignal = activeTimers.length > 0 || upcoming.length > 0 || lockedList.length > 0;

  if (loading || !firebaseReady || !isStudent || !onNclexStudent) return null;
  if (!hasSignal) return null;

  const requestUnlock = async (sessionId: string) => {
    if (!profile?.uid) return;
    try {
      await requestTutoringSessionUnlock(sessionId, profile.uid);
      setUnlockPending((prev) => ({ ...prev, [sessionId]: true }));
      toast.success("Unlock request sent to your instructor.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send request");
    }
  };

  return (
    <div
      className={cn(
        "fixed z-[90] max-w-sm transition-all duration-200",
        "bottom-4 right-4 max-[480px]:left-4 max-[480px]:right-4 max-[480px]:max-w-none",
      )}
    >
      <div className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-xl shadow-violet-900/10">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 bg-gradient-to-r from-violet-600 to-violet-700 px-3 py-2.5 text-left text-white"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 shrink-0" />
            Tutoring sessions
            {activeTimers.length ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">Live</span>
            ) : null}
          </span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0 opacity-90" /> : <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />}
        </button>
        {open ? (
          <div className="max-h-[min(70vh,420px)] space-y-4 overflow-y-auto p-3 text-sm">
            {activeTimers.length > 0 ? (
              <section>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-800">
                  <Timer className="h-3.5 w-3.5" />
                  Session in progress
                </p>
                <ul className="space-y-2">
                  {activeTimers.map((s) => {
                    const end = getTutoringSessionCountdownEndMs(s) ?? 0;
                    const left = end - Date.now();
                    return (
                      <li key={s.id} className="rounded-lg border border-violet-100 bg-violet-50/80 p-2.5">
                        <p className="font-medium text-slate-900">{s.title}</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-violet-900 tabular-nums">
                          {formatRemaining(left)}
                        </p>
                        <Button size="sm" className="mt-2 h-8 w-full bg-violet-600 hover:bg-violet-700" asChild>
                          <Link href={`/student/nclex/tutoring/${s.id}`}>Open session</Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {upcoming.length > 0 ? (
              <section>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Upcoming
                </p>
                <ul className="space-y-2">
                  {upcoming.map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                      <p className="font-medium text-slate-900">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.scheduledAt?.toDate?.()?.toLocaleString?.() ?? "Scheduled"}
                      </p>
                      <Button size="sm" variant="outline" className="mt-2 h-8 w-full" asChild>
                        <Link href={`/student/nclex/tutoring/${s.id}`}>View</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {lockedList.length > 0 ? (
              <section>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  <Lock className="h-3.5 w-3.5" />
                  Locked — ask admin
                </p>
                <ul className="space-y-2">
                  {lockedList.map((s) => {
                    const pending = unlockPending[s.id];
                    return (
                      <li key={s.id} className="rounded-lg border border-amber-200 bg-amber-50/90 p-2.5">
                        <p className="font-medium text-slate-900">{s.title}</p>
                        <p className="text-xs text-amber-900/90">
                          Editing is frozen. Request an admin to unlock this session if you need changes or materials updated.
                        </p>
                        <div className="mt-2 flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            disabled={pending}
                            onClick={() => void requestUnlock(s.id)}
                          >
                            {pending ? "Request sent" : "Request admin unlock"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" asChild>
                            <Link href={`/student/nclex/tutoring/${s.id}`}>Open read-only</Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

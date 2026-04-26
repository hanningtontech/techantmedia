import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import {
  areQuizResultsReleasedToStudent,
  canViewInProgressSectionResults,
  countQuizQuestionPool,
  hasPendingSectionScoreRequest,
  createQuizSession,
  createRatSessionFromHistory,
  getStudentQuizzes,
  getRatStats,
  listAssignedQuizTemplates,
  summarizeStudentProgress,
} from "@/lib/firestore/nclex";
import type { QuizSession, QuizTemplate, RatStats } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, BookOpen, Clock, Play } from "lucide-react";

const DASH_CACHE = new Map<
  string,
  {
    at: number;
    sessions: QuizSession[];
    templates: QuizTemplate[];
    templatePools: Record<string, number>;
  }
>();
const DASH_CACHE_TTL_MS = 2 * 60 * 1000;

function tsMillis(ts: any): number {
  return (ts?.toMillis?.() as number | undefined) ?? 0;
}

export default function StudentNCLEXDashboard() {
  useRedirectStudentIfPending();
  const [, navigate] = useLocation();
  const { firebaseReady, loading, profile, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } =
    useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [starting, setStarting] = useState(false);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [templatePools, setTemplatePools] = useState<Record<string, number>>({});
  const [ratStats, setRatStats] = useState<RatStats | null>(null);
  const [ratBusy, setRatBusy] = useState(false);
  const [ratSize, setRatSize] = useState<5 | 10 | 15 | 20>(10);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [dashReady, setDashReady] = useState(false);

  useEffect(() => {
    if (!profile || !firebaseReady) {
      setDashReady(false);
      return;
    }
    let cancelled = false;
    const cacheKey = profile.uid;
    const cached = DASH_CACHE.get(cacheKey) ?? null;
    const isFresh = cached ? Date.now() - cached.at <= DASH_CACHE_TTL_MS : false;
    if (cached && isFresh) {
      setSessions(cached.sessions);
      setTemplates(cached.templates);
      setTemplatePools(cached.templatePools);
      setLoadErr(null);
      setDashReady(true);
    } else {
      setDashReady(false);
    }
    const run = async () => {
      try {
        const [sess, tmpl, rs] = await Promise.all([
          getStudentQuizzes(profile.uid),
          listAssignedQuizTemplates(profile.uid),
          getRatStats(profile.uid),
        ]);
        if (!cancelled) {
          setSessions(sess);
          setTemplates(tmpl);
          setRatStats(rs);
          setLoadErr(null);
        }
        const pools = await Promise.all(
          tmpl.map(async (t) => {
            const n = await countQuizQuestionPool(t.filterCategory, t.questionLimit > 0 ? t.questionLimit : null);
            return [t.id, n] as const;
          }),
        );
        if (!cancelled) setTemplatePools(Object.fromEntries(pools));
        if (!cancelled) {
          DASH_CACHE.set(cacheKey, {
            at: Date.now(),
            sessions: sess,
            templates: tmpl,
            templatePools: Object.fromEntries(pools),
          });
        }
      } catch (e) {
        if (!cancelled) setLoadErr(formatAuthOrFirestoreError(e));
      } finally {
        if (!cancelled) setDashReady(true);
      }
    };
    // If we restored from cache, keep UI ready and refresh in background only when stale.
    if (!isFresh) void run();
    return () => {
      cancelled = true;
    };
  }, [profile, firebaseReady]);

  // Refresh when user returns to the tab after TTL.
  useEffect(() => {
    if (!profile || !firebaseReady) return;
    const cacheKey = profile.uid;
    const onFocus = () => {
      const cached = DASH_CACHE.get(cacheKey) ?? null;
      const isFresh = cached ? Date.now() - cached.at <= DASH_CACHE_TTL_MS : false;
      if (isFresh) return;
      void (async () => {
        try {
          const [sess, tmpl, rs] = await Promise.all([
            getStudentQuizzes(profile.uid),
            listAssignedQuizTemplates(profile.uid),
            getRatStats(profile.uid),
          ]);
          setSessions(sess);
          setTemplates(tmpl);
          setRatStats(rs);
          setLoadErr(null);
          const pools = await Promise.all(
            tmpl.map(async (t) => {
              const n = await countQuizQuestionPool(t.filterCategory, t.questionLimit > 0 ? t.questionLimit : null);
              return [t.id, n] as const;
            }),
          );
          setTemplatePools(Object.fromEntries(pools));
          DASH_CACHE.set(cacheKey, {
            at: Date.now(),
            sessions: sess,
            templates: tmpl,
            templatePools: Object.fromEntries(pools),
          });
        } catch {
          // ignore: keep last cached view
        }
      })();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [profile, firebaseReady]);

  const progress = useMemo(() => summarizeStudentProgress(sessions), [sessions]);

  const ratCooldown = useMemo(() => {
    const last = ratStats?.lastRatStartedAtMs ?? 0;
    if (!last) return { canStart: true, remainingMs: 0 };
    const elapsed = Date.now() - last;
    const remainingMs = Math.max(0, 24 * 60 * 60 * 1000 - elapsed);
    return { canStart: remainingMs <= 0, remainingMs };
  }, [ratStats?.lastRatStartedAtMs]);

  const ratMean = ratStats?.meanScore ?? 0;
  const ratCount = ratStats?.count ?? 0;

  const startRat = async () => {
    if (!profile) return;
    setRatBusy(true);
    try {
      const id = await createRatSessionFromHistory({
        studentId: profile.uid,
        studentName: profile.name ?? profile.email ?? "Student",
        questionCount: ratSize,
      });
      toast.success("Random assessment started.");
      navigate(`/student/nclex/rat/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start random assessment");
    } finally {
      setRatBusy(false);
    }
  };

  const formatCooldown = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
  };

  const startFromTemplate = (t: QuizTemplate) => {
    const lim = t.questionLimit > 0 ? t.questionLimit : null;
    if (!profile) return;
    setStarting(true);
    void createQuizSession(profile.uid, profile.name ?? profile.email ?? "Student", "", {
      templateId: t.id,
      filterCategory: t.filterCategory,
      quizTitle: t.title,
      questionLimit: lim,
    })
      .then((sid) => navigate(`/student/nclex/quiz/${sid}`))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not start quiz"))
      .finally(() => setStarting(false));
  };

  const sessionsByTemplate = useMemo(() => {
    const m = new Map<string, QuizSession[]>();
    for (const s of sessions) {
      const tid = s.templateId?.trim();
      if (!tid) continue;
      const arr = m.get(tid) ?? [];
      arr.push(s);
      m.set(tid, arr);
    }
    for (const [k, arr] of Array.from(m.entries())) {
      arr.sort((a: QuizSession, b: QuizSession) => {
        const ta = (a.startedAt as any)?.toMillis?.() ?? 0;
        const tb = (b.startedAt as any)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      m.set(k, arr);
    }
    return m;
  }, [sessions]);

  if (!firebaseReady) {
    return (
      <div className="nclex-app nclex-shell">
        <div className="nclex-main-narrow py-16">
          <Card className="nclex-card">
            <CardHeader>
              <CardTitle>NCLEX unavailable</CardTitle>
              <CardDescription>Configure Firebase environment variables first.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="nclex-app nclex-shell min-h-screen">
      <NclexHeader
        title="NCLEX Practice Platform"
        subtitle={profile ? "Your learning dashboard" : "Sign in to continue"}
        homeHref="/"
        homeLabel="Portfolio"
      />

      <main className="nclex-main mx-auto max-w-6xl space-y-6 sm:space-y-8 xl:max-w-7xl 2xl:max-w-[90rem]">
        <div className="flex items-start gap-2 sm:gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md sm:h-14 sm:w-14"
            style={{ background: "linear-gradient(135deg, var(--nclex-primary), #2563eb)" }}
          >
            <BookOpen className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance">{profile ? `Welcome, ${profile.name ?? profile.email}!` : "NCLEX practice"}</h1>
            <p className="mt-1 text-pretty text-sm leading-relaxed nclex-text-muted sm:text-base">
              Practice questions, explanations, and progress in one place.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 rounded-[var(--nclex-radius-card)] border border-[var(--nclex-border)] bg-white/70 p-4 sm:p-6">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : profile ? (
          <>
            {loadErr ? <p className="text-sm text-red-600">{loadErr}</p> : null}

            {!dashReady ? (
              <div className="space-y-4 rounded-[var(--nclex-radius-card)] border border-[var(--nclex-border)] bg-white/70 p-4 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                  </span>
                  Loading your quizzes and scores…
                </div>
                <Skeleton className="h-28 w-full rounded-lg" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                </div>
              </div>
            ) : null}

            {dashReady ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <Card className="nclex-card h-full overflow-hidden shadow-md">
                    <CardHeader className="border-b border-[var(--nclex-border)] bg-gradient-to-r from-white to-blue-50/80 pb-4">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg" style={{ color: "var(--nclex-primary)" }}>
                        <BarChart3 className="h-5 w-5 shrink-0" />
                        Your progress
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Based on quizzes your tutor has released to you</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5 pt-5 sm:grid-cols-3 sm:gap-6">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide nclex-text-muted">Total quizzes</p>
                        <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{progress.totalQuizzes}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide nclex-text-muted">Average score</p>
                        <p
                          className="mt-1 text-xl font-bold tabular-nums sm:text-2xl"
                          style={{ color: "var(--nclex-success)" }}
                        >
                          {progress.totalQuizzes ? `${progress.averageScore}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide nclex-text-muted">Last quiz</p>
                        <p className="mt-1 text-base font-semibold sm:text-lg">{progress.lastAttemptLabel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <Card className="nclex-card h-full overflow-hidden shadow-md">
                  <CardHeader className="border-b border-[var(--nclex-border)] bg-gradient-to-r from-white to-slate-50 pb-4">
                    <CardTitle className="text-base sm:text-lg" style={{ color: "var(--nclex-primary)" }}>
                      Random Assessment Test
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Once every 24 hours. 1 minute per question. Score is shown immediately.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-5 sm:grid-cols-3 sm:items-center">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide nclex-text-muted">RATs done</p>
                      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{ratCount}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide nclex-text-muted">Mean score</p>
                      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl" style={{ color: "var(--nclex-success)" }}>
                        {ratCount ? `${ratMean}%` : "—"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-xs font-medium nclex-text-muted">Questions:</span>
                        {[5, 10, 15, 20].map((n) => (
                          <Button
                            key={n}
                            type="button"
                            size="sm"
                            variant={ratSize === n ? "default" : "outline"}
                            onClick={() => setRatSize(n as 5 | 10 | 15 | 20)}
                            disabled={ratBusy}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                      {ratCount > 0 ? (
                        <div className="space-y-2">
                          <Button className="nclex-btn-primary w-full" type="button" onClick={() => navigate("/student/nclex/rat-history")}>
                            View history
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button className="w-full" variant="outline" disabled={ratBusy || !ratCooldown.canStart}>
                                {ratCooldown.canStart ? "Start new RAT" : `Next RAT in ${formatCooldown(ratCooldown.remainingMs)}`}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Start random assessment?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You’ll have <span className="font-semibold">{ratSize} minutes</span> total ({ratSize} questions × 1 minute).
                                  No rationales will be shown. After you submit, you’ll see your score immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={ratBusy}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void startRat()} disabled={ratBusy}>
                                  Start
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button className="nclex-btn-primary w-full" disabled={ratBusy || !ratCooldown.canStart}>
                              {ratCooldown.canStart ? "Generate random test" : `Available in ${formatCooldown(ratCooldown.remainingMs)}`}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Start random assessment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                You’ll have <span className="font-semibold">{ratSize} minutes</span> total ({ratSize} questions × 1 minute).
                                No rationales will be shown. After you submit, you’ll see your score immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={ratBusy}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void startRat()} disabled={ratBusy}>
                                Start
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
                </motion.div>
              </div>
            ) : null}

            {dashReady && templates.length > 0 ? (
              <section>
                <h2 className="mb-2 text-base font-bold sm:text-lg">Your quizzes</h2>
                <p className="mb-4 text-pretty text-sm leading-relaxed nclex-text-muted sm:text-base">
                  Quizzes assigned to you by your tutor. Completed quizzes show as done; you can redo to create a new attempt (history is kept).
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                  {templates.map((t) => {
                    const pool = templatePools[t.id] ?? 0;
                    const minutes =
                      t.estimatedMinutes != null && t.estimatedMinutes > 0
                        ? t.estimatedMinutes
                        : Math.max(1, Math.ceil(pool * 1.2));
                    const templateSessions = sessionsByTemplate.get(t.id) ?? [];
                    const inProgress = templateSessions.find((s) => s.status === "in_progress") ?? null;
                    const latest = templateSessions[0] ?? null;
                    const latestAttemptAt = latest ? tsMillis(latest.submittedAt ?? latest.startedAt) : 0;
                    const templateUpdatedAt = tsMillis(t.updatedAt);
                    const templateLim = Number(t.questionLimit ?? 0);
                    const latestLim = Number(latest?.questionLimit ?? 0);
                    const limDelta = templateLim > 0 && latestLim > 0 ? Math.max(0, templateLim - latestLim) : 0;
                    const isUpdated = Boolean(latest && ((templateUpdatedAt > 0 && templateUpdatedAt > latestAttemptAt) || limDelta > 0));

                    const done = Boolean(
                      latest && (latest.status === "submitted" || latest.status === "reviewed") && areQuizResultsReleasedToStudent(latest),
                    );
                    const releasedAttempts = templateSessions.filter(
                      (s) =>
                        (s.status === "submitted" || s.status === "reviewed") &&
                        areQuizResultsReleasedToStudent(s) &&
                        (s.totalQuestions ?? 0) > 0,
                    );
                    const firstReleased =
                      [...releasedAttempts].sort((a, b) => tsMillis(a.startedAt ?? a.submittedAt) - tsMillis(b.startedAt ?? b.submittedAt))[0] ??
                      null;
                    const secondReleased =
                      [...releasedAttempts].sort((a, b) => tsMillis(a.startedAt ?? a.submittedAt) - tsMillis(b.startedAt ?? b.submittedAt))[1] ??
                      null;

                    const scorePct = firstReleased ? Math.round(Number(firstReleased.percentageScore) || 0) : null;
                    const outcome = firstReleased?.adminOutcome ?? null;
                    const outcomeNote = (firstReleased?.adminOutcomeNote ?? "").trim();
                    const outcomeStyle =
                      outcome === "fail"
                        ? "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                        : outcome === "borderline"
                          ? "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                          : outcome === "pass"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
                    return (
                      <motion.div key={t.id} whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
                        <Card className="nclex-card nclex-card-interactive h-full">
                          <CardHeader className="space-y-1 pb-3 sm:pb-4">
                            <CardTitle className="flex flex-wrap items-center gap-2 text-balance text-base leading-snug sm:text-lg">
                              <span className="min-w-0">{t.title}</span>
                              {isUpdated ? (
                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
                                  Updated{limDelta > 0 ? ` · +${limDelta}` : ""}
                                </span>
                              ) : null}
                            </CardTitle>
                            <CardDescription className="text-xs leading-relaxed sm:text-sm">
                              {t.description ? <span className="mb-2 block text-gray-600">{t.description}</span> : null}
                              <span className="flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0" />
                                {pool} questions · ~{minutes} min
                              </span>
                              {scorePct != null ? (
                                <span className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center rounded-md border bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-900">
                                    {scorePct}%
                                  </span>
                                  {outcome ? (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button
                                          type="button"
                                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${outcomeStyle}`}
                                        >
                                          {outcome.toUpperCase()}
                                        </button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{outcome.toUpperCase()}</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {outcomeNote ? outcomeNote : "No note was added for this outcome."}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Close</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => {
                                              if (firstReleased) navigate(`/student/nclex/results/${firstReleased.id}`);
                                            }}
                                          >
                                            View results
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  ) : null}
                                </span>
                              ) : done ? (
                                <span className="mt-2 block text-xs font-medium text-emerald-700">Done (score released)</span>
                              ) : inProgress ? (
                                <span className="mt-2 block text-xs font-medium text-amber-800">In progress</span>
                              ) : null}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {inProgress ? (
                              <>
                                <Button
                                  className="nclex-btn-primary w-full"
                                  disabled={starting || pool === 0}
                                  onClick={() => navigate(`/student/nclex/quiz/${inProgress.id}`)}
                                >
                                  <Play className="mr-2 h-4 w-4" />
                                  Continue
                                </Button>
                                {canViewInProgressSectionResults(inProgress) ? (
                                  <Button
                                    className="mt-2 w-full"
                                    variant="outline"
                                    disabled={starting}
                                    onClick={() => navigate(`/student/nclex/results/${inProgress.id}`)}
                                  >
                                    View section results
                                  </Button>
                                ) : hasPendingSectionScoreRequest(inProgress) ? (
                                  <Button
                                    className="mt-2 w-full"
                                    variant="outline"
                                    disabled={starting}
                                    onClick={() => navigate(`/student/nclex/results/${inProgress.id}`)}
                                  >
                                    Section results pending — open status page
                                  </Button>
                                ) : null}
                              </>
                            ) : (
                              <Button
                                className="nclex-btn-primary w-full"
                                disabled={starting || pool === 0 || releasedAttempts.length >= 2}
                                onClick={() => void startFromTemplate(t)}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                {releasedAttempts.length >= 2
                                  ? "Max attempts reached"
                                  : isUpdated
                                    ? "Attempt additional questions"
                                    : done
                                      ? "Redo quiz"
                                      : "Start quiz"}
                              </Button>
                            )}
                            {firstReleased ? (
                              <Button
                                className="mt-2 w-full"
                                variant="outline"
                                onClick={() => navigate(`/student/nclex/results/${firstReleased.id}`)}
                              >
                                View first score
                              </Button>
                            ) : null}
                            {secondReleased ? (
                              <Button
                                className="mt-2 w-full"
                                variant="outline"
                                onClick={() => navigate(`/student/nclex/results/${secondReleased.id}`)}
                              >
                                View reattempt score
                              </Button>
                            ) : null}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Practice-by-topic is intentionally not shown: students should only access quizzes wired to them. */}

            {dashReady ? (
            <section>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-bold sm:text-lg">Previous attempts</h2>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/student/nclex/history">Full history</Link>
                </Button>
              </div>
              <Card className="nclex-card overflow-hidden shadow-md">
                {/* Mobile: stacked cards (no horizontal scroll). Desktop: table. */}
                <div className="space-y-2 p-3 sm:hidden">
                  {sessions.filter((s) => s.status === "submitted" || s.status === "reviewed").length === 0 ? (
                    <p className="py-6 text-center text-sm nclex-text-muted">No submitted attempts yet.</p>
                  ) : (
                    sessions
                      .filter((s) => s.status === "submitted" || s.status === "reviewed")
                      .slice(0, 8)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="rounded-lg border border-[var(--nclex-border)] bg-white/80 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{s.quizTitle ?? "Quiz"}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {s.totalQuestions && areQuizResultsReleasedToStudent(s)
                                  ? `Score: ${s.percentageScore}%`
                                  : s.totalQuestions
                                    ? "Score: Pending release"
                                    : "Score: —"}
                              </div>
                            </div>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                backgroundColor: areQuizResultsReleasedToStudent(s)
                                  ? s.status === "reviewed"
                                    ? "rgba(16,185,129,0.12)"
                                    : "rgba(16,185,129,0.1)"
                                  : "rgba(245,158,11,0.15)",
                                color: areQuizResultsReleasedToStudent(s)
                                  ? "var(--nclex-success)"
                                  : "var(--nclex-warning)",
                              }}
                            >
                              {!areQuizResultsReleasedToStudent(s)
                                ? "Awaiting tutor"
                                : s.status === "reviewed"
                                  ? "Reviewed"
                                  : "Released"}
                            </span>
                          </div>
                          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                            <Link href={`/student/nclex/results/${s.id}`}>Review</Link>
                          </Button>
                        </div>
                      ))
                  )}
                </div>

                <div className="hidden overflow-x-auto rounded-[var(--nclex-radius-card)] sm:block">
                  <table className="w-full min-w-[520px] text-left text-xs sm:text-sm">
                    <thead className="border-b border-[var(--nclex-border)] bg-white">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Quiz</th>
                        <th className="px-4 py-3 font-semibold">Score</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions
                        .filter((s) => s.status === "submitted" || s.status === "reviewed")
                        .slice(0, 8)
                        .map((s) => (
                          <tr key={s.id} className="border-b border-[var(--nclex-border)] bg-white/80">
                            <td className="px-4 py-3">{s.quizTitle ?? "Quiz"}</td>
                            <td className="px-4 py-3 tabular-nums font-medium">
                              {s.totalQuestions && areQuizResultsReleasedToStudent(s)
                                ? `${s.percentageScore}%`
                                : s.totalQuestions
                                  ? "Pending release"
                                  : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: areQuizResultsReleasedToStudent(s)
                                    ? s.status === "reviewed"
                                      ? "rgba(16,185,129,0.12)"
                                      : "rgba(16,185,129,0.1)"
                                    : "rgba(245,158,11,0.15)",
                                  color: areQuizResultsReleasedToStudent(s)
                                    ? "var(--nclex-success)"
                                    : "var(--nclex-warning)",
                                }}
                              >
                                {!areQuizResultsReleasedToStudent(s)
                                  ? "Awaiting tutor"
                                  : s.status === "reviewed"
                                    ? "Reviewed"
                                    : "Released"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Button asChild variant="link" className="h-auto p-0 text-[var(--nclex-primary)]">
                                <Link href={`/student/nclex/results/${s.id}`}>Review</Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {sessions.filter((s) => s.status === "submitted" || s.status === "reviewed").length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm nclex-text-muted">No submitted attempts yet.</p>
                  ) : null}
                </div>
              </Card>
            </section>
            ) : null}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <Card className="nclex-card mx-auto max-w-md shadow-md">
            <CardHeader>
              <CardTitle>{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
              <CardDescription>Use Google or email. Tutor role is set in Firestore.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void signInWithGoogle().catch((e) => toast.error(formatAuthOrFirestoreError(e)))}
              >
                Continue with Google
              </Button>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  className="rounded-[var(--nclex-radius-input)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  className="rounded-[var(--nclex-radius-input)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {mode === "signup" ? (
                <div className="grid gap-2">
                  <Label>Display name</Label>
                  <Input className="rounded-[var(--nclex-radius-input)]" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              ) : null}
              <Button
                className="nclex-btn-primary w-full"
                type="button"
                onClick={() => {
                  const fn =
                    mode === "signin"
                      ? () => signInWithEmail(email, password)
                      : () => signUpWithEmail(email, password, name || email.split("@")[0] || "Student");
                  void fn().catch((e) => toast.error(formatAuthOrFirestoreError(e)));
                }}
              >
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

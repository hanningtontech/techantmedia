import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { QuestionCard } from "@/components/nclex/QuestionCard";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import {
  canViewInProgressSectionResults,
  ensureQuizQuestionIds,
  getQuizSession,
  getQuizTemplateById,
  hasPendingSectionScoreRequest,
  listStudentQuizQuestions,
  resolveQuizTemplateQuestions,
  toStudentQuestion,
  QUIZ_CHUNK_SIZE,
  requestSectionScore,
  responseSelectedIds,
  submitQuizChunk,
  submitQuizSession,
} from "@/lib/firestore/nclex";
import type { QuizResponseItem, QuizSession, StudentQuestion } from "@/lib/firestore/nclexTypes";
import {
  clearQuizDraftCache,
  placeholderSessionFromCache,
  QUIZ_DRAFT_CACHE_VERSION,
  readQuizDraftCache,
  writeQuizDraftCache,
  type QuizDraftSnapshot,
} from "@/lib/nclex/quizDraftCache";
import { STUDENT_NCLEX_DASHBOARD } from "@/lib/nclex/studentNclexRoutes";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

const EXPL_MAX = 500;

type Draft = { selectedAnswerIds: string[]; studentExplanation: string };

function mergeCachedIntoQuestionList(
  qs: StudentQuestion[],
  cached: QuizDraftSnapshot | null,
): { answers: Record<string, Draft>; idx: number } {
  const idSet = new Set(qs.map((q) => q.id));
  const merged: Record<string, Draft> = {};
  if (cached) {
    for (const [k, v] of Object.entries(cached.answers)) {
      if (!idSet.has(k)) continue;
      const expl =
        typeof v.studentExplanation === "string" ? v.studentExplanation.slice(0, EXPL_MAX) : "";
      const ids = Array.from(new Set((v.selectedAnswerIds ?? []).map((x) => String(x).toLowerCase().trim()))).filter(
        Boolean,
      );
      merged[k] = { selectedAnswerIds: ids, studentExplanation: expl };
    }
  }
  let nextIdx = cached && Number.isFinite(cached.idx) ? Math.floor(cached.idx) : 0;
  if (qs.length) nextIdx = Math.max(0, Math.min(nextIdx, qs.length - 1));
  else nextIdx = 0;
  return { answers: merged, idx: nextIdx };
}

function orderQuestionsByIds(qs: StudentQuestion[], ids: string[]): StudentQuestion[] {
  const byId = new Map(qs.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is StudentQuestion => Boolean(q));
}

function draftsFromServerResponses(responses: QuizResponseItem[]): Record<string, Draft> {
  const out: Record<string, Draft> = {};
  for (const r of responses) {
    if (!r?.questionId) continue;
    const ids = responseSelectedIds(r)
      .map((x) => String(x).toLowerCase().trim())
      .filter(Boolean);
    const expl =
      typeof r.studentExplanation === "string" ? r.studentExplanation.slice(0, EXPL_MAX) : "";
    out[String(r.questionId)] = { selectedAnswerIds: Array.from(new Set(ids)), studentExplanation: expl };
  }
  return out;
}

export default function StudentQuizFirestore() {
  useRedirectStudentIfPending();
  const { sessionId } = useParams() as { sessionId: string };
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [sessionMeta, setSessionMeta] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resumeFromCache, setResumeFromCache] = useState(false);
  const [postSectionOpen, setPostSectionOpen] = useState(false);
  const [postSectionEnd, setPostSectionEnd] = useState(0);
  const [postSectionLabel, setPostSectionLabel] = useState("");

  const loadGenRef = useRef(0);

  /** New session → clear UI so we never flash the previous attempt or hang on stale `sessionOk`. */
  useEffect(() => {
    loadGenRef.current += 1;
    setSessionOk(null);
    setSessionMeta(null);
    setQuestions([]);
    setIdx(0);
    setAnswers({});
    setResumeFromCache(false);
  }, [sessionId]);

  const loadQuiz = useCallback(async (): Promise<void> => {
    if (!sessionId || !profile) return;
    const gen = loadGenRef.current;
    try {
      const s = await getQuizSession(sessionId);
      if (gen !== loadGenRef.current) return;
      if (!s || s.studentId !== profile.uid) {
        setSessionOk(false);
        setResumeFromCache(false);
        return;
      }
      if (s.status !== "in_progress") {
        clearQuizDraftCache(profile.uid, sessionId);
        navigate(`/student/nclex/results/${sessionId}`);
        return;
      }
      const filter = s.filterCategory?.trim() || null;
      const tmpl =
        s.templateId != null && String(s.templateId).trim() ? await getQuizTemplateById(String(s.templateId).trim()) : null;
      const templateExam = tmpl?.examType ?? null;
      let qs: StudentQuestion[];
      if (tmpl?.fixedQuestionIds?.length) {
        const pool = await resolveQuizTemplateQuestions(tmpl, {
          isAdmin: true,
          tutorUid: "",
          studentTrack: profile.nursingTrack ?? null,
        });
        qs = pool.map(toStudentQuestion);
      } else {
        qs = await listStudentQuizQuestions(filter, {
          studentTrack: profile.nursingTrack ?? null,
          templateExam,
        });
      }
      if (gen !== loadGenRef.current) return;
      const lim = s.questionLimit;
      if (lim != null && lim > 0) qs = qs.slice(0, lim);
      await ensureQuizQuestionIds(sessionId, qs.map((q) => q.id));
      if (gen !== loadGenRef.current) return;
      const s2 = await getQuizSession(sessionId);
      if (gen !== loadGenRef.current) return;
      if (!s2 || s2.studentId !== profile.uid) {
        setSessionOk(false);
        setResumeFromCache(false);
        return;
      }
      if (s2.status !== "in_progress") {
        clearQuizDraftCache(profile.uid, sessionId);
        navigate(`/student/nclex/results/${sessionId}`);
        return;
      }
      if (s2.questionIds?.length) qs = orderQuestionsByIds(qs, s2.questionIds);
      const cached = readQuizDraftCache(profile.uid, sessionId);
      const { answers: fromCache, idx: nextIdx } = mergeCachedIntoQuestionList(qs, cached);
      const serverDrafts = draftsFromServerResponses(s2.responses ?? []);
      const merged = { ...fromCache };
      for (const [k, v] of Object.entries(serverDrafts)) merged[k] = v;
      if (gen !== loadGenRef.current) return;
      setSessionMeta(s2);
      setQuestions(qs);
      setAnswers(merged);
      setIdx(nextIdx);
      setResumeFromCache(false);
      setSessionOk(true);
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      const cached = readQuizDraftCache(profile.uid, sessionId);
      if (cached?.questions.length) {
        const { answers: merged, idx: nextIdx } = mergeCachedIntoQuestionList(cached.questions, cached);
        setSessionMeta(
          placeholderSessionFromCache(
            sessionId,
            profile.uid,
            profile.name ?? "",
            cached.meta,
            cached.questions.length,
          ),
        );
        setQuestions(cached.questions);
        setAnswers(merged);
        setIdx(nextIdx);
        setResumeFromCache(true);
        setSessionOk(true);
        toast.info("Showing your saved progress — reconnect to sync with the server.");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to load quiz");
        setSessionOk(false);
        setResumeFromCache(false);
      }
    }
  }, [sessionId, profile, navigate]);

  useEffect(() => {
    if (!sessionId || !profile) return;
    void loadQuiz();
  }, [sessionId, profile, loadQuiz]);

  useEffect(() => {
    const onOnline = () => {
      void loadQuiz();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [loadQuiz]);

  const [browserOnline, setBrowserOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );
  useEffect(() => {
    const up = () => setBrowserOnline(true);
    const down = () => setBrowserOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const persistRef = useRef({
    profile,
    sessionOk,
    sessionId,
    idx,
    answers,
    questions,
    sessionMeta,
  });
  persistRef.current = { profile, sessionOk, sessionId, idx, answers, questions, sessionMeta };

  const flushDraftToStorage = useCallback(() => {
    const p = persistRef.current;
    if (!p.profile || p.sessionOk !== true || !p.sessionId || !p.questions.length || !p.sessionMeta) return;
    writeQuizDraftCache({
      v: QUIZ_DRAFT_CACHE_VERSION,
      sessionId: p.sessionId,
      studentId: p.profile.uid,
      savedAt: Date.now(),
      idx: p.idx,
      answers: p.answers,
      questions: p.questions,
      meta: {
        quizTitle: p.sessionMeta.quizTitle ?? null,
        filterCategory: p.sessionMeta.filterCategory ?? null,
        questionLimit: p.sessionMeta.questionLimit ?? null,
      },
    });
  }, []);

  useEffect(() => {
    if (!profile || sessionOk !== true || !sessionId || !questions.length || !sessionMeta) return;
    const t = window.setTimeout(flushDraftToStorage, 400);
    return () => window.clearTimeout(t);
  }, [profile, sessionOk, sessionId, idx, answers, questions, sessionMeta, flushDraftToStorage]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushDraftToStorage();
    };
    window.addEventListener("pagehide", flushDraftToStorage);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flushDraftToStorage);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [flushDraftToStorage]);

  const submitBlocked = resumeFromCache || !browserOnline;

  const current = questions[idx];
  const draft = current ? answers[current.id] ?? { selectedAnswerIds: [], studentExplanation: "" } : null;

  const progress = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round(((idx + 1) / questions.length) * 100);
  }, [idx, questions.length]);

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.selectedAnswerIds?.length ?? 0) > 0).length,
    [questions, answers],
  );

  const lockedQuestionIds = useMemo(
    () => new Set((sessionMeta?.responses ?? []).map((r) => String(r.questionId ?? "")).filter(Boolean)),
    [sessionMeta?.responses],
  );

  const chunkCount = useMemo(
    () => (questions.length ? Math.ceil(questions.length / QUIZ_CHUNK_SIZE) : 0),
    [questions.length],
  );

  const chunkMeta = useMemo(() => {
    return Array.from({ length: chunkCount }, (_, k) => {
      const start = k * QUIZ_CHUNK_SIZE;
      const end = Math.min(start + QUIZ_CHUNK_SIZE, questions.length);
      const slice = questions.slice(start, end);
      const submitted = slice.length > 0 && slice.every((q) => lockedQuestionIds.has(q.id));
      const label = `${start + 1}–${end}`;
      return { k, start, end, slice, submitted, label };
    });
  }, [chunkCount, questions, lockedQuestionIds]);

  const sectionState = useMemo(() => {
    if (!questions.length) return null;
    const end = Math.min(Math.ceil((idx + 1) / QUIZ_CHUNK_SIZE) * QUIZ_CHUNK_SIZE, questions.length);
    const start = (() => {
      for (let i = 0; i < end; i++) {
        if (!lockedQuestionIds.has(questions[i]!.id)) return i;
      }
      return end;
    })();
    const label = start < end ? `${start + 1}–${end}` : `${end}–${end}`;
    const isCheckpoint = (idx + 1) % QUIZ_CHUNK_SIZE === 0 && idx < questions.length - 1;
    const isFinal = idx === questions.length - 1;
    return { start, end, label, isCheckpoint, isFinal };
  }, [idx, questions, lockedQuestionIds]);

  const setDraft = (next: Partial<Draft>) => {
    if (!current) return;
    if (lockedQuestionIds.has(current.id)) return;
    let expl = next.studentExplanation ?? answers[current.id]?.studentExplanation ?? "";
    if (expl.length > EXPL_MAX) expl = expl.slice(0, EXPL_MAX);
    setAnswers((a) => ({
      ...a,
      [current.id]: {
        selectedAnswerIds: next.selectedAnswerIds ?? a[current.id]?.selectedAnswerIds ?? [],
        studentExplanation: expl,
      },
    }));
  };

  const runSubmit = async () => {
    if (!profile) return;
    if (!answeredCount) {
      toast.error("Answer at least one question before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      // Finalize: only submit unsaved questions; saved sections remain locked and are merged server-side.
      const payload = questions.filter((q) => !lockedQuestionIds.has(q.id)).map((q) => ({
        questionId: q.id,
        selectedAnswerIds: Array.from(
          new Set((answers[q.id]?.selectedAnswerIds ?? []).map((x) => x.toLowerCase().trim())),
        ).filter(Boolean),
        studentExplanation: answers[q.id]?.studentExplanation?.trim() || undefined,
      }));
      await submitQuizSession(sessionId, payload);
      clearQuizDraftCache(profile.uid, sessionId);
      setConfirmOpen(false);
      toast.success("Submitted for marking. Your tutor will review and release your CAT score when ready.");
      navigate(`/student/nclex/results/${sessionId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const runSubmitChunk = async (chunkIndex: number) => {
    if (!profile) return;
    const meta = chunkMeta[chunkIndex];
    if (!meta?.slice.length || meta.submitted) return;
    setSubmitting(true);
    try {
      const payload = meta.slice.map((q) => ({
        questionId: q.id,
        selectedAnswerIds: Array.from(
          new Set((answers[q.id]?.selectedAnswerIds ?? []).map((x) => x.toLowerCase().trim())),
        ).filter(Boolean),
        studentExplanation: answers[q.id]?.studentExplanation?.trim() || undefined,
      }));
      await submitQuizChunk(sessionId, payload, { finalize: false });
      await loadQuiz();
      toast.success(`Section saved (questions ${meta.label}). You can keep working on the rest.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Section save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const runSaveCurrentSection = async () => {
    if (!profile || !sectionState) return;
    const { start, end, label } = sectionState;
    if (start >= end) return;
    setSubmitting(true);
    try {
      const slice = questions.slice(start, end);
      const payload = slice.map((q) => ({
        questionId: q.id,
        selectedAnswerIds: Array.from(
          new Set((answers[q.id]?.selectedAnswerIds ?? []).map((x) => x.toLowerCase().trim())),
        ).filter(Boolean),
        studentExplanation: answers[q.id]?.studentExplanation?.trim() || undefined,
      }));
      await submitQuizChunk(sessionId, payload, { finalize: false });
      await loadQuiz();
      setPostSectionEnd(end);
      setPostSectionLabel(label);
      setPostSectionOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Section save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const runRequestSectionFromPostSaveDialog = async () => {
    if (!profile || postSectionEnd < 1) return;
    setSubmitting(true);
    try {
      await requestSectionScore(sessionId, postSectionEnd);
      await loadQuiz();
      toast.success("Opening your section results page — it will update when your tutor releases this block.");
      setPostSectionOpen(false);
      navigate(`/student/nclex/results/${sessionId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const runRequestSectionScore = async () => {
    if (!profile || !sectionState) return;
    const end = sectionState.end;
    setSubmitting(true);
    try {
      await requestSectionScore(sessionId, end);
      await loadQuiz();
      toast.success("Opening your section results page — it will update when your tutor releases this block.");
      navigate(`/student/nclex/results/${sessionId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !profile) {
    return (
      <div className="nclex-app nclex-shell">
        <div className="nclex-main-narrow space-y-4 py-16">
          <Card className="nclex-card border-blue-200/80 shadow-md">
            <CardContent className="space-y-4 p-6 sm:p-8">
              <p className="text-base font-semibold text-slate-900">Sign in to open this quiz</p>
              <p className="text-sm leading-relaxed text-slate-600">
                Your session link is valid after you sign in with the same account that started the attempt.
              </p>
              <Button className="nclex-btn-primary w-full sm:w-auto" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
                Go to student home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading || sessionOk === null) {
    return (
      <div className="nclex-app nclex-shell flex min-h-[55vh] flex-col items-center justify-center gap-5 px-4 py-12">
        <Spinner className="h-12 w-12 text-[var(--nclex-primary)]" />
        <div className="max-w-md text-center">
          <p className="text-base font-semibold text-slate-900">Loading your quiz</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Syncing questions and saved answers. If this takes more than a minute, check your connection and use Back
            below.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  if (!profile || sessionOk === false) {
    return (
      <div className="nclex-app nclex-shell">
        <div className="nclex-main-narrow py-16">
          <Card className="nclex-card border-amber-200/80">
            <CardContent className="space-y-4 p-6 sm:p-8">
              <p className="text-base font-semibold text-slate-900">This quiz is not available</p>
              <p className="text-sm leading-relaxed text-slate-600">
                The link may be wrong, the attempt may belong to another account, or it was already submitted.
              </p>
              <Button className="nclex-btn-primary" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="nclex-app nclex-shell">
        <div className="nclex-main-narrow py-16">
          <Card className="nclex-card">
            <CardContent className="space-y-4 p-6 sm:p-8">
              <p className="text-base font-semibold text-slate-900">No questions loaded</p>
              <p className="text-sm leading-relaxed text-slate-600">
                There are no active questions for this quiz&apos;s category, or your tutor is still wiring the bank.
                Refresh after a moment, or open the dashboard and start again.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button className="nclex-btn-primary" onClick={() => void loadQuiz()}>
                  Try again
                </Button>
                <Button variant="outline" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
                  Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const explLen = draft?.studentExplanation.length ?? 0;

  return (
    <div className="nclex-app nclex-shell relative min-h-screen pb-12">
      {submitting ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <Spinner className="h-10 w-10 text-[var(--nclex-primary)]" />
          <p className="text-sm font-medium text-gray-800">Submitting your attempt…</p>
          <p className="max-w-xs px-4 text-center text-xs text-gray-600">Please keep this tab open until submission finishes.</p>
        </div>
      ) : null}
      <NclexHeader
        title={sessionMeta?.quizTitle ?? "NCLEX practice quiz"}
        subtitle={`Question ${idx + 1} of ${questions.length}`}
        homeHref={STUDENT_NCLEX_DASHBOARD}
        homeLabel="Dashboard"
      />

      <main className="nclex-main mx-auto max-w-3xl space-y-5 pt-2 sm:space-y-6 xl:max-w-5xl 2xl:max-w-6xl">
        {resumeFromCache ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            You are viewing a saved copy of this quiz. Reconnect to the internet so we can confirm your session is still
            active; then you can submit.
          </p>
        ) : null}
        {!browserOnline ? (
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            You appear to be offline. Your answers are still being saved in this browser. Reconnect to submit your quiz.
          </p>
        ) : null}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium nclex-text-muted">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="nclex-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {sessionMeta && canViewInProgressSectionResults(sessionMeta) && sessionMeta.sectionLinearPercentScoreUpTo != null && sessionMeta.sectionScoreReleasedUpTo ? (
          <div className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0">
              Your tutor released results for questions 1–{sessionMeta.sectionScoreReleasedUpTo} (classical score{" "}
              <span className="font-semibold tabular-nums">{sessionMeta.sectionLinearPercentScoreUpTo}%</span>).
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 border-emerald-300 bg-white text-emerald-950 hover:bg-emerald-100"
              onClick={() => navigate(`/student/nclex/results/${sessionId}`)}
            >
              View section results
            </Button>
          </div>
        ) : null}
        {sessionMeta && hasPendingSectionScoreRequest(sessionMeta) ? (
          <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0">
              You requested section results; your tutor has not released them yet. Open the status page to wait — it
              refreshes automatically when scores are ready.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
              onClick={() => navigate(`/student/nclex/results/${sessionId}`)}
            >
              Open section status
            </Button>
          </div>
        ) : null}

        <div className="flex max-w-full flex-wrap gap-1 sm:gap-1.5">
          {questions.map((q, i) => {
            const done = (answers[q.id]?.selectedAnswerIds?.length ?? 0) > 0;
            const locked = lockedQuestionIds.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                aria-label={`Go to question ${i + 1}${locked ? " (saved)" : ""}`}
                className="h-7 min-w-7 rounded-md border text-[10px] font-semibold transition-colors sm:h-8 sm:min-w-8 sm:text-xs"
                style={{
                  borderColor: i === idx ? "var(--nclex-primary)" : "var(--nclex-border)",
                  backgroundColor: i === idx
                    ? "rgba(0,102,204,0.08)"
                    : locked
                      ? "rgba(107,114,128,0.15)"
                      : done
                        ? "rgba(16,185,129,0.12)"
                        : "#fff",
                  color: i === idx ? "var(--nclex-primary)" : locked ? "#4b5563" : done ? "var(--nclex-success)" : "var(--nclex-neutral)",
                }}
                onClick={() => setIdx(i)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {current && draft ? (
          <div className="space-y-6">
            <QuestionCard
              className="nclex-card"
              question={current}
              value={draft.selectedAnswerIds}
              onChange={(ids) => setDraft({ selectedAnswerIds: ids })}
              allowMultiple={current.allowMultipleAnswers}
              readOnly={lockedQuestionIds.has(current.id)}
              compact
            />
            <Card className="nclex-card">
              <CardContent className="space-y-3 pt-6">
                <div>
                  <p className="text-sm font-semibold">Your rationale</p>
                  <p className="text-xs nclex-text-muted">
                    Write your own clinical rationale for the option(s) you selected. Your attempt is marked by your tutor;
                    a CAT-style score is released to you after review.
                  </p>
                  {lockedQuestionIds.has(current.id) ? (
                    <p className="text-xs font-medium text-gray-600 pt-1">
                      This item was saved with a section submit and cannot be edited.
                    </p>
                  ) : null}
                </div>
                <Textarea
                  rows={5}
                  maxLength={EXPL_MAX}
                  readOnly={lockedQuestionIds.has(current.id)}
                  className="rounded-[var(--nclex-radius-input)] text-sm"
                  value={draft.studentExplanation}
                  onChange={(e) => setDraft({ studentExplanation: e.target.value })}
                  placeholder="State your reasoning (priority, safety, assessment data, etc.)…"
                />
                <p className="text-xs tabular-nums nclex-text-muted">
                  {explLen}/{EXPL_MAX} characters
                </p>
              </CardContent>
            </Card>

            {sectionState && (sectionState.isCheckpoint || (sectionState.isFinal && sectionState.end - sectionState.start >= QUIZ_CHUNK_SIZE)) ? (
              <Card className="nclex-card">
                <CardContent className="space-y-2 pt-6">
                  <p className="text-sm font-semibold">Checkpoint</p>
                  <p className="text-xs nclex-text-muted">
                    Save this block so your answers are sent to your tutor. After saving, you can go straight on with the
                    rest of the quiz, or ask the tutor to release your score and feedback for this block first — either
                    way you can keep answering.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting || submitBlocked || sectionState.start >= sectionState.end}
                      onClick={() => void runSaveCurrentSection()}
                    >
                      Save section {sectionState.label}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        submitting ||
                        submitBlocked ||
                        sectionState.start >= sectionState.end ||
                        (sessionMeta?.sectionScoreRequestedUpTo ?? 0) >= sectionState.end
                      }
                      onClick={() => void runRequestSectionScore()}
                    >
                      Request results for {sectionState.end}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          {idx < questions.length - 1 ? (
            <Button className="nclex-btn-primary" onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="nclex-btn-primary"
              disabled={submitting || submitBlocked}
              title={submitBlocked ? "Reconnect to the internet to submit." : undefined}
              onClick={() => setConfirmOpen(true)}
            >
              Submit quiz
            </Button>
          )}
        </div>
      </main>

      <AlertDialog open={postSectionOpen} onOpenChange={setPostSectionOpen}>
        <AlertDialogContent className="max-h-[min(90vh,640px)] overflow-y-auto rounded-[var(--nclex-radius-card)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Section {postSectionLabel} saved</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-gray-600">
                <p>
                  These questions are locked in as submitted for this part of the attempt. You can continue with the rest
                  of the quiz now.
                </p>
                <p>
                  If you want your tutor to review this block and release your score and detailed item feedback before you
                  go on, choose <span className="font-medium text-gray-800">Ask tutor for this section</span>. That is
                  optional — you can also use <span className="font-medium text-gray-800">Request results</span> at the
                  checkpoint anytime.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="w-full bg-[#0066CC] px-4 py-2 font-semibold text-white shadow-sm hover:bg-[#0052a3] sm:order-2 sm:w-auto"
              disabled={submitting}
              onClick={() => setPostSectionOpen(false)}
            >
              Continue with test
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:order-1 sm:w-auto"
              disabled={
                submitting || (sessionMeta?.sectionScoreRequestedUpTo ?? 0) >= postSectionEnd || postSectionEnd < 1
              }
              onClick={() => void runRequestSectionFromPostSaveDialog()}
            >
              {(sessionMeta?.sectionScoreRequestedUpTo ?? 0) >= postSectionEnd && postSectionEnd > 0
                ? "Already requested for this section"
                : "Ask tutor for this section"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-h-[min(90vh,640px)] overflow-y-auto rounded-[var(--nclex-radius-card)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit quiz?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-gray-600">
                <p>You will not be able to change your answers after final submission.</p>
                <p className="text-sm text-gray-700">
                  Your answers and rationales are sent for marking. You will not see scores until your tutor reviews and
                  releases them. Unanswered items count as incorrect for the attempt record. If you used{" "}
                  <span className="font-medium">Save this section</span>, those items stay as you saved them.
                </p>
                <p className="font-medium text-gray-900">
                  Questions answered: {answeredCount} of {questions.length}
                </p>
                {answeredCount < questions.length ? (
                  <p className="text-amber-700">Unanswered: {questions.length - answeredCount} (will be scored as incorrect)</p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="w-full bg-[#0066CC] px-4 py-2 font-semibold text-white shadow-sm hover:bg-[#0052a3] sm:order-2 sm:w-auto"
              disabled={submitting || submitBlocked}
              onClick={(e) => {
                e.preventDefault();
                void runSubmit();
              }}
            >
              Submit for marking
            </Button>
            <AlertDialogCancel className="w-full border-gray-300 sm:order-1 sm:mt-0 sm:w-auto">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

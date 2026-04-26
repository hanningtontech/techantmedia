import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ExplanationScoreDisplay } from "@/components/nclex/ExplanationScoreDisplay";
import { QuestionCard } from "@/components/nclex/QuestionCard";
import { ExplanationBlocks } from "@/components/nclex/ExplanationBlocks";
import { NursingFactLoader } from "@/components/nclex/NursingFactLoader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import {
  areQuizResultsReleasedToStudent,
  canViewInProgressSectionResults,
  getCorrectAnswerIds,
  getQuestionById,
  hasPendingSectionScoreRequest,
  responseSelectedIds,
  sectionScoreNeededUpTo,
  subscribeQuizSession,
  toStudentQuestion,
} from "@/lib/firestore/nclex";
import type { Question, QuizSession } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

async function loadQuestionsForSession(s: QuizSession): Promise<Record<string, Question>> {
  const map: Record<string, Question> = {};
  const ids = new Set<string>();
  if (s.questionIds?.length) {
    for (const id of s.questionIds) ids.add(String(id));
  }
  for (const r of s.responses) ids.add(String(r.questionId));
  for (const questionId of Array.from(ids)) {
    const q = await getQuestionById(questionId);
    if (q) map[questionId] = q;
  }
  return map;
}

type Phase =
  | "boot"
  | "waiting"
  | "sectionWaiting"
  | "preparing"
  | "ready"
  | "sectionPreparing"
  | "sectionReady"
  | "notfound";

export default function QuizResults() {
  useRedirectStudentIfPending();
  const { sessionId } = useParams() as { sessionId: string };
  const [, navigate] = useLocation();
  const { profile, loading: authLoading } = useFirebaseAuth();
  const [session, setSession] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [phase, setPhase] = useState<Phase>("boot");
  const lastReleasedRef = useRef(false);
  const sectionPrimedRef = useRef(false);

  useEffect(() => {
    setPhase("boot");
    setSession(null);
    setQuestions({});
    lastReleasedRef.current = false;
    sectionPrimedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !profile) return;
    lastReleasedRef.current = false;
    sectionPrimedRef.current = false;
    const unsub = subscribeQuizSession(sessionId, (snap) => {
      void (async () => {
        try {
          if (snap == null) {
            setSession(null);
            setPhase("notfound");
            return;
          }
          if (snap.studentId !== profile.uid) {
            setSession(null);
            setPhase("notfound");
            return;
          }
          setSession(snap);
          if (snap.status === "in_progress") {
            if (canViewInProgressSectionResults(snap)) {
              const map = await loadQuestionsForSession(snap);
              setQuestions(map);
              const firstPaint = !sectionPrimedRef.current;
              if (firstPaint) {
                sectionPrimedRef.current = true;
                setPhase("sectionPreparing");
                await new Promise((r) => setTimeout(r, 500));
              }
              setPhase("sectionReady");
              return;
            }
            if (hasPendingSectionScoreRequest(snap)) {
              setQuestions({});
              setPhase("sectionWaiting");
              return;
            }
            navigate(`/student/nclex/quiz/${sessionId}`);
            setPhase("boot");
            return;
          }
          sectionPrimedRef.current = false;
          const released = areQuizResultsReleasedToStudent(snap);
          if (!released) {
            lastReleasedRef.current = false;
            setQuestions({});
            setPhase("waiting");
            return;
          }

          const firstReleasePaint = !lastReleasedRef.current;
          if (firstReleasePaint) {
            setPhase("preparing");
            const map = await loadQuestionsForSession(snap);
            setQuestions(map);
            lastReleasedRef.current = true;
            await new Promise((r) => setTimeout(r, 700));
          }
          setPhase("ready");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to load results");
          setSession(null);
          setPhase("notfound");
        }
      })();
    });
    return () => unsub();
  }, [sessionId, profile, navigate]);

  if (!authLoading && !profile) {
    return (
      <div className="nclex-app nclex-shell">
        <div className="nclex-main-narrow py-16">
          <Card className="nclex-card">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm font-medium text-slate-800">Sign in to view your results.</p>
              <Button className="nclex-btn-primary" onClick={() => navigate("/student/nclex")}>
                Student home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (authLoading || phase === "boot") {
    return (
      <div className="nclex-app nclex-shell">
        <NursingFactLoader
          seed={`quiz:${sessionId}`}
          title="Loading results"
          subtitle="Connecting to your attempt. If this takes long, check your connection and open the quiz again."
        />
        <div className="flex justify-center pb-10">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/student/nclex")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "sectionWaiting") {
    if (!session) {
      return (
        <div className="container flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Spinner className="h-8 w-8" />
          <p>Loading…</p>
        </div>
      );
    }
    const upTo = sectionScoreNeededUpTo(session);
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-10">
        <div className="container max-w-lg space-y-6 text-center">
          <Card className="border-sky-200 shadow-sm">
            <CardHeader className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
                <Spinner className="h-8 w-8 text-sky-700" />
              </div>
              <CardTitle className="text-xl">Waiting for section results</CardTitle>
              <CardDescription className="text-base text-slate-600">
                You asked for feedback and scores for questions 1–{upTo || "…"}. Your tutor or admin will review and
                release this section when ready.{" "}
                <span className="font-medium text-slate-800">Keep this page open</span> — it updates automatically as
                soon as they release, then your section breakdown will load here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm text-slate-700">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                </span>
                Listening for release — no need to refresh.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button variant="outline" onClick={() => navigate(`/student/nclex/quiz/${sessionId}`)}>
                  Continue quiz
                </Button>
                <Button variant="outline" onClick={() => navigate("/student/nclex")}>
                  Back to dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile || !session || phase === "notfound") {
    return (
      <div className="container py-16">
        <p className="text-muted-foreground">Results not found.</p>
        <Button className="mt-4" onClick={() => navigate("/student/nclex")}>
          Back
        </Button>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10">
        <div className="container max-w-lg space-y-6 text-center">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Spinner className="h-8 w-8 text-slate-600" />
              </div>
              <CardTitle className="text-xl">Waiting for score and question review</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Your attempt was submitted for marking. Your tutor will review your answers and rationales, then release
                your results. This page updates automatically when they are ready — you can keep it open or come back
                later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                </span>
                Listening for your tutor — your results will appear here as soon as they are released.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button variant="outline" onClick={() => navigate("/student/nclex")}>
                  Back to dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (phase === "preparing" || phase === "sectionPreparing") {
    const sectionPrep = phase === "sectionPreparing";
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50/80 to-white py-16">
        <div className="container flex max-w-md flex-col items-center gap-5 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-blue-100">
            <Spinner className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {sectionPrep ? "Loading your section review" : "Loading your marked attempt"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {sectionPrep
                ? "Gathering your tutor-released score and questions for this part of the quiz."
                : "Marking is complete — we are preparing your score breakdown and question review. This only takes a moment."}
            </p>
          </div>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  const responsePairs = session.responses.map((r, i) => ({ r, storedIndex: i }));
  const byQuestionId = new Map(responsePairs.map((p) => [String(p.r.questionId), p] as const));
  const orderIds =
    session.questionIds?.length ? session.questionIds.map(String) : responsePairs.map((p) => String(p.r.questionId));
  const orderedPairs = orderIds
    .map((id) => byQuestionId.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null);

  const sectionUpTo = session.sectionScoreReleasedUpTo ?? 0;
  const sectionScorePct = session.sectionLinearPercentScoreUpTo;
  const isSectionView = phase === "sectionReady" && canViewInProgressSectionResults(session);
  const sectionSlots = isSectionView
    ? session.questionIds?.length
      ? session.questionIds.slice(0, Math.min(sectionUpTo, session.questionIds.length)).map((questionId, displayIndex) => {
          const pair = byQuestionId.get(String(questionId));
          return {
            questionId: String(questionId),
            r: pair?.r ?? null,
            storedIndex: pair?.storedIndex ?? displayIndex,
            displayIndex,
          };
        })
      : orderedPairs.slice(0, Math.min(sectionUpTo, orderedPairs.length)).map((p, displayIndex) => ({
          questionId: String(p.r.questionId),
          r: p.r,
          storedIndex: p.storedIndex,
          displayIndex,
        }))
    : null;

  const rowsToRender =
    isSectionView && sectionSlots?.length
      ? sectionSlots.map((slot) => ({
          r: slot.r,
          storedIndex: slot.storedIndex,
          displayIndex: slot.displayIndex,
          key: `${slot.questionId}-${slot.storedIndex}`,
          questionId: slot.questionId,
        }))
      : orderedPairs.map((p, displayIndex) => ({
          r: p.r,
          storedIndex: p.storedIndex,
          displayIndex,
          key: `${p.r.questionId}-${p.storedIndex}`,
          questionId: String(p.r.questionId),
        }));

  return (
    <div className="nclex-app nclex-shell min-h-screen py-6 sm:py-10">
      <div className="nclex-main mx-auto max-w-3xl space-y-5 sm:space-y-6 xl:max-w-4xl 2xl:max-w-5xl">
        <Button variant="ghost" size="sm" className="gap-1 text-slate-700" onClick={() => navigate("/student/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Button>

        <Card className="border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardHeader>
            <CardTitle>{isSectionView ? "Section results" : "Quiz results"}</CardTitle>
            <CardDescription className="text-blue-100">
              {isSectionView ? (
                <>
                  Questions 1–{sectionUpTo} (this attempt) · classical score{" "}
                  <span className="font-semibold tabular-nums">{sectionScorePct ?? "—"}%</span>
                  <span className="mt-2 block text-xs text-blue-100/90">
                    This is the score for the section your tutor released. Your full-quiz CAT estimate is still computed
                    when you finish and your tutor releases final results.
                  </span>
                </>
              ) : (
                <>
                  {session.totalCorrect}/{session.totalQuestions} items correct · CAT estimate {session.percentageScore}%
                  {session.catTheta != null ? (
                    <span className="block pt-1 text-xs text-blue-100/90">
                      Adaptive ability index (internal): θ ≈ {session.catTheta}
                      {session.catStandardError != null ? ` (SE ≈ ${session.catStandardError})` : ""}
                    </span>
                  ) : null}
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/80">
          <CardContent className="pt-4 text-sm text-emerald-950">
            <p className="font-medium">{isSectionView ? "Section review" : "Marking complete"}</p>
            <p className="mt-1 text-emerald-900/90">
              {isSectionView
                ? "Review each item below. When you are ready, continue the quiz to answer the remaining questions."
                : "Your reported score uses a computer-adaptive testing (CAT) style estimate from your response pattern across items. Your tutor has released these results to you. Item-level rationales below support your review."}
            </p>
          </CardContent>
        </Card>

        {rowsToRender.map((row) => {
          const n = row.displayIndex + 1;
          if (!row.r) {
            return (
              <div key={row.key} className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 text-xs tabular-nums text-white">
                    {n}
                  </span>
                  <span>Question {n}</span>
                </div>
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No submitted answer for this item in this section yet.
                  </CardContent>
                </Card>
              </div>
            );
          }
          const q = questions[row.questionId];
          if (!q) return null;
          const studentView = toStudentQuestion(q);
          const r = row.r;
          return (
            <div key={row.key} className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 text-xs tabular-nums text-white">
                  {n}
                </span>
                <span>Question {n}</span>
              </div>
              <QuestionCard
                question={studentView}
                value={responseSelectedIds(r)}
                onChange={() => {}}
                showCorrect
                correctIds={getCorrectAnswerIds(q)}
                readOnly
                compact
              />
              <ExplanationScoreDisplay score={r.adminOverrideScore ?? r.explanationScore} />
              {r.studentExplanation ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Your rationale</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{r.studentExplanation}</CardContent>
                </Card>
              ) : null}
              {q.rationale ? (
                <ExplanationBlocks rationale={q.rationale} />
              ) : null}
            </div>
          );
        })}

        {isSectionView ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="sm:flex-1" onClick={() => navigate(`/student/nclex/quiz/${sessionId}`)}>
              Continue with test
            </Button>
            <Button variant="outline" className="sm:flex-1" onClick={() => navigate("/student/nclex")}>
              Dashboard
            </Button>
          </div>
        ) : (
          <Button onClick={() => navigate("/student/nclex")}>Done</Button>
        )}
      </div>
    </div>
  );
}

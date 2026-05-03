import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionCard } from "@/components/nclex/QuestionCard";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { listStudentQuestionsByIds, subscribeRatSession, submitRatSession } from "@/lib/firestore/nclex";
import type { RatSession, StudentQuestion } from "@/lib/firestore/nclexTypes";
import { STUDENT_NCLEX_DASHBOARD } from "@/lib/nclex/studentNclexRoutes";
import { toast } from "sonner";
import { ArrowLeft, Clock, Send } from "lucide-react";

function msToClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function StudentRATTake() {
  const { ratId } = useParams() as { ratId: string };
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [rat, setRat] = useState<RatSession | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ratId) return;
    const unsub = subscribeRatSession(ratId, setRat);
    return () => unsub();
  }, [ratId]);

  useEffect(() => {
    if (!rat?.questionIds?.length) return;
    void listStudentQuestionsByIds(rat.questionIds)
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, [rat?.questionIds?.join(",")]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const remainingMs = useMemo(() => {
    const end = rat?.endsAtMs ?? 0;
    return end ? Math.max(0, end - now) : 0;
  }, [rat?.endsAtMs, now]);

  const canSubmit = useMemo(() => {
    if (!rat) return false;
    if (rat.status !== "in_progress") return false;
    return questions.length > 0;
  }, [rat, questions.length]);

  useEffect(() => {
    if (!rat || rat.status !== "in_progress") return;
    if (remainingMs > 0) return;
    if (!profile) return;
    // Auto-submit once when time runs out.
    void (async () => {
      try {
        setSubmitting(true);
        await submitRatSession({ ratId: rat.id, studentId: profile.uid, answersByQuestionId: answers });
        navigate(`/student/nclex/rat-results/${rat.id}`);
      } catch {
        // ignore
      } finally {
        setSubmitting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, rat?.id, rat?.status, profile?.uid]);

  const onSubmit = async () => {
    if (!profile || !rat) return;
    setSubmitting(true);
    try {
      await submitRatSession({ ratId: rat.id, studentId: profile.uid, answersByQuestionId: answers });
      navigate(`/student/nclex/rat-results/${rat.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="nclex-app nclex-shell">
        <div className="nclex-main-narrow py-12">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="mt-4 h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="container py-12 text-muted-foreground">Sign in to continue…</div>;
  }

  if (!rat) {
    return <div className="container py-12 text-muted-foreground">Loading assessment…</div>;
  }

  if (rat.studentId !== profile.uid) {
    return <div className="container py-12 text-muted-foreground">Not allowed.</div>;
  }

  if (rat.status === "submitted") {
    navigate(`/student/nclex/rat-results/${rat.id}`);
    return null;
  }

  return (
    <div className="nclex-app min-h-screen bg-gradient-to-b from-slate-50/80 to-white pb-24">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <Card className="nclex-card overflow-hidden shadow-md">
          <CardHeader className="border-b border-[var(--nclex-border)] bg-white/80">
            <CardTitle className="text-lg">Random Assessment Test</CardTitle>
            <CardDescription>{rat.questionCount} questions · No rationales · Score shows immediately after submit.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Tip: unanswered questions count as incorrect when time ends.</p>
          </CardContent>
        </Card>

        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading questions…</p>
        ) : (
          <div className="space-y-8">
            {questions.map((q, idx) => {
              const value = answers[q.id] ?? [];
              return (
                <div key={q.id} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                      {idx + 1}
                    </span>
                    <span>Question {idx + 1}</span>
                  </div>
                  <QuestionCard
                    className="nclex-card"
                    question={q}
                    value={value}
                    onChange={(next) => setAnswers((s) => ({ ...s, [q.id]: next }))}
                    allowMultiple={q.allowMultipleAnswers}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating timer */}
      <div className="fixed right-4 top-16 z-[60] inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm">
        <Clock className="h-4 w-4" />
        {msToClock(remainingMs)}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[55] border-t bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button className="nclex-btn-primary w-full" disabled={!canSubmit || submitting} onClick={() => void onSubmit()}>
            <Send className="mr-2 h-4 w-4" />
            Submit RAT
          </Button>
        </div>
      </div>
    </div>
  );
}


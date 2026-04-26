import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionCard } from "@/components/nclex/QuestionCard";
import { NursingFactLoader } from "@/components/nclex/NursingFactLoader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { getCorrectAnswerIds, listQuestionsByIds, subscribeRatSession, toStudentQuestion } from "@/lib/firestore/nclex";
import type { Question, RatSession } from "@/lib/firestore/nclexTypes";
import { ArrowLeft } from "lucide-react";

export default function StudentRATResults() {
  const { ratId } = useParams() as { ratId: string };
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [rat, setRat] = useState<RatSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!ratId) return;
    const unsub = subscribeRatSession(ratId, setRat);
    return () => unsub();
  }, [ratId]);

  useEffect(() => {
    if (!rat?.questionIds?.length) {
      setQuestions([]);
      return;
    }
    void listQuestionsByIds(rat.questionIds)
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, [rat?.questionIds?.join(",")]);

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q] as const)), [questions]);
  const selectedById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rat?.responses ?? []) {
      m.set(String(r.questionId ?? ""), Array.isArray(r.selectedAnswerIds) ? r.selectedAnswerIds : []);
    }
    return m;
  }, [rat?.responses]);

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
    return <NursingFactLoader seed={`rat:${ratId}`} title="Preparing RAT results" subtitle="Fetching your score and answer key…" />;
  }

  if (rat.studentId !== profile.uid) {
    return <div className="container py-12 text-muted-foreground">Not allowed.</div>;
  }

  if (rat.status !== "submitted") {
    return (
      <div className="container py-12 text-muted-foreground">
        Assessment is still in progress.
        <div className="mt-4">
          <Button onClick={() => navigate(`/student/nclex/rat/${rat.id}`)}>Return to RAT</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="nclex-app min-h-screen bg-gradient-to-b from-slate-50/80 to-white pb-16">
      <div className="mx-auto max-w-2xl space-y-6 px-4 pt-8 sm:px-6">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/student/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <Card className="nclex-card overflow-hidden shadow-md">
          <CardHeader className="border-b border-[var(--nclex-border)] bg-white/80">
            <CardTitle>RAT results</CardTitle>
            <CardDescription>
              Score summary and answer key (no rationales).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide nclex-text-muted">Score</p>
              <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: "var(--nclex-primary)" }}>
                {Math.round(Number(rat.percentageScore) || 0)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide nclex-text-muted">Correct</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {rat.totalCorrect}/{rat.totalQuestions}
              </p>
            </div>
            <div className="flex items-end">
              <Button className="nclex-btn-primary w-full" onClick={() => navigate("/student/nclex/rat-history")}>
                View RAT history
              </Button>
            </div>
          </CardContent>
        </Card>

        {rat.questionIds.length && questions.length ? (
          <div className="space-y-8">
            {rat.questionIds.map((qid, idx) => {
              const q = byId.get(qid);
              if (!q) return null;
              const sq = toStudentQuestion(q);
              const correct = getCorrectAnswerIds(q);
              const selected = selectedById.get(qid) ?? [];
              return (
                <div key={qid} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                      {idx + 1}
                    </span>
                    <span>Question {idx + 1}</span>
                  </div>
                  <QuestionCard
                    className="nclex-card"
                    question={sq}
                    value={selected}
                    onChange={() => {}}
                    allowMultiple={sq.allowMultipleAnswers}
                    readOnly
                    showCorrect
                    correctIds={correct}
                    compact
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <NursingFactLoader seed={`ratKey:${rat.id}`} title="Loading answer key" subtitle="Almost ready…" />
        )}
      </div>
    </div>
  );
}


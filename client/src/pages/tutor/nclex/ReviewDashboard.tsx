import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ExplanationScoreDisplay } from "@/components/nclex/ExplanationScoreDisplay";
import { ExplanationBlocks } from "@/components/nclex/ExplanationBlocks";
import { KeywordVisualization } from "@/components/nclex/KeywordVisualization";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { cn } from "@/lib/utils";
import {
  areQuizResultsReleasedToStudent,
  conveyResultsToStudent,
  getCorrectAnswerIds,
  getQuestionAdminOnly,
  getQuestionById,
  getQuizSession,
  hasPendingSectionScoreRequest,
  overrideExplanationScore,
  releaseSectionScore,
  responseSelectedIds,
  tagExplanation,
} from "@/lib/firestore/nclex";
import type { Question, QuizSession } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function ReviewDashboard() {
  const params = useParams() as { studentId?: string; sessionId?: string };
  const studentId = params.studentId ?? "";
  const sessionId = params.sessionId ?? "";
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [session, setSession] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  /** Admin-only distractor notes keyed by question id (Firestore rules block students/tutors). */
  const [adminOnlyByQuestionId, setAdminOnlyByQuestionId] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [scores, setScores] = useState<Record<number, string>>({});
  const [conveying, setConveying] = useState(false);
  const [outcome, setOutcome] = useState<"" | "pass" | "fail" | "borderline">("");
  const [outcomeNote, setOutcomeNote] = useState("");
  /** Which response row’s “Edit question” panel is open (explanation score + overrides live here). */
  const [scoreSheetStoredIndex, setScoreSheetStoredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId || !profile || !isTutorOrAdmin(profile)) return;
    const run = async () => {
      try {
        const s = await getQuizSession(sessionId);
        if (!s || s.studentId !== studentId) {
          setSession(null);
          return;
        }
        setSession(s);
        const map: Record<string, Question> = {};
        for (const r of s.responses) {
          const q = await getQuestionById(r.questionId);
          if (q) map[r.questionId] = q;
        }
        setQuestions(map);
        if (profile.role === "admin") {
          const extra: Record<string, string> = {};
          await Promise.all(
            s.responses.map(async (r) => {
              const ao = await getQuestionAdminOnly(r.questionId);
              if (ao?.whyOthersIncorrect) extra[r.questionId] = ao.whyOthersIncorrect;
            }),
          );
          setAdminOnlyByQuestionId(extra);
        } else {
          setAdminOnlyByQuestionId({});
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      }
    };
    void run();
  }, [sessionId, studentId, profile, loading]);

  const reload = async () => {
    const s = await getQuizSession(sessionId);
    setSession(s);
  };

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  if (!session) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Session not found.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/tutor/nclex/users")}>
          Back
        </Button>
      </div>
    );
  }

  const partialInProgress = session.status === "in_progress" && session.responses.length > 0;
  const canConveyResults = session.status !== "in_progress";
  const pendingSectionRequest = session.status === "in_progress" && hasPendingSectionScoreRequest(session);
  const responsePairs = session.responses.map((r, i) => ({ r, storedIndex: i }));
  const byQuestionId = new Map(responsePairs.map((p) => [String(p.r.questionId), p] as const));
  const orderIds =
    session.questionIds?.length ? session.questionIds.map(String) : responsePairs.map((p) => String(p.r.questionId));
  const orderedPairs = orderIds.map((id) => byQuestionId.get(id)).filter(Boolean) as Array<{
    r: QuizSession["responses"][number];
    storedIndex: number;
  }>;

  const scoreSheetPair =
    scoreSheetStoredIndex != null ? orderedPairs.find((p) => p.storedIndex === scoreSheetStoredIndex) ?? null : null;
  const scoreSheetR = scoreSheetPair?.r;
  const scoreSheetQ = scoreSheetR ? questions[scoreSheetR.questionId] : undefined;
  const scoreSheetDisplayIndex =
    scoreSheetStoredIndex != null ? orderedPairs.findIndex((p) => p.storedIndex === scoreSheetStoredIndex) : -1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-4xl py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => navigate(`/tutor/nclex/users?user=${encodeURIComponent(studentId)}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to user
          </Button>
        </div>

        {partialInProgress ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Partial attempt</p>
            <p className="pt-1 text-amber-900/90">
              The student saved one or more sections but has not submitted the full quiz yet. You can review answers and
              rationales below; use <span className="font-medium">Convey results</span> only after the attempt is
              submitted.
            </p>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Review: {session.studentName}</CardTitle>
            <CardDescription>
              Classical (answer key): {session.totalCorrect}/{session.totalQuestions} (
              {session.linearPercentScore ?? "—"}% linear).{" "}
              {areQuizResultsReleasedToStudent(session) ? (
                <span className="block pt-1 font-medium text-emerald-700">
                  Student-facing CAT estimate: {session.percentageScore}% (released)
                </span>
              ) : (
                <span className="block pt-1 font-medium text-amber-800">
                  Student cannot see results until you convey — a CAT-style score is computed when you release.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 border-t pt-4">
            {session.questionIds?.length ? (
              <div className="w-full text-sm text-muted-foreground">
                {(() => {
                  const missed: number[] = [];
                  const byId = new Map(session.responses.map((r) => [String(r.questionId), r] as const));
                  session.questionIds!.forEach((id, i) => {
                    const r = byId.get(String(id));
                    if (r && r.isCorrect === false) missed.push(i + 1);
                  });
                  if (!missed.length) return <span className="text-emerald-700 font-medium">Missed: none</span>;
                  return (
                    <span>
                      <span className="font-medium text-gray-900">Missed question numbers:</span>{" "}
                      <span className="tabular-nums">{missed.join(", ")}</span>
                    </span>
                  );
                })()}
              </div>
            ) : null}
            <div className="w-full space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="h-9 w-full rounded-md border bg-white px-2 text-sm sm:w-[220px]"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as any)}
                  disabled={conveying || areQuizResultsReleasedToStudent(session)}
                >
                  <option value="">Select outcome…</option>
                  <option value="pass">PASS</option>
                  <option value="borderline">BORDERLINE</option>
                  <option value="fail">FAIL</option>
                </select>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={
                    conveying ||
                    areQuizResultsReleasedToStudent(session) ||
                    !canConveyResults ||
                    !outcome
                  }
                  title={!canConveyResults ? "Available after the student submits the full quiz." : !outcome ? "Pick PASS/FAIL/BORDERLINE first." : undefined}
                  onClick={() => {
                    setConveying(true);
                    void conveyResultsToStudent(sessionId, { adminOutcome: outcome || undefined, adminOutcomeNote: outcomeNote })
                      .then(() => {
                        toast.success("Results released to the student. Their results page will update automatically.");
                        return reload();
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not release results"))
                      .finally(() => setConveying(false));
                  }}
                >
                  {areQuizResultsReleasedToStudent(session) ? "Already released to student" : conveying ? "Releasing…" : "Convey results to student"}
                </Button>
              </div>
              <Textarea
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder="Optional note to student (they will see this when clicking their PASS/FAIL/BORDERLINE label)."
                className="min-h-[80px]"
                disabled={conveying || areQuizResultsReleasedToStudent(session)}
              />
            </div>
            {pendingSectionRequest ? (
              <Button
                variant="outline"
                disabled={conveying}
                onClick={() => {
                  setConveying(true);
                  void releaseSectionScore(sessionId)
                    .then(() => {
                      toast.success("Section score released to student.");
                      return reload();
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Could not release section score"))
                    .finally(() => setConveying(false));
                }}
              >
                Release section results & score (up to Q{session.sectionScoreRequestedUpTo})
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Sheet
          open={scoreSheetStoredIndex !== null}
          onOpenChange={(open) => {
            if (!open) setScoreSheetStoredIndex(null);
          }}
        >
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
            {scoreSheetR && scoreSheetQ && scoreSheetStoredIndex != null ? (
              <>
                <SheetHeader>
                  <SheetTitle>
                    Edit / score question{" "}
                    {scoreSheetDisplayIndex >= 0 ? `(${scoreSheetDisplayIndex + 1})` : ""}
                  </SheetTitle>
                  <SheetDescription>
                    Update the bank item or adjust explanation scoring for this student response.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-4 pb-6">
                  <Button
                    variant="outline"
                    className="w-full shrink-0"
                    onClick={() => {
                      navigate(`/tutor/nclex/questions?edit=${encodeURIComponent(String(scoreSheetR.questionId))}`);
                      setScoreSheetStoredIndex(null);
                    }}
                  >
                    Open question bank editor
                  </Button>

                  <ExplanationScoreDisplay
                    score={scoreSheetR.adminOverrideScore ?? scoreSheetR.explanationScore}
                    label="Explanation score (override if set)"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Keyword matches</p>
                    <KeywordVisualization matched={scoreSheetR.matchedKeywords} available={scoreSheetQ.keywordsList} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void tagExplanation(sessionId, scoreSheetStoredIndex, "acceptable").then(() => reload())
                      }
                    >
                      Tag acceptable
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void tagExplanation(sessionId, scoreSheetStoredIndex, "not acceptable").then(() => reload())
                      }
                    >
                      Tag not acceptable
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-1">
                    <div>
                      <p className="mb-1 text-sm font-medium">Override score (0–100)</p>
                      <input
                        className="h-10 w-full rounded-md border px-3 text-sm"
                        value={scores[scoreSheetStoredIndex] ?? ""}
                        onChange={(e) => setScores((s) => ({ ...s, [scoreSheetStoredIndex]: e.target.value }))}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">Notes</p>
                      <Textarea
                        rows={3}
                        value={notes[scoreSheetStoredIndex] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [scoreSheetStoredIndex]: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      const idx = scoreSheetStoredIndex;
                      const sc = Number(scores[idx]);
                      if (Number.isNaN(sc)) {
                        toast.error("Enter a numeric score");
                        return;
                      }
                      void overrideExplanationScore(sessionId, idx, sc, notes[idx] ?? "")
                        .then(() => {
                          toast.success("Saved override");
                          return reload();
                        })
                        .catch(() => toast.error("Save failed"));
                    }}
                  >
                    Save override
                  </Button>
                  {scoreSheetR.explanationTag ? (
                    <p className="text-xs text-muted-foreground">Tag: {scoreSheetR.explanationTag}</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>

        {orderedPairs.map((p, displayIndex) => {
          const r = p.r;
          const storedIndex = p.storedIndex;
          const q = questions[r.questionId];
          return (
            <Card key={`${r.questionId}-${storedIndex}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    Question {displayIndex + 1}
                    {q?.title?.trim() ? ` · ${q.title.trim()}` : ""}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setScoreSheetStoredIndex(storedIndex)}>
                    Edit question
                  </Button>
                </div>
                <CardDescription className="whitespace-pre-wrap">{q?.questionText}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {q?.options?.length ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Answer choices</p>
                    <ul className="divide-y rounded-md border bg-white text-sm">
                      {(() => {
                        const selected = new Set(responseSelectedIds(r));
                        const keyed = new Set(getCorrectAnswerIds(q));
                        return q.options.map((opt) => {
                          const id = String(opt.id).toLowerCase();
                          const picked = selected.has(id);
                          const key = keyed.has(id);
                          return (
                            <li
                              key={id}
                              className={cn(
                                "flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5",
                                key && "bg-emerald-50/80",
                                picked && !key && "bg-amber-50/80",
                              )}
                            >
                              <span className="font-mono font-semibold tabular-nums text-gray-900">{id.toUpperCase()}.</span>
                              <span className="min-w-0 flex-1 whitespace-pre-wrap text-gray-800">{opt.text}</span>
                              <span className="flex shrink-0 flex-wrap gap-1">
                                {picked ? (
                                  <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-900">
                                    Student
                                  </span>
                                ) : null}
                                {key ? (
                                  <span className="rounded border border-emerald-200 bg-emerald-100/90 px-1.5 py-0.5 text-xs font-medium text-emerald-900">
                                    Answer key
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          );
                        });
                      })()}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      Summary: student{" "}
                      <span className="font-medium tabular-nums">
                        {responseSelectedIds(r)
                          .map((x) => x.toUpperCase())
                          .join(", ") || "—"}
                      </span>
                      {" · "}
                      correct key{" "}
                      <span className="font-medium tabular-nums">
                        {getCorrectAnswerIds(q)
                          .map((x) => x.toUpperCase())
                          .join(", ")}
                      </span>
                      {" · "}
                      <span className={r.isCorrect ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                        {r.isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Selected:</span>{" "}
                    {responseSelectedIds(r)
                      .map((x) => x.toUpperCase())
                      .join(", ") || "—"}{" "}
                    <span className="font-medium ml-3">Correct:</span>{" "}
                    {q ? getCorrectAnswerIds(q).map((x) => x.toUpperCase()).join(", ") : "—"}{" "}
                    <span className={r.isCorrect ? "text-emerald-600" : "text-red-600"}>
                      {r.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                    <span className="block pt-1">Question options could not be loaded.</span>
                  </p>
                )}

                {q?.rationale ? (
                  <ExplanationBlocks
                    rationale={q.rationale}
                    adminExtra={profile.role === "admin" ? adminOnlyByQuestionId[r.questionId] : undefined}
                    adminTone={profile.role === "admin"}
                  />
                ) : null}

                <div className="space-y-2">
                  <p className="text-sm font-medium">Student rationale</p>
                  {r.studentExplanation?.trim() ? (
                    <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-white">{r.studentExplanation}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3 bg-white">
                      No rationale text was submitted for this item.
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Explanation score, keyword matches, and overrides are in{" "}
                  <span className="font-medium">Edit question</span>.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

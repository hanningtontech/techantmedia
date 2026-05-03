import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionCountdown } from "@/components/tutoring/SessionCountdown";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { listPublishedClassNotes, type ClassNote } from "@/lib/firestore/classNotes";
import { countQuestionsForQuizTemplate, createQuizSession, listAssignedQuizTemplates } from "@/lib/firestore/nclex";
import type { QuizTemplate } from "@/lib/firestore/nclexTypes";
import { listPublishedStudyGuides, type StudyGuide } from "@/lib/firestore/studyGuides";
import {
  getTutoringParticipant,
  getTutoringSessionUnlockRequest,
  mergeSessionTemplatesForStudent,
  requestTutoringSessionUnlock,
  subscribeTutoringSession,
  type TutoringSession,
} from "@/lib/firestore/tutoringSessions";
import { STUDENT_NCLEX_DASHBOARD } from "@/lib/nclex/studentNclexRoutes";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, FileText, Lock, Play, Presentation } from "lucide-react";
import type { NursingTrack } from "@/lib/userTypes";

function TutoringSessionPresentationLinks({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-600">Presentations</p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <Button key={id} size="sm" variant="outline" className="gap-1" asChild>
            <Link href={`/student/nclex/presentations/view/${id}`}>
              <Presentation className="h-4 w-4" />
              Open deck
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function StudentTutoringSessionDetail() {
  useRedirectStudentIfPending();
  const { sessionId } = useParams() as { sessionId: string };
  const [, navigate] = useLocation();
  const { profile, loading, firebaseReady } = useFirebaseAuth();
  const [session, setSession] = useState<TutoringSession | null | undefined>(undefined);
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [pools, setPools] = useState<Record<string, number>>({});
  const [noteMeta, setNoteMeta] = useState<ClassNote[]>([]);
  const [guideMeta, setGuideMeta] = useState<StudyGuide[]>([]);
  const [starting, setStarting] = useState(false);
  const [unlockPending, setUnlockPending] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeTutoringSession(sessionId, setSession);
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!profile?.uid || !firebaseReady || !sessionId || session == null || session === undefined) return;
    if (!session.published || !session.assignedStudentIds.includes(profile.uid)) {
      setTemplates([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [participant, assigned, notes, guides] = await Promise.all([
          getTutoringParticipant(sessionId, profile.uid),
          listAssignedQuizTemplates(profile.uid, profile.nursingTrack as NursingTrack | null),
          listPublishedClassNotes({ studentTrack: profile.nursingTrack as NursingTrack, take: 200 }),
          listPublishedStudyGuides({ limit: 200 }),
        ]);
        if (cancelled) return;
        const mergedIds = new Set(mergeSessionTemplatesForStudent(session, participant));
        const tmpl = assigned.filter((t) => mergedIds.has(t.id));
        setTemplates(tmpl);
        const idSet = new Set(session.classNoteIds ?? []);
        setNoteMeta(notes.filter((n) => idSet.has(n.id)));
        const gSet = new Set(session.studyGuideIds ?? []);
        setGuideMeta(guides.filter((g) => gSet.has(g.id)));
        const poolEntries = await Promise.all(
          tmpl.map(async (t) => {
            const n = await countQuestionsForQuizTemplate(t, { studentTrack: profile.nursingTrack ?? null });
            return [t.id, n] as const;
          }),
        );
        if (!cancelled) setPools(Object.fromEntries(poolEntries));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not load session materials");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, profile?.nursingTrack, firebaseReady, sessionId, session]);

  useEffect(() => {
    if (!sessionId || !profile?.uid || session == null || session === undefined) return;
    if (!session.published || !session.assignedStudentIds.includes(profile.uid) || !session.locked) {
      setUnlockPending(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await getTutoringSessionUnlockRequest(sessionId, profile.uid);
      if (!cancelled) setUnlockPending(r?.status === "pending");
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, profile?.uid, session]);

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

  if (loading || !profile || profile.role !== "student") {
    return <div className="container py-12 text-muted-foreground">Loading…</div>;
  }

  if (session === undefined) {
    return <div className="container py-12 text-muted-foreground">Loading session…</div>;
  }

  if (session === null) {
    return (
      <div className="nclex-app nclex-shell min-h-screen">
        <div className="nclex-main-narrow space-y-4 py-12">
          <p className="text-sm text-muted-foreground">This session was not found or you do not have access.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={STUDENT_NCLEX_DASHBOARD}>Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const s = session;
  const allowed = s.published && s.assignedStudentIds.includes(profile.uid);

  if (!allowed) {
    return (
      <div className="nclex-app nclex-shell min-h-screen">
        <div className="nclex-main-narrow space-y-4 py-12">
          <p className="text-sm text-muted-foreground">This session is not published for your account yet.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={STUDENT_NCLEX_DASHBOARD}>Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="nclex-app nclex-shell min-h-screen">
      <div className="nclex-main-narrow space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-1" asChild>
          <Link href={STUDENT_NCLEX_DASHBOARD}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-violet-600 hover:bg-violet-600">Instructor-led</Badge>
          {s.nclexTopic || s.nclexCategory ? (
            <span className="text-xs text-muted-foreground">
              {[s.nclexCategory, s.nclexTopic, s.nclexSubtopic].filter(Boolean).join(" → ")}
            </span>
          ) : null}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{s.title}</h1>
        {s.description ? <p className="text-sm text-slate-600">{s.description}</p> : null}

        {s.locked ? (
          <Card className="border-amber-200 bg-amber-50/90">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                <Lock className="h-4 w-4" />
                Session locked
              </CardTitle>
              <CardDescription className="text-amber-900/90">
                Your instructor froze edits on this session. You can still open materials below. Ask an admin to unlock if
                something needs to change.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={unlockPending}
                onClick={() =>
                  void (async () => {
                    if (!profile?.uid) return;
                    try {
                      await requestTutoringSessionUnlock(sessionId, profile.uid);
                      setUnlockPending(true);
                      toast.success("Request sent. An admin will review it.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Request failed");
                    }
                  })()
                }
              >
                {unlockPending ? "Unlock request sent" : "Request admin unlock"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <SessionCountdown session={s} className="nclex-card border-violet-100" />

        <Card className="nclex-card">
          <CardHeader>
            <CardTitle className="text-lg">Materials</CardTitle>
            <CardDescription>Everything your instructor linked to this session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.presentationIds?.length ? <TutoringSessionPresentationLinks ids={s.presentationIds} /> : null}
            {noteMeta.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Class notes</p>
                <ul className="list-inside list-disc text-sm text-slate-800">
                  {noteMeta.map((n) => (
                    <li key={n.id}>{n.title}</li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="gap-1" asChild>
                  <Link href="/student/nclex/class-notes">
                    <FileText className="h-4 w-4" />
                    Open class notes
                  </Link>
                </Button>
              </div>
            ) : null}
            {guideMeta.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Study guides</p>
                <ul className="space-y-2">
                  {guideMeta.map((g) => (
                    <li key={g.id}>
                      <a
                        href={g.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-violet-700 underline"
                      >
                        {g.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="gap-1" asChild>
                  <Link href="/student/nclex/study-guides">
                    <BookOpen className="h-4 w-4" />
                    All study guides
                  </Link>
                </Button>
              </div>
            ) : null}
            {!s.presentationIds?.length && noteMeta.length === 0 && guideMeta.length === 0 ? (
              <p className="text-sm text-muted-foreground">No extra files or decks linked yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="nclex-card">
          <CardHeader>
            <CardTitle className="text-lg">Your quizzes</CardTitle>
            <CardDescription>Attempts are saved automatically when you submit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-amber-900">
                No quizzes are assigned for you on this session yet. Ask your instructor to publish or update your roster.
              </p>
            ) : (
              templates.map((t) => {
                const pool = pools[t.id] ?? 0;
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-2 rounded-md border border-slate-100 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{pool} questions in pool</p>
                    </div>
                    <Button
                      size="sm"
                      className="nclex-btn-primary shrink-0"
                      disabled={starting || pool === 0}
                      onClick={() => startFromTemplate(t)}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      Open quiz
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

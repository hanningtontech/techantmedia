import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SessionCountdown } from "@/components/tutoring/SessionCountdown";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { useNclexAdminExamType } from "@/hooks/useNclexAdminExamType";
import { listAllClassNotes, type ClassNote } from "@/lib/firestore/classNotes";
import { getStudentQuizzes, listQuizTemplatesForEditor } from "@/lib/firestore/nclex";
import type { QuizSession, QuizTemplate } from "@/lib/firestore/nclexTypes";
import { listAllPresentations, type ClassPresentation } from "@/lib/firestore/presentations";
import { listAllStudyGuides, type StudyGuide } from "@/lib/firestore/studyGuides";
import { listUsersForAdmin } from "@/lib/firestore/usersAdmin";
import type { UserListRow } from "@/lib/userTypes";
import {
  clearTutoringSessionTimer,
  deleteTutoringSession,
  dismissTutoringSessionUnlockRequest,
  listTutoringParticipants,
  mergeSessionTemplatesForStudent,
  publishAndAssignTutoringSession,
  setTutoringSessionLocked,
  startTutoringSessionTimer,
  subscribeTutoringSession,
  subscribeTutoringSessionUnlockRequests,
  syncTutoringParticipantDocs,
  updateTutoringSession,
  upsertTutoringParticipant,
  type TutoringParticipant,
  type TutoringSession,
  type TutoringUnlockRequestRow,
} from "@/lib/firestore/tutoringSessions";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Lock, Timer, Trash2, Unlock } from "lucide-react";

function tsToDatetimeLocalValue(t: Timestamp | null): string {
  if (!t?.toDate) return "";
  const d = t.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultParticipant(studentId: string): TutoringParticipant {
  return { studentId, extraTemplateIds: [], excludedTemplateIds: [], adminNotes: "", updatedAt: null };
}

export default function AdminTutoringSessionDetail() {
  const { sessionId } = useParams() as { sessionId: string };
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const { adminExamType } = useNclexAdminExamType();
  const [session, setSession] = useState<TutoringSession | null | undefined>(undefined);
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [presentations, setPresentations] = useState<ClassPresentation[]>([]);
  const [classNotes, setClassNotes] = useState<ClassNote[]>([]);
  const [studyGuides, setStudyGuides] = useState<StudyGuide[]>([]);
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [participantById, setParticipantById] = useState<Record<string, TutoringParticipant>>({});
  const [quizRowsByStudent, setQuizRowsByStudent] = useState<Record<string, QuizSession[]>>({});
  const [unlockRows, setUnlockRows] = useState<TutoringUnlockRequestRow[]>([]);
  const [busy, setBusy] = useState(false);

  const [schedLocal, setSchedLocal] = useState("");
  const [durationMin, setDurationMin] = useState("120");
  const [presSel, setPresSel] = useState<Set<string>>(new Set());
  const [notesSel, setNotesSel] = useState<Set<string>>(new Set());
  const [guidesSel, setGuidesSel] = useState<Set<string>>(new Set());

  const isAdmin = profile?.role === "admin";
  const canEdit = session && (!session.locked || isAdmin);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeTutoringSession(sessionId, setSession);
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeTutoringSessionUnlockRequests(sessionId, setUnlockRows);
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!profile || !isTutorOrAdmin(profile) || !sessionId) return;
    void (async () => {
      try {
        const [tmpl, pres, notes, guides] = await Promise.all([
          listQuizTemplatesForEditor({
            tutorUid: profile.uid,
            isAdmin: profile.role === "admin",
            adminExamType,
          }),
          listAllPresentations({ limit: 150 }),
          listAllClassNotes({ limit: 200 }),
          listAllStudyGuides({ limit: 150 }),
        ]);
        setTemplates(tmpl);
        setPresentations(pres.filter((p) => p.published));
        setClassNotes(notes);
        setStudyGuides(guides);
        if (profile.role === "admin") {
          const u = await listUsersForAdmin().catch(() => [] as UserListRow[]);
          setUsers(u);
        }
      } catch {
        toast.error("Could not load reference lists");
      }
    })();
  }, [profile, sessionId, adminExamType]);

  useEffect(() => {
    if (!session || !sessionId) return;
    setSchedLocal(tsToDatetimeLocalValue(session.scheduledAt));
    setDurationMin(String(session.durationMinutes));
    setPresSel(new Set(session.presentationIds ?? []));
    setNotesSel(new Set(session.classNoteIds ?? []));
    setGuidesSel(new Set(session.studyGuideIds ?? []));
  }, [session?.id, session?.scheduledAt, session?.durationMinutes, session?.presentationIds, session?.classNoteIds, session?.studyGuideIds, sessionId]);

  const reloadParticipants = async () => {
    if (!sessionId) return;
    await syncTutoringParticipantDocs(sessionId);
    const list = await listTutoringParticipants(sessionId);
    const m: Record<string, TutoringParticipant> = {};
    for (const p of list) m[p.studentId] = p;
    setParticipantById(m);
  };

  useEffect(() => {
    if (!session || !sessionId) return;
    void reloadParticipants().catch(() => toast.error("Could not sync participants"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.assignedStudentIds.join(","), sessionId]);

  const userLabel = useMemo(() => {
    const m = new Map(users.map((u) => [u.uid, u.name || u.email || u.uid] as const));
    return (uid: string) => m.get(uid) ?? uid.slice(0, 8);
  }, [users]);

  const loadQuizSummaries = async () => {
    if (!session || !sessionId) return;
    setBusy(true);
    try {
      const plist = await listTutoringParticipants(sessionId);
      const pmap = new Map(plist.map((x) => [x.studentId, x] as const));
      const next: Record<string, QuizSession[]> = {};
      const timerMs = session.timerStartedAt?.toMillis?.() ?? null;
      await Promise.all(
        session.assignedStudentIds.map(async (sid) => {
          const all = await getStudentQuizzes(sid);
          const p = pmap.get(sid) ?? null;
          const tids = new Set(mergeSessionTemplatesForStudent(session, p));
          const filtered = all.filter((q) => {
            const tid = q.templateId?.trim();
            if (!tid || !tids.has(tid)) return false;
            if (timerMs == null) return true;
            const sub = q.submittedAt?.toMillis?.() ?? q.startedAt?.toMillis?.() ?? 0;
            return sub >= timerMs;
          });
          next[sid] = filtered;
        }),
      );
      setQuizRowsByStudent(next);
      toast.success("Quiz results refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load results");
    } finally {
      setBusy(false);
    }
  };

  const saveScheduleAndMaterials = async () => {
    if (!sessionId || !session || !canEdit) return;
    setBusy(true);
    try {
      const dm = Math.min(24 * 60, Math.max(15, parseInt(durationMin, 10) || 120));
      let scheduledAt: Timestamp | null = null;
      if (schedLocal.trim()) {
        const d = new Date(schedLocal);
        if (!Number.isNaN(d.getTime())) scheduledAt = Timestamp.fromDate(d);
      }
      await updateTutoringSession(sessionId, {
        scheduledAt,
        durationMinutes: dm,
        presentationIds: Array.from(presSel),
        classNoteIds: Array.from(notesSel),
        studyGuideIds: Array.from(guidesSel),
      });
      toast.success("Session details saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const saveParticipantRow = async (studentId: string) => {
    if (!sessionId || !canEdit) return;
    const p = participantById[studentId] ?? defaultParticipant(studentId);
    setBusy(true);
    try {
      await upsertTutoringParticipant(sessionId, studentId, {
        extraTemplateIds: p.extraTemplateIds,
        excludedTemplateIds: p.excludedTemplateIds,
        adminNotes: p.adminNotes,
      });
      toast.success(`Saved notes & quizzes for ${userLabel(studentId)}`);
      await reloadParticipants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const patchParticipant = (studentId: string, patch: Partial<TutoringParticipant>) => {
    setParticipantById((prev) => {
      const cur = prev[studentId] ?? defaultParticipant(studentId);
      return { ...prev, [studentId]: { ...cur, ...patch, studentId } };
    });
  };

  const publish = async () => {
    if (!profile || !sessionId) return;
    setBusy(true);
    try {
      await publishAndAssignTutoringSession(sessionId, profile.uid);
      toast.success("Published and assignments synced");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!sessionId || !session) return;
    if (!confirm("Delete this session and its participant rows? Quiz attempts are not deleted.")) return;
    setBusy(true);
    try {
      await deleteTutoringSession(sessionId);
      toast.success("Deleted");
      navigate("/tutor/nclex/tutoring-sessions");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  if (session === undefined) {
    return <div className="container py-12 text-muted-foreground">Loading session…</div>;
  }

  if (session === null) {
    return (
      <div className="container max-w-2xl py-12">
        <p className="text-muted-foreground">Session not found.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/tutor/nclex/tutoring-sessions")}>
          Back to list
        </Button>
      </div>
    );
  }

  const s = session;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-4xl space-y-6 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1" asChild>
            <Link href="/tutor/nclex/tutoring-sessions">
              <ArrowLeft className="h-4 w-4" />
              All sessions
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{s.title}</h1>
              {s.published ? <Badge>Published</Badge> : <Badge variant="secondary">Draft</Badge>}
              {s.locked ? (
                <Badge variant="destructive" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Locked
                </Badge>
              ) : null}
            </div>
            {s.description ? <p className="mt-2 text-sm text-muted-foreground">{s.description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!s.published ? (
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700" disabled={busy || !canEdit} onClick={() => void publish()}>
                Publish & assign
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy || !canEdit} onClick={() => void publish()}>
                Re-sync assignments
              </Button>
            )}
            {isAdmin ? (
              s.locked ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        await setTutoringSessionLocked(sessionId, false);
                        toast.success("Unlocked");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Unlock failed");
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  <Unlock className="h-4 w-4" />
                  Unlock
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        await setTutoringSessionLocked(sessionId, true);
                        toast.success("Locked");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Lock failed");
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  <Lock className="h-4 w-4" />
                  Lock
                </Button>
              )
            ) : null}
            <Button size="sm" variant="destructive" disabled={busy || (!isAdmin && s.locked)} onClick={() => void del()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <SessionCountdown session={s} />

        {unlockRows.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-amber-950">Unlock requests</CardTitle>
              <CardDescription>Students asked an admin to unlock this session while it was locked.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {unlockRows.map((r) => (
                <div
                  key={r.studentId}
                  className="flex flex-col gap-2 rounded-md border border-amber-200 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">{userLabel(r.studentId)}</p>
                    {r.message ? <p className="mt-1 text-xs text-slate-600">{r.message}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {r.createdAt?.toDate?.()?.toLocaleString?.() ?? "Requested"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        try {
                          await dismissTutoringSessionUnlockRequest(sessionId, r.studentId);
                          toast.success("Dismissed");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Dismiss failed");
                        }
                      })()
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live timer</CardTitle>
            <CardDescription>Starts a server-timestamped countdown for everyone on this session.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1"
              disabled={busy || !canEdit || Boolean(s.timerStartedAt)}
              onClick={() =>
                void (async () => {
                  try {
                    await startTutoringSessionTimer(sessionId);
                    toast.success("Timer started");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not start timer");
                  }
                })()
              }
            >
              <Timer className="h-4 w-4" />
              Start session timer
            </Button>
            {isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !canEdit || !s.timerStartedAt}
                onClick={() =>
                  void (async () => {
                    try {
                      await clearTutoringSessionTimer(sessionId);
                      toast.success("Timer cleared");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not clear timer");
                    }
                  })()
                }
              >
                Clear timer (admin)
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule & materials</CardTitle>
            <CardDescription>Optional calendar time, session length, and linked resources.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canEdit ? <p className="text-sm text-amber-800">This session is locked. Only an admin can change these fields.</p> : null}
            <div className="grid gap-2 sm:max-w-md">
              <Label htmlFor="sched">Scheduled date & time (local)</Label>
              <Input id="sched" type="datetime-local" value={schedLocal} onChange={(e) => setSchedLocal(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="dur">Countdown length (minutes)</Label>
              <select
                id="dur"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                disabled={!canEdit}
              >
                <option value="60">60</option>
                <option value="90">90</option>
                <option value="120">120</option>
                <option value="150">150</option>
                <option value="180">180</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Presentations</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {presentations.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={presSel.has(p.id)}
                      disabled={!canEdit}
                      onChange={() =>
                        setPresSel((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                    />
                    <span>{p.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Class notes</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {classNotes.map((n) => (
                  <label key={n.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={notesSel.has(n.id)}
                      disabled={!canEdit}
                      onChange={() =>
                        setNotesSel((prev) => {
                          const x = new Set(prev);
                          if (x.has(n.id)) x.delete(n.id);
                          else x.add(n.id);
                          return x;
                        })
                      }
                    />
                    <span>{n.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Study guides (files)</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {studyGuides.map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={guidesSel.has(g.id)}
                      disabled={!canEdit}
                      onChange={() =>
                        setGuidesSel((prev) => {
                          const x = new Set(prev);
                          if (x.has(g.id)) x.delete(g.id);
                          else x.add(g.id);
                          return x;
                        })
                      }
                    />
                    <span>{g.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="button" disabled={busy || !canEdit} onClick={() => void saveScheduleAndMaterials()}>
              Save schedule & materials
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Participants & per-student quizzes</CardTitle>
            <CardDescription>
              Default quizzes come from the session bundle. Add extras or exclude defaults for specific students, then save and
              re-sync assignments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.assignedStudentIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students on the roster yet. Edit the session from the list page.</p>
            ) : (
              s.assignedStudentIds.map((sid) => {
                const p = participantById[sid] ?? defaultParticipant(sid);
                const merged = mergeSessionTemplatesForStudent(s, p);
                return (
                  <Collapsible key={sid} className="rounded-lg border bg-white p-3">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left font-medium">
                      <span>{userLabel(sid)}</span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-3 text-sm">
                      <p className="text-xs text-muted-foreground">Effective quiz templates: {merged.length}</p>
                      <div className="grid gap-2">
                        <Label className="text-xs">Exclude from session defaults</Label>
                        <div className="max-h-28 space-y-1 overflow-y-auto rounded border p-2">
                          {s.templateIds.map((tid) => {
                            const title = templates.find((t) => t.id === tid)?.title ?? tid.slice(0, 8);
                            return (
                              <label key={tid} className="flex gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={p.excludedTemplateIds.includes(tid)}
                                  disabled={!canEdit}
                                  onChange={() => {
                                    const set = new Set(p.excludedTemplateIds);
                                    if (set.has(tid)) set.delete(tid);
                                    else set.add(tid);
                                    patchParticipant(sid, { excludedTemplateIds: Array.from(set) });
                                  }}
                                />
                                <span>{title}</span>
                              </label>
                            );
                          })}
                          {s.templateIds.length === 0 ? <span className="text-muted-foreground">No defaults on this session.</span> : null}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Extra quiz templates</Label>
                        <div className="max-h-32 space-y-1 overflow-y-auto rounded border p-2">
                          {templates.map((t) => (
                            <label key={t.id} className="flex gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={p.extraTemplateIds.includes(t.id)}
                                disabled={!canEdit}
                                onChange={() => {
                                  const set = new Set(p.extraTemplateIds);
                                  if (set.has(t.id)) set.delete(t.id);
                                  else set.add(t.id);
                                  patchParticipant(sid, { extraTemplateIds: Array.from(set) });
                                }}
                              />
                              <span>{t.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Session notes (this student)</Label>
                        <Textarea
                          rows={3}
                          value={p.adminNotes}
                          disabled={!canEdit}
                          onChange={(e) => patchParticipant(sid, { adminNotes: e.target.value })}
                          placeholder="Private planning notes for this participant…"
                        />
                      </div>
                      <Button type="button" size="sm" disabled={busy || !canEdit} onClick={() => void saveParticipantRow(sid)}>
                        Save participant
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session results (quizzes)</CardTitle>
            <CardDescription>
              Loads submitted attempts for each roster student whose template matches this session (optionally after the timer
              started).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void loadQuizSummaries()}>
              Refresh quiz results
            </Button>
            {s.assignedStudentIds.map((sid) => {
              const rows = quizRowsByStudent[sid] ?? [];
              return (
                <div key={sid} className="rounded-md border p-3">
                  <p className="font-medium">{userLabel(sid)}</p>
                  {rows.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No matching attempts yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {rows.map((q) => (
                        <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
                          <span>
                            {q.quizTitle ?? "Quiz"} · {q.percentageScore}% ·{" "}
                            {(q.submittedAt ?? q.startedAt)?.toDate?.()?.toLocaleString?.() ?? "—"}
                          </span>
                          <Button variant="link" size="sm" className="h-auto p-0" asChild>
                            <Link href={`/tutor/nclex/review/${sid}/${q.id}`}>Review</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

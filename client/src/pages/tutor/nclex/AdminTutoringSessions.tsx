import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Timestamp } from "firebase/firestore";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  NclexBlueprintSelects,
  labelsFromBlueprintSelection,
  matchBlueprintIdsFromLabels,
  type NclexBlueprintSelection,
} from "@/components/nclex/NclexBlueprintSelects";
import { useFirebaseAuth, isTutorOrAdmin, type AuthUserProfile } from "@/contexts/FirebaseAuthContext";
import { useNclexAdminExamType } from "@/hooks/useNclexAdminExamType";
import {
  createQuizTemplate,
  listBankCategoryCountsForBlueprint,
  listBankQuestionsForCategoryAndBlueprint,
  listQuizTemplatesForEditor,
} from "@/lib/firestore/nclex";
import { listAllPresentations, type ClassPresentation } from "@/lib/firestore/presentations";
import { listUsersForAdmin } from "@/lib/firestore/usersAdmin";
import type { NclexExamType, Question, QuizTemplate } from "@/lib/firestore/nclexTypes";
import type { UserListRow } from "@/lib/userTypes";
import {
  createTutoringSession,
  deleteTutoringSession,
  listTutoringSessionsForAdmin,
  publishAndAssignTutoringSession,
  updateTutoringSession,
  type TutoringSession,
} from "@/lib/firestore/tutoringSessions";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsUpDown, GraduationCap, Lock, Presentation, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SessionListTab = "assigned" | "upcoming" | "unassigned" | "unsigned" | "browse";

export default function AdminTutoringSessions() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const { adminExamType } = useNclexAdminExamType();
  const [rows, setRows] = useState<TutoringSession[]>([]);
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [examType, setExamType] = useState<NclexExamType | "">("");
  const [blueprint, setBlueprint] = useState<NclexBlueprintSelection>({ catId: "", topicId: "", subId: "" });
  const [isGeneral, setIsGeneral] = useState(false);
  const [rosterStudentIds, setRosterStudentIds] = useState<string[]>([]);
  /** Tutors cannot list all users in Firestore; they paste UIDs here. */
  const [tutorStudentRaw, setTutorStudentRaw] = useState("");
  const [presentationIds, setPresentationIds] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [publishNow, setPublishNow] = useState(false);
  const [allUsers, setAllUsers] = useState<UserListRow[]>([]);
  const [allPresentations, setAllPresentations] = useState<ClassPresentation[]>([]);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [bankCategories, setBankCategories] = useState<{ category: string; count: number }[]>([]);
  const [bankCategory, setBankCategory] = useState("");
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [extractSelected, setExtractSelected] = useState<Set<string>>(new Set());
  const [extractTitle, setExtractTitle] = useState("");
  const [bankBusy, setBankBusy] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [createDurationMin, setCreateDurationMin] = useState("120");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterStudentUid, setFilterStudentUid] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [listTab, setListTab] = useState<SessionListTab>("assigned");
  const [selectedStudentUid, setSelectedStudentUid] = useState("");
  const [tutorAssignedUid, setTutorAssignedUid] = useState("");

  const filteredRows = useMemo(() => {
    let r = rows;
    const t = filterTitle.trim().toLowerCase();
    if (t) r = r.filter((s) => s.title.toLowerCase().includes(t));
    const uid = filterStudentUid.trim();
    if (uid) r = r.filter((s) => s.assignedStudentIds.some((id) => id.includes(uid)));
    const fromMs = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`).getTime() : null;
    const toMs = filterDateTo ? new Date(`${filterDateTo}T23:59:59.999`).getTime() : null;
    if (fromMs != null && !Number.isNaN(fromMs)) {
      r = r.filter((s) => {
        const ms = s.scheduledAt?.toMillis?.() ?? s.createdAt?.toMillis?.() ?? 0;
        return ms >= fromMs;
      });
    }
    if (toMs != null && !Number.isNaN(toMs)) {
      r = r.filter((s) => {
        const ms = s.scheduledAt?.toMillis?.() ?? s.createdAt?.toMillis?.() ?? 0;
        return ms <= toMs;
      });
    }
    return r;
  }, [rows, filterTitle, filterStudentUid, filterDateFrom, filterDateTo]);

  const assignedUidSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of rows) for (const id of s.assignedStudentIds) set.add(id);
    return set;
  }, [rows]);

  const studentsForSelect = useMemo(
    () =>
      allUsers.filter(
        (u) =>
          u.role === "student" &&
          u.accountStatus !== "disabled" &&
          u.accountStatus !== "disqualified" &&
          u.approvalStatus !== "rejected",
      ),
    [allUsers],
  );

  const unsignedStudents = useMemo(() => {
    return studentsForSelect
      .filter((u) => !assignedUidSet.has(u.uid))
      .slice()
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
      .slice(0, 80);
  }, [studentsForSelect, assignedUidSet]);

  const upcomingRows = useMemo(() => {
    const t = Date.now();
    return rows
      .filter((s) => {
        const ms = s.scheduledAt?.toMillis?.() ?? 0;
        return ms > t;
      })
      .slice()
      .sort((a, b) => (a.scheduledAt?.toMillis?.() ?? 0) - (b.scheduledAt?.toMillis?.() ?? 0));
  }, [rows]);

  const unassignedRosterRows = useMemo(() => rows.filter((s) => s.assignedStudentIds.length === 0), [rows]);

  const assignedRowsForUser = useMemo(() => {
    const uid = profile?.role === "admin" ? selectedStudentUid.trim() : tutorAssignedUid.trim();
    if (!uid) return [] as TutoringSession[];
    return rows.filter((s) => s.assignedStudentIds.includes(uid));
  }, [rows, profile?.role, selectedStudentUid, tutorAssignedUid]);

  const listRowsToRender = useMemo(() => {
    switch (listTab) {
      case "assigned":
        return assignedRowsForUser;
      case "upcoming":
        return upcomingRows;
      case "unassigned":
        return unassignedRosterRows;
      case "unsigned":
        return [];
      case "browse":
      default:
        return filteredRows;
    }
  }, [listTab, assignedRowsForUser, upcomingRows, unassignedRosterRows, filteredRows]);

  const reload = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    const [r, t] = await Promise.all([
      listTutoringSessionsForAdmin({ adminExamType }),
      listQuizTemplatesForEditor({
        tutorUid: profile.uid,
        isAdmin: profile.role === "admin",
        adminExamType,
      }),
    ]);
    setRows(r);
    setTemplates(t);
  };

  useEffect(() => {
    if (!loading && profile && isTutorOrAdmin(profile)) {
      void reload().catch(() => toast.error("Failed to load sessions"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile, adminExamType]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    void listUsersForAdmin()
      .then(setAllUsers)
      .catch(() => setAllUsers([]));
  }, [profile]);

  useEffect(() => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    void listAllPresentations({ limit: 120 })
      .then((rows) => setAllPresentations(rows.filter((p) => p.published)))
      .catch(() => setAllPresentations([]));
  }, [profile]);

  const defaultExam = useMemo((): NclexExamType | null => {
    if (examType === "rn" || examType === "pn" || examType === "both") return examType;
    if (adminExamType === "rn" || adminExamType === "pn") return adminExamType;
    return null;
  }, [examType, adminExamType]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !isTutorOrAdmin(profile)) return;
    if (!adminExamType && !examType) {
      toast.error("Select NCLEX workspace on the tutor dashboard or pick an exam type below.");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const assignedStudentIds =
      profile.role === "admin"
        ? rosterStudentIds
        : tutorStudentRaw
            .split(/[\s,]+/)
            .map((x) => x.trim())
            .filter(Boolean);
    if (!assignedStudentIds.length) {
      toast.error(profile.role === "admin" ? "Add at least one student to the roster" : "Add at least one student UID");
      return;
    }
    if (!selectedTemplates.size) {
      toast.error("Select at least one quiz template");
      return;
    }
    const labels = labelsFromBlueprintSelection(blueprint);
    setBusy(true);
    try {
      let scheduledAt: Timestamp | null = null;
      if (scheduledAtLocal.trim()) {
        const d = new Date(scheduledAtLocal);
        if (!Number.isNaN(d.getTime())) scheduledAt = Timestamp.fromDate(d);
      }
      const dm = Math.min(24 * 60, Math.max(15, parseInt(createDurationMin, 10) || 120));
      const id = await createTutoringSession(
        {
          title: title.trim(),
          description: description.trim(),
          examType: defaultExam,
          ...labels,
          isGeneral,
          templateIds: Array.from(selectedTemplates),
          presentationIds: Array.from(presentationIds),
          assignedStudentIds,
          published: publishNow,
          scheduledAt,
          durationMinutes: dm,
        },
        profile.uid,
      );
      if (publishNow) {
        await publishAndAssignTutoringSession(id, profile.uid);
        toast.success("Session created, published, and quizzes assigned.");
      } else {
        toast.success("Session saved as draft.");
      }
      setTitle("");
      setDescription("");
      setRosterStudentIds([]);
      setTutorStudentRaw("");
      setPresentationIds(new Set());
      setSelectedTemplates(new Set());
      setPublishNow(false);
      setScheduledAtLocal("");
      setCreateDurationMin("120");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-4xl space-y-8 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          {profile.role === "admin" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/tutor/nclex/topic-progress">Topic progress</Link>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tutoring sessions</h1>
            <p className="text-sm text-muted-foreground">
              Instructor-led bundles: tag blueprint topics, attach quizzes, roster students, then publish to assign quizzes
              automatically.
            </p>
          </div>
        </div>

        {!adminExamType ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base">Select workspace first</CardTitle>
              <CardDescription>
                On the tutor dashboard, choose <strong>NCLEX-RN</strong> or <strong>NCLEX-PN</strong> so new sessions align
                with your track.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New session</CardTitle>
            <CardDescription>Draft saves without assigning; publish pushes quiz assignments to every student listed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="ts-title">Title</Label>
                <Input id="ts-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 — Pharmacology review" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ts-desc">Description</Label>
                <Textarea id="ts-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:max-w-md">
                <Label htmlFor="ts-sched">Scheduled date & time (optional, local)</Label>
                <Input
                  id="ts-sched"
                  type="datetime-local"
                  value={scheduledAtLocal}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="ts-dur">Live timer length when started (minutes)</Label>
                <select
                  id="ts-dur"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createDurationMin}
                  onChange={(e) => setCreateDurationMin(e.target.value)}
                >
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="120">120</option>
                  <option value="150">150</option>
                  <option value="180">180</option>
                </select>
              </div>
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="ts-exam">Exam type</Label>
                <select
                  id="ts-exam"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as NclexExamType | "")}
                >
                  <option value="">Match workspace ({adminExamType?.toUpperCase() ?? "—"})</option>
                  <option value="rn">NCLEX-RN</option>
                  <option value="pn">NCLEX-PN</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <NclexBlueprintSelects value={blueprint} onChange={setBlueprint} />
              <div className="flex items-center gap-2">
                <Switch id="ts-gen" checked={isGeneral} onCheckedChange={setIsGeneral} />
                <Label htmlFor="ts-gen" className="font-normal">
                  General (cross-topic)
                </Label>
              </div>
              {profile.role === "admin" ? (
                <StudentRosterPicker
                  users={allUsers}
                  value={rosterStudentIds}
                  onChange={setRosterStudentIds}
                  open={studentPickerOpen}
                  onOpenChange={setStudentPickerOpen}
                  disabled={busy}
                />
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="ts-students-tutor">Student UIDs (space or comma separated)</Label>
                  <Textarea
                    id="ts-students-tutor"
                    rows={3}
                    value={tutorStudentRaw}
                    onChange={(e) => setTutorStudentRaw(e.target.value)}
                    placeholder="Paste Firebase user IDs"
                    className="font-mono text-xs"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Presentation className="h-4 w-4" />
                  Presentations (published)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Link PPTX materials students should open during this session. Upload files under{" "}
                  <Link className="font-medium text-violet-700 underline" href="/tutor/nclex/presentations">
                    Presentations
                  </Link>
                  .
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                  {allPresentations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No published presentations found.</p>
                  ) : (
                    allPresentations.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={presentationIds.has(p.id)}
                          onChange={() =>
                            setPresentationIds((prev) => {
                              const n = new Set(prev);
                              if (n.has(p.id)) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                        />
                        <span>
                          <span className="font-medium">{p.title}</span>
                          <span className="block text-xs text-muted-foreground">{p.filename}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <BankExtractPanel
                blueprint={blueprint}
                isGeneral={isGeneral}
                bankCategories={bankCategories}
                bankCategory={bankCategory}
                bankQuestions={bankQuestions}
                extractSelected={extractSelected}
                extractTitle={extractTitle}
                bankBusy={bankBusy}
                onBankCategoryChange={setBankCategory}
                onExtractTitleChange={setExtractTitle}
                onToggleQuestion={(id) =>
                  setExtractSelected((prev) => {
                    const n = new Set(prev);
                    if (n.has(id)) n.delete(id);
                    else n.add(id);
                    return n;
                  })
                }
                onSelectAllVisible={() =>
                  setExtractSelected((prev) => {
                    const n = new Set(prev);
                    for (const q of bankQuestions) n.add(q.id);
                    return n;
                  })
                }
                onClearSelection={() => setExtractSelected(new Set())}
                onRefreshBanks={async () => {
                  if (!profile) return;
                  const lb = labelsFromBlueprintSelection(blueprint);
                  if (!isGeneral && !lb.nclexCategory?.trim()) {
                    toast.error("Pick a blueprint category (or enable General) to list test banks.");
                    return;
                  }
                  setBankBusy(true);
                  try {
                    const rows = await listBankCategoryCountsForBlueprint({
                      nclexCategory: lb.nclexCategory ?? "",
                      nclexTopic: lb.nclexTopic ?? "",
                      nclexSubtopic: lb.nclexSubtopic ?? "",
                      isGeneral,
                      templateExam: defaultExam,
                      tutorUid: profile.uid,
                      isAdmin: profile.role === "admin",
                    });
                    setBankCategories(rows);
                    setBankCategory(rows[0]?.category ?? "");
                    setBankQuestions([]);
                    setExtractSelected(new Set());
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not load banks");
                  } finally {
                    setBankBusy(false);
                  }
                }}
                onLoadQuestions={async () => {
                  if (!profile || !bankCategory.trim()) return;
                  setBankBusy(true);
                  try {
                    const lb = labelsFromBlueprintSelection(blueprint);
                    const qs = await listBankQuestionsForCategoryAndBlueprint({
                      nclexCategory: lb.nclexCategory ?? "",
                      nclexTopic: lb.nclexTopic ?? "",
                      nclexSubtopic: lb.nclexSubtopic ?? "",
                      isGeneral,
                      filterCategory: bankCategory,
                      templateExam: defaultExam,
                      tutorUid: profile.uid,
                      isAdmin: profile.role === "admin",
                    });
                    setBankQuestions(qs);
                    setExtractSelected(new Set());
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not load questions");
                  } finally {
                    setBankBusy(false);
                  }
                }}
                onCreateExtractQuiz={async () => {
                  if (!profile || !isTutorOrAdmin(profile)) return;
                  if (!extractTitle.trim()) {
                    toast.error("Enter a title for the new quiz");
                    return;
                  }
                  if (!extractSelected.size) {
                    toast.error("Select at least one question");
                    return;
                  }
                  const ids = bankQuestions.filter((q) => extractSelected.has(q.id)).map((q) => q.id);
                  const lb = labelsFromBlueprintSelection(blueprint);
                  setBankBusy(true);
                  try {
                    const tid = await createQuizTemplate(
                      {
                        title: extractTitle.trim(),
                        description: `Extract: ${bankCategory} · ${ids.length} item(s)`,
                        filterCategory: bankCategory,
                        questionLimit: ids.length,
                        examType: defaultExam,
                        nclexCategory: lb.nclexCategory,
                        nclexTopic: lb.nclexTopic,
                        nclexSubtopic: lb.nclexSubtopic,
                        isGeneral,
                        isActive: true,
                        fixedQuestionIds: ids,
                      },
                      profile.uid,
                    );
                    setSelectedTemplates((prev) => new Set(prev).add(tid));
                    setExtractTitle("");
                    setExtractSelected(new Set());
                    toast.success("Quiz created and selected for this session.");
                    await reload();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Create failed");
                  } finally {
                    setBankBusy(false);
                  }
                }}
              />
              <div className="grid gap-2">
                <Label>Quiz templates (this workspace)</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No templates. Create quizzes first.</p>
                  ) : (
                    templates.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedTemplates.has(t.id)}
                          onChange={() => toggleTemplate(t.id)}
                        />
                        <span>
                          <span className="font-medium">{t.title}</span>
                          {t.nclexTopic ? <span className="block text-xs text-muted-foreground">{t.nclexTopic}</span> : null}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="ts-pub" checked={publishNow} onCheckedChange={setPublishNow} />
                <Label htmlFor="ts-pub" className="font-normal">
                  Publish immediately and assign selected quizzes to all students
                </Label>
              </div>
              <Button type="submit" disabled={busy} className="bg-violet-600 hover:bg-violet-700">
                {publishNow ? "Create & assign" : "Save draft"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Existing sessions</CardTitle>
            <CardDescription>
              Use <strong>Assigned</strong> with a selected student to avoid loading the full history. <strong>Upcoming</strong>{" "}
              shows scheduled sessions in the future. <strong>Unassigned</strong> lists drafts with no roster yet.{" "}
              <strong>Unsigned students</strong> highlights active students not on any session roster.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={listTab} onValueChange={(v) => setListTab(v as SessionListTab)}>
              <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
                <TabsTrigger value="assigned" className="text-xs sm:text-sm">
                  Assigned
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="text-xs sm:text-sm">
                  Upcoming
                </TabsTrigger>
                <TabsTrigger value="unassigned" className="text-xs sm:text-sm">
                  Unassigned
                </TabsTrigger>
                {profile.role === "admin" ? (
                  <TabsTrigger value="unsigned" className="text-xs sm:text-sm">
                    Unsigned students
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="browse" className="text-xs sm:text-sm">
                  Browse all
                </TabsTrigger>
              </TabsList>
              <TabsContent value="assigned" className="mt-4 space-y-3">
                {profile.role === "admin" ? (
                  <div className="grid gap-2 sm:max-w-md">
                    <Label htmlFor="ts-assign-stu">Student</Label>
                    <select
                      id="ts-assign-stu"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedStudentUid}
                      onChange={(e) => setSelectedStudentUid(e.target.value)}
                    >
                      <option value="">— Select a student —</option>
                      {studentsForSelect.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {(u.name || u.email || u.uid).slice(0, 80)}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Only sessions that include this student on the roster are listed.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:max-w-md">
                    <Label htmlFor="ts-tutor-stu">Student UID (exact)</Label>
                    <Input
                      id="ts-tutor-stu"
                      className="font-mono text-xs"
                      value={tutorAssignedUid}
                      onChange={(e) => setTutorAssignedUid(e.target.value)}
                      placeholder="Paste Firebase UID"
                    />
                  </div>
                )}
              </TabsContent>
              <TabsContent value="browse" className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="grid gap-1">
                    <Label className="text-xs">Title contains</Label>
                    <Input value={filterTitle} onChange={(e) => setFilterTitle(e.target.value)} placeholder="Search…" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Student UID contains</Label>
                    <Input
                      value={filterStudentUid}
                      onChange={(e) => setFilterStudentUid(e.target.value)}
                      placeholder="e.g. abc123"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">From date</Label>
                    <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">To date</Label>
                    <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {listTab === "unsigned" && profile.role === "admin" ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-slate-900">Students not on any session roster</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Up to 80 alphabetically. Add them from a session’s roster or open user management.
                </p>
                {unsignedStudents.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Every active student appears on at least one session.</p>
                ) : (
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                    {unsignedStudents.map((u) => (
                      <li key={u.uid} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
                        <span>{u.name || u.email}</span>
                        <span className="font-mono text-xs text-muted-foreground">{u.uid}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/tutor/nclex/users">User management</Link>
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
            ) : listTab === "assigned" && assignedRowsForUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {profile.role === "admin"
                  ? "Select a student to see their assigned sessions."
                  : "Enter a student’s exact UID to see sessions they are on."}
              </p>
            ) : listTab === "upcoming" && upcomingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming scheduled sessions in this workspace.</p>
            ) : listTab === "unassigned" && unassignedRosterRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions with an empty roster.</p>
            ) : listTab === "browse" && filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions match these filters.</p>
            ) : listTab !== "unsigned" ? (
              listRowsToRender.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  profile={profile}
                  profileUid={profile.uid}
                  allUsers={allUsers}
                  allPresentations={allPresentations}
                  onChanged={() => void reload()}
                  templates={templates}
                />
              ))
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentRosterPicker({
  users,
  value,
  onChange,
  open,
  onOpenChange,
  disabled,
}: {
  users: UserListRow[];
  value: string[];
  onChange: (uids: string[]) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  disabled?: boolean;
}) {
  const students = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "student" &&
          u.accountStatus !== "disabled" &&
          u.accountStatus !== "disqualified" &&
          u.approvalStatus !== "rejected",
      ),
    [users],
  );
  const first10 = useMemo(() => students.slice(0, 10), [students]);
  const byId = useMemo(() => new Map(students.map((u) => [u.uid, u] as const)), [students]);

  const addUid = (uid: string) => {
    if (!uid || value.includes(uid)) return;
    onChange([...value, uid]);
  };
  const removeUid = (uid: string) => onChange(value.filter((x) => x !== uid));

  return (
    <div className="grid gap-2">
      <Label>Roster (students)</Label>
      <p className="text-xs text-muted-foreground">
        Search all students, or add from the first 10 below. Names come from user profiles.
      </p>
      <div className="flex flex-wrap gap-2">
        {first10.map((u) => (
          <Button
            key={u.uid}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || value.includes(u.uid)}
            onClick={() => addUid(u.uid)}
          >
            + {(u.name || u.email || u.uid).slice(0, 28)}
          </Button>
        ))}
      </div>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full max-w-xl justify-between"
            disabled={disabled}
          >
            Search students…
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search name or email…" />
            <CommandList>
              <CommandEmpty>No student found.</CommandEmpty>
              <CommandGroup heading="Students">
                {students.map((u) => (
                  <CommandItem
                    key={u.uid}
                    value={`${u.name} ${u.email} ${u.uid}`}
                    onSelect={() => {
                      addUid(u.uid);
                      onOpenChange(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value.includes(u.uid) ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.name || "—"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{u.uid}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-2">
        {value.map((uid) => {
          const u = byId.get(uid);
          return (
            <Badge key={uid} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
              <span className="max-w-[200px] truncate">{u?.name || u?.email || uid}</span>
              <button
                type="button"
                className="rounded px-1 hover:bg-slate-300/50"
                onClick={() => removeUid(uid)}
                aria-label="Remove"
              >
                ×
              </button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

function BankExtractPanel({
  blueprint,
  isGeneral,
  bankCategories,
  bankCategory,
  bankQuestions,
  extractSelected,
  extractTitle,
  bankBusy,
  onBankCategoryChange,
  onExtractTitleChange,
  onToggleQuestion,
  onSelectAllVisible,
  onClearSelection,
  onRefreshBanks,
  onLoadQuestions,
  onCreateExtractQuiz,
}: {
  blueprint: NclexBlueprintSelection;
  isGeneral: boolean;
  bankCategories: { category: string; count: number }[];
  bankCategory: string;
  bankQuestions: Question[];
  extractSelected: Set<string>;
  extractTitle: string;
  bankBusy: boolean;
  onBankCategoryChange: (c: string) => void;
  onExtractTitleChange: (t: string) => void;
  onToggleQuestion: (id: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onRefreshBanks: () => Promise<void>;
  onLoadQuestions: () => Promise<void>;
  onCreateExtractQuiz: () => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-sm font-semibold text-slate-900">Quizzes from question bank (bulk-import topics)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Uses the session blueprint above. Load test banks (categories), pick questions, then create a fixed quiz and attach
        it to this session.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={bankBusy} onClick={() => void onRefreshBanks()}>
          List test banks
        </Button>
        <select
          className="h-9 min-w-[200px] rounded-md border border-input bg-background px-2 text-sm"
          value={bankCategory}
          onChange={(e) => onBankCategoryChange(e.target.value)}
        >
          <option value="">— Test bank (category) —</option>
          {bankCategories.map((row) => (
            <option key={row.category} value={row.category}>
              {row.category} ({row.count})
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" disabled={bankBusy || !bankCategory} onClick={() => void onLoadQuestions()}>
          Load questions
        </Button>
      </div>
      {bankQuestions.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md"
              placeholder="New quiz title (e.g. Session pharmacology subset)"
              value={extractTitle}
              onChange={(e) => onExtractTitleChange(e.target.value)}
            />
            <Button type="button" size="sm" variant="outline" onClick={onSelectAllVisible}>
              Select all ({bankQuestions.length})
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClearSelection}>
              Clear
            </Button>
            <Button type="button" size="sm" className="bg-violet-600 hover:bg-violet-700" disabled={bankBusy} onClick={() => void onCreateExtractQuiz()}>
              Create quiz & select
            </Button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded border bg-white p-2">
            {bankQuestions.map((q) => (
              <label key={q.id} className="flex cursor-pointer gap-2 border-b border-slate-100 py-1 text-xs last:border-0 sm:text-sm">
                <input type="checkbox" checked={extractSelected.has(q.id)} onChange={() => onToggleQuestion(q.id)} />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-[10px] text-muted-foreground">{q.id.slice(0, 8)}…</span>{" "}
                  <span className="line-clamp-2">{q.title || q.questionText.slice(0, 120)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionRow({
  session: s,
  profile,
  profileUid,
  allUsers,
  allPresentations,
  onChanged,
  templates,
}: {
  session: TutoringSession;
  profile: AuthUserProfile;
  profileUid: string;
  allUsers: UserListRow[];
  allPresentations: ClassPresentation[];
  onChanged: () => void;
  templates: QuizTemplate[];
}) {
  const [busy, setBusy] = useState(false);
  const [blueprint, setBlueprint] = useState<NclexBlueprintSelection>(() =>
    matchBlueprintIdsFromLabels(s.nclexCategory, s.nclexTopic, s.nclexSubtopic),
  );
  const [title, setTitle] = useState(s.title);
  const [description, setDescription] = useState(s.description);
  const [rosterEd, setRosterEd] = useState<string[]>(s.assignedStudentIds);
  const [tutorRosterRaw, setTutorRosterRaw] = useState(s.assignedStudentIds.join("\n"));
  const [presEd, setPresEd] = useState<Set<string>>(() => new Set(s.presentationIds ?? []));
  const [rowPickerOpen, setRowPickerOpen] = useState(false);

  useEffect(() => {
    setTitle(s.title);
    setDescription(s.description);
    setRosterEd(s.assignedStudentIds);
    setTutorRosterRaw(s.assignedStudentIds.join("\n"));
    setPresEd(new Set(s.presentationIds ?? []));
    setBlueprint(matchBlueprintIdsFromLabels(s.nclexCategory, s.nclexTopic, s.nclexSubtopic));
  }, [s]);

  const parsedTutorIds = useMemo(
    () =>
      tutorRosterRaw
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    [tutorRosterRaw],
  );

  const saveMeta = async () => {
    setBusy(true);
    try {
      const lb = labelsFromBlueprintSelection(blueprint);
      const assignedStudentIds = profile.role === "admin" ? rosterEd : parsedTutorIds;
      await updateTutoringSession(s.id, {
        title,
        description,
        nclexCategory: lb.nclexCategory,
        nclexTopic: lb.nclexTopic,
        nclexSubtopic: lb.nclexSubtopic,
        assignedStudentIds,
        presentationIds: Array.from(presEd),
      });
      toast.success("Session updated");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      await publishAndAssignTutoringSession(s.id, profileUid);
      toast.success("Published and quizzes assigned");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm("Delete this tutoring session? Quiz assignments stay in place.")) return;
    setBusy(true);
    try {
      await deleteTutoringSession(s.id);
      toast.success("Deleted");
      onChanged();
    } catch {
      toast.error("Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const templateTitles = new Map(templates.map((t) => [t.id, t.title]));
  const canEdit = !s.locked || profile.role === "admin";
  const schedLabel =
    s.scheduledAt?.toDate?.() != null
      ? s.scheduledAt.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : null;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{s.title}</p>
          <p className="text-xs text-muted-foreground">
            {s.published ? "Published" : "Draft"}
            {s.locked ? (
              <>
                {" "}
                ·{" "}
                <span className="inline-flex items-center gap-0.5 font-medium text-amber-800">
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              </>
            ) : null}{" "}
            · {s.templateIds.length} quiz(s) · {(s.presentationIds ?? []).length} deck(s) · {s.assignedStudentIds.length}{" "}
            student(s)
            {s.examType ? ` · ${s.examType.toUpperCase()}` : ""}
            {schedLabel ? ` · Scheduled ${schedLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" className="gap-1" asChild>
            <Link href={`/tutor/nclex/tutoring-sessions/${s.id}`}>
              <Settings2 className="h-4 w-4" />
              Session hub
            </Link>
          </Button>
          {!s.published ? (
            <Button
              type="button"
              size="sm"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={busy || !canEdit}
              onClick={() => void publish()}
            >
              Publish & assign
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy || !canEdit} onClick={() => void publish()}>
              Re-sync assignments
            </Button>
          )}
          <Button type="button" size="sm" variant="destructive" disabled={busy || !canEdit} onClick={() => void del()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 text-sm">
        {!canEdit ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            This session is locked. Ask an admin to unlock it before editing from this list, or use the session hub if you are
            an admin.
          </p>
        ) : null}
        <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
        <NclexBlueprintSelects idPrefix={`ed-${s.id}`} value={blueprint} onChange={setBlueprint} disabled={busy || !canEdit} />
        {profile.role === "admin" ? (
          <StudentRosterPicker
            users={allUsers}
            value={rosterEd}
            onChange={setRosterEd}
            open={rowPickerOpen}
            onOpenChange={setRowPickerOpen}
            disabled={busy || !canEdit}
          />
        ) : (
          <Textarea
            rows={2}
            className="font-mono text-xs"
            value={tutorRosterRaw}
            onChange={(e) => setTutorRosterRaw(e.target.value)}
            disabled={!canEdit}
          />
        )}
        <div className="grid gap-2">
          <Label className="text-xs font-medium">Presentations</Label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded border bg-white p-2">
            {allPresentations.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              allPresentations.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={presEd.has(p.id)}
                    disabled={!canEdit}
                    onChange={() =>
                      setPresEd((prev) => {
                        const n = new Set(prev);
                        if (n.has(p.id)) n.delete(p.id);
                        else n.add(p.id);
                        return n;
                      })
                    }
                  />
                  <span className="truncate">{p.title}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={busy || !canEdit} onClick={() => void saveMeta()}>
          Save roster & tags
        </Button>
        <div className="text-xs text-muted-foreground">
          Quizzes: {s.templateIds.map((id) => templateTitles.get(id) ?? id.slice(0, 8)).join(", ") || "—"}
        </div>
      </div>
    </div>
  );
}

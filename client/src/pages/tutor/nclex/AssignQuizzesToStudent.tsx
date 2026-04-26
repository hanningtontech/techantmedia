import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import {
  assignQuizTemplateToStudent,
  createQuizTemplate,
  getQuestionCategorySummaries,
  listAssignedTemplateIds,
  listQuizTemplatesForEditor,
  getStudentQuizzes,
  linkSessionToTemplate,
  unassignQuizTemplateFromStudent,
} from "@/lib/firestore/nclex";
import type { QuizSession, QuizTemplate } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList } from "lucide-react";

const PAGE_CACHE_KEY = "nclex_assign_quizzes_page_cache_v1";

export default function AssignQuizzesToStudent() {
  const { studentId } = useParams() as { studentId: string };
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quizLoadErr, setQuizLoadErr] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [linkSessionId, setLinkSessionId] = useState<string>("");
  const [linkTemplateId, setLinkTemplateId] = useState<string>("");

  const reload = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    const [all, ids, cats, sess] = await Promise.all([
      listQuizTemplatesForEditor({ tutorUid: profile.uid, isAdmin: profile.role === "admin" }),
      listAssignedTemplateIds(studentId),
      getQuestionCategorySummaries(),
      getStudentQuizzes(studentId),
    ]);
    setTemplates(all);
    setAssigned(ids);
    setCategories(cats);
    setSessions(sess);
    setQuizLoadErr(null);
    try {
      sessionStorage.setItem(
        `${PAGE_CACHE_KEY}:${studentId}`,
        JSON.stringify({ at: Date.now(), templates: all, assigned: Array.from(ids), categories: cats, sessions: sess }),
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!studentId || !profile || loading || !isTutorOrAdmin(profile)) return;
    // Warm from cache for instant UI on revisit
    try {
      const cached = sessionStorage.getItem(`${PAGE_CACHE_KEY}:${studentId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          templates: QuizTemplate[];
          assigned: string[];
          categories: Array<{ category: string; count: number }>;
          sessions: QuizSession[];
        };
        if (Array.isArray(parsed.templates)) setTemplates(parsed.templates);
        if (Array.isArray(parsed.assigned)) setAssigned(new Set(parsed.assigned));
        if (Array.isArray(parsed.categories)) setCategories(parsed.categories);
        if (Array.isArray(parsed.sessions)) setSessions(parsed.sessions);
      }
    } catch {
      // ignore
    }
    void reload().catch((e) => {
      setQuizLoadErr(e instanceof Error ? e.message : "Could not load quizzes");
      toast.error("Could not load quizzes");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, profile, loading]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return templates;
    return templates.filter(
      (x) =>
        x.title.toLowerCase().includes(t) ||
        x.description.toLowerCase().includes(t) ||
        (x.filterCategory ?? "").toLowerCase().includes(t),
    );
  }, [templates, q]);

  const templateOptions = useMemo(() => {
    const active = templates.filter((t) => t.isActive);
    return active.length ? active : templates;
  }, [templates]);

  const sessionOptions = useMemo(() => {
    return sessions
      .filter((s) => s.status === "submitted" || s.status === "reviewed")
      .slice(0, 50);
  }, [sessions]);

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  if (!studentId) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Missing student id.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/tutor/nclex/users")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-4xl space-y-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex/users")}>
              <ArrowLeft className="h-4 w-4" />
              Users
            </Button>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-orange-600" />
              <h1 className="text-2xl font-bold text-gray-900">Assign quizzes</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student</CardTitle>
            <CardDescription className="break-all">Student id: {studentId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Loaded quizzes: <span className="font-medium">{templates.length}</span> · Categories:{" "}
              <span className="font-medium">{categories.length}</span>
              {quizLoadErr ? <span className="text-red-600"> · {quizLoadErr}</span> : null}
            </div>

            <div className="rounded-md border bg-white p-3 space-y-2">
              <p className="text-sm font-semibold">Quick assign</p>
              <p className="text-xs text-muted-foreground">
                Assign a quiz template directly, or choose a question-bank category to auto-create a category quiz and assign it.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 min-w-[240px] rounded-md border px-2 text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Category…</option>
                  {categories.map((c) => (
                    <option key={c.category} value={c.category}>
                      {c.category} ({c.count})
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 min-w-[240px] rounded-md border px-2 text-sm"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="">Quiz…</option>
                  {templateOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={Boolean(busyId) || (!selectedCategory && !selectedTemplate)}
                  onClick={() => {
                    if (!profile) return;
                    setBusyId("assign");
                    void (async () => {
                      let tid = selectedTemplate;
                      if (!tid && selectedCategory) {
                        const existing =
                          templateOptions.find(
                            (t) =>
                              (t.filterCategory ?? "").trim().toLowerCase() === selectedCategory.toLowerCase() &&
                              t.questionLimit === 0,
                          ) ?? null;
                        if (existing) tid = existing.id;
                        else {
                          tid = await createQuizTemplate(
                            {
                              title: `${selectedCategory} quiz`,
                              description: `Auto-created from category assignment (${selectedCategory}).`,
                              filterCategory: selectedCategory,
                              questionLimit: 0,
                              estimatedMinutes: null,
                              sortOrder: 0,
                              isActive: true,
                            },
                            profile.uid,
                          );
                        }
                      }
                      await assignQuizTemplateToStudent(studentId, tid, profile.uid);
                      await reload();
                      setSelectedCategory("");
                      setSelectedTemplate("");
                      toast.success("Assigned");
                    })()
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Assign failed"))
                      .finally(() => setBusyId(null));
                  }}
                >
                  Assign
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-white p-3 space-y-2">
              <p className="text-sm font-semibold">Link past attempt to a quiz</p>
              <p className="text-xs text-muted-foreground">
                If this student completed quizzes before assignments existed, you can attach an old attempt to a quiz template so it appears as Done.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 min-w-[320px] rounded-md border px-2 text-sm"
                  value={linkSessionId}
                  onChange={(e) => setLinkSessionId(e.target.value)}
                >
                  <option value="">Select attempt…</option>
                  {sessionOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.quizTitle ?? "Quiz"} · {s.status} · {s.submittedAt ? "submitted" : "started"} · {s.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 min-w-[240px] rounded-md border px-2 text-sm"
                  value={linkTemplateId}
                  onChange={(e) => setLinkTemplateId(e.target.value)}
                >
                  <option value="">Target quiz…</option>
                  {templateOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busyId) || !linkSessionId || !linkTemplateId}
                  onClick={() => {
                    setBusyId("link");
                    void linkSessionToTemplate(linkSessionId, linkTemplateId)
                      .then(() => reload())
                      .then(() => {
                        toast.success("Attempt linked.");
                        setLinkSessionId("");
                        setLinkTemplateId("");
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Link failed"))
                      .finally(() => setBusyId(null));
                  }}
                >
                  Link attempt
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={Boolean(busyId) || !linkSessionId}
                  onClick={() => {
                    if (!confirm("Unlink this attempt from any quiz template?")) return;
                    setBusyId("unlink");
                    void linkSessionToTemplate(linkSessionId, null)
                      .then(() => reload())
                      .then(() => toast.success("Unlinked."))
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Unlink failed"))
                      .finally(() => setBusyId(null));
                  }}
                >
                  Unlink
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Search quizzes</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, category, description…" />
            </div>
            <div className="rounded-lg border bg-white overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-3">Quiz</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Active</th>
                    <th className="p-3">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const isAssigned = assigned.has(t.id);
                    return (
                      <tr key={t.id} className="border-t align-top">
                        <td className="p-3">
                          <p className="font-medium">{t.title}</p>
                          {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                          <p className="text-[11px] text-muted-foreground break-all pt-1">id: {t.id}</p>
                        </td>
                        <td className="p-3">{t.filterCategory ?? "All topics"}</td>
                        <td className="p-3">{t.isActive ? "Yes" : "No"}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={isAssigned}
                              disabled={busyId === t.id}
                              onCheckedChange={(next) => {
                                if (!profile) return;
                                setBusyId(t.id);
                                void (next
                                  ? assignQuizTemplateToStudent(studentId, t.id, profile.uid)
                                  : unassignQuizTemplateFromStudent(studentId, t.id))
                                  .then(() => {
                                    setAssigned((prev) => {
                                      const n = new Set(prev);
                                      if (next) n.add(t.id);
                                      else n.delete(t.id);
                                      return n;
                                    });
                                    toast.success(next ? "Assigned" : "Unassigned");
                                  })
                                  .catch((e) => toast.error(e instanceof Error ? e.message : "Save failed"))
                                  .finally(() => setBusyId(null));
                              }}
                            />
                            <span className="text-xs text-muted-foreground">{isAssigned ? "Assigned" : "Not assigned"}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={4}>
                        No quizzes match your search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


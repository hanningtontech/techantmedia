import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { useNclexAdminExamType } from "@/hooks/useNclexAdminExamType";
import {
  countQuestionsForQuizTemplate,
  createQuizTemplate,
  deleteQuizTemplate,
  getQuestionCategorySummaries,
  listQuizTemplatesForEditor,
  updateQuizTemplate,
} from "@/lib/firestore/nclex";
import type { NclexContentKind, NclexExamType, QuizTemplate } from "@/lib/firestore/nclexTypes";
import type { NursingTrack } from "@/lib/userTypes";
import { NCLEX_CONTENT_CATALOG } from "@/lib/nclex/nclexCatalogHierarchy";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";

function catalogIdsFromLabels(catLabel?: string, topicLabel?: string, subLabel?: string): {
  catId: string;
  topicId: string;
  subId: string;
} {
  const cL = (catLabel ?? "").trim();
  const tL = (topicLabel ?? "").trim();
  const sL = (subLabel ?? "").trim();
  if (!cL) return { catId: "", topicId: "", subId: "" };
  const cat = NCLEX_CONTENT_CATALOG.find((c) => c.label === cL);
  if (!cat) return { catId: "", topicId: "", subId: "" };
  if (!tL) return { catId: cat.id, topicId: "", subId: "" };
  const top = cat.topics.find((t) => t.label === tL);
  if (!top) return { catId: cat.id, topicId: "", subId: "" };
  const sub = sL ? top.subtopics.find((s) => s.label === sL) : null;
  return { catId: cat.id, topicId: top.id, subId: sub?.id ?? "" };
}

export default function QuizManagement() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const { adminExamType } = useNclexAdminExamType();
  const [items, setItems] = useState<QuizTemplate[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [questionLimit, setQuestionLimit] = useState("0");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [examType, setExamType] = useState<NclexExamType | "">("");
  const [contentKind, setContentKind] = useState<NclexContentKind | "">("");
  const [catId, setCatId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subId, setSubId] = useState("");
  const [isGeneral, setIsGeneral] = useState(false);

  const category = useMemo(() => NCLEX_CONTENT_CATALOG.find((c) => c.id === catId) ?? null, [catId]);
  const topic = useMemo(() => category?.topics.find((x) => x.id === topicId) ?? null, [category, topicId]);

  const reload = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    const [list, cats] = await Promise.all([
      listQuizTemplatesForEditor({
        tutorUid: profile.uid,
        isAdmin: profile.role === "admin",
        adminExamType,
      }),
      getQuestionCategorySummaries(),
    ]);
    setItems(list);
    setCategories(cats);
  };

  useEffect(() => {
    if (!loading && profile && isTutorOrAdmin(profile)) {
      void reload().catch(() => toast.error("Failed to load quizzes"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile, adminExamType]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setFilterCategory("");
    setQuestionLimit("0");
    setEstimatedMinutes("");
    setSortOrder("0");
    setIsActive(true);
    setExamType("");
    setContentKind("");
    setCatId("");
    setTopicId("");
    setSubId("");
    setIsGeneral(false);
  };

  const startEdit = (t: QuizTemplate) => {
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description);
    setFilterCategory(t.filterCategory ?? "");
    setQuestionLimit(String(t.questionLimit ?? 0));
    setEstimatedMinutes(t.estimatedMinutes != null ? String(t.estimatedMinutes) : "");
    setSortOrder(String(t.sortOrder ?? 0));
    setIsActive(t.isActive);
    setExamType(t.examType ?? "");
    setContentKind(t.contentKind ?? "");
    setIsGeneral(t.isGeneral === true);
    const ids = catalogIdsFromLabels(t.nclexCategory, t.nclexTopic, t.nclexSubtopic);
    setCatId(ids.catId);
    setTopicId(ids.topicId);
    setSubId(ids.subId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !isTutorOrAdmin(profile)) return;
    if (!adminExamType) {
      toast.error("Select NCLEX-RN or NCLEX-PN on the tutor dashboard first.");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const lim = Math.max(0, parseInt(questionLimit, 10) || 0);
    const sort = parseInt(sortOrder, 10) || 0;
    const est = estimatedMinutes.trim() ? Math.max(1, parseInt(estimatedMinutes, 10) || 0) : null;
    const ex: NclexExamType =
      examType === "rn" || examType === "pn" || examType === "both" ? examType : adminExamType === "rn" ? "rn" : "pn";

    setBusy(true);
    try {
      const nclexSubtopicLabel = topic?.subtopics.find((s) => s.id === subId)?.label ?? "";
      const hierarchy = {
        nclexCategory: category?.label ?? "",
        nclexTopic: topic?.label ?? "",
        nclexSubtopic: nclexSubtopicLabel,
        isGeneral,
      };
      if (editingId) {
        await updateQuizTemplate(editingId, {
          title: title.trim(),
          description: description.trim(),
          filterCategory: filterCategory.trim() || null,
          questionLimit: lim,
          estimatedMinutes: est,
          sortOrder: sort,
          isActive,
          examType: ex,
          ...hierarchy,
          contentKind: contentKind || null,
        });
        toast.success("Quiz updated");
      } else {
        await createQuizTemplate(
          {
            title: title.trim(),
            description: description.trim(),
            filterCategory: filterCategory.trim() || null,
            questionLimit: lim,
            estimatedMinutes: est,
            sortOrder: sort,
            isActive,
            examType: ex,
            ...hierarchy,
            contentKind: contentKind || undefined,
          },
          profile.uid,
        );
        toast.success("Quiz added");
      }
      resetForm();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this quiz from the catalog? Students will no longer see it.")) return;
    setBusy(true);
    try {
      await deleteQuizTemplate(id);
      if (editingId === id) resetForm();
      toast.success("Deleted");
      await reload();
    } catch {
      toast.error("Delete failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-4xl space-y-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-orange-600" />
              <h1 className="text-2xl font-bold text-gray-900">Quiz catalog</h1>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/tutor/nclex/questions">Question bank</Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Quizzes appear on the student NCLEX home when marked active. Each quiz uses your question bank: pick a category
          or leave category empty for all topics, then optionally cap how many questions load in one attempt. Choose your
          NCLEX workspace on the tutor dashboard so new items are tagged RN or PN.
        </p>

        {!adminExamType ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="py-4">
              <CardTitle className="text-base">Select your NCLEX workspace</CardTitle>
              <CardDescription>
                Open the tutor dashboard and choose <strong>NCLEX-RN</strong> or <strong>NCLEX-PN</strong> before creating
                or editing quizzes.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" />
              {editingId ? "Edit quiz" : "Add a quiz"}
            </CardTitle>
            <CardDescription>
              {editingId ? "Update the fields below, then save." : "Create a named quiz students can start with one click."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="qz-title">Title</Label>
                <Input id="qz-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pharmacology — 30 Q" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qz-desc">Description (optional)</Label>
                <Textarea id="qz-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note for students" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qz-exam">Exam type (quiz track)</Label>
                  <select
                    id="qz-exam"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as NclexExamType | "")}
                  >
                    <option value="">Match workspace ({adminExamType?.toUpperCase() ?? "—"})</option>
                    <option value="rn">NCLEX-RN only</option>
                    <option value="pn">NCLEX-PN only</option>
                    <option value="both">Both RN and PN</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qz-kind">Content kind (optional)</Label>
                  <select
                    id="qz-kind"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={contentKind}
                    onChange={(e) => setContentKind(e.target.value as NclexContentKind | "")}
                  >
                    <option value="">Quiz (default)</option>
                    <option value="exam">Exam</option>
                    <option value="notes">Notes</option>
                    <option value="presentation">Presentation</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qz-ncat">NCLEX category</Label>
                  <select
                    id="qz-ncat"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={catId}
                    onChange={(e) => {
                      setCatId(e.target.value);
                      setTopicId("");
                      setSubId("");
                    }}
                  >
                    <option value="">—</option>
                    {NCLEX_CONTENT_CATALOG.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qz-ntopic">Topic</Label>
                  <select
                    id="qz-ntopic"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={topicId}
                    disabled={!category}
                    onChange={(e) => {
                      setTopicId(e.target.value);
                      setSubId("");
                    }}
                  >
                    <option value="">—</option>
                    {(category?.topics ?? []).map((top) => (
                      <option key={top.id} value={top.id}>
                        {top.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qz-nsub">Subtopic</Label>
                  <select
                    id="qz-nsub"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={subId}
                    disabled={!topic}
                    onChange={(e) => setSubId(e.target.value)}
                  >
                    <option value="">—</option>
                    {(topic?.subtopics ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="qz-general" type="checkbox" checked={isGeneral} onChange={(e) => setIsGeneral(e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="qz-general" className="font-normal">
                  General (cross-topic; still respects exam type)
                </Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qz-cat">Category filter</Label>
                  <select
                    id="qz-cat"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="">All topics (every active question)</option>
                    {categories.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.category} ({c.count} in bank)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qz-limit">Question cap (0 = no cap)</Label>
                  <Input
                    id="qz-limit"
                    type="number"
                    min={0}
                    value={questionLimit}
                    onChange={(e) => setQuestionLimit(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">After filtering by category, take at most this many questions.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qz-est">Estimated minutes (optional)</Label>
                  <Input
                    id="qz-est"
                    type="number"
                    min={1}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    placeholder="Auto from question count"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qz-sort">Sort order</Label>
                  <Input id="qz-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Lower numbers appear first on the student page.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="qz-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="qz-active" className="font-normal">
                  Active (visible to students)
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy} className="bg-orange-600 hover:bg-orange-700">
                  {editingId ? "Save changes" : "Add quiz"}
                </Button>
                {editingId ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={resetForm}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your quizzes</CardTitle>
            <CardDescription>Students see active quizzes on /student/nclex/dashboard (after choosing RN or PN).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quizzes yet. Add one above, or students will only see the default “by topic” cards.</p>
            ) : (
              items.map((t) => (
                <QuizRow
                  key={t.id}
                  template={t}
                  adminExamType={adminExamType}
                  poolTutorUid={profile.uid}
                  poolIsAdmin={profile.role === "admin"}
                  busy={busy}
                  onEdit={() => startEdit(t)}
                  onDelete={() => void onDelete(t.id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuizRow({
  template: t,
  adminExamType,
  poolTutorUid,
  poolIsAdmin,
  busy,
  onEdit,
  onDelete,
}: {
  template: QuizTemplate;
  adminExamType: NursingTrack | null;
  poolTutorUid: string;
  poolIsAdmin: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pool, setPool] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void countQuestionsForQuizTemplate(t, {
      studentTrack: adminExamType,
      tutorUid: poolTutorUid,
      isAdmin: poolIsAdmin,
    }).then((n) => {
      if (!cancelled) setPool(n);
    });
    return () => {
      cancelled = true;
    };
  }, [t.id, t.filterCategory, t.questionLimit, t.examType, t.fixedQuestionIds, adminExamType, poolTutorUid, poolIsAdmin]);

  const trackLabel =
    t.examType === "rn" ? "RN" : t.examType === "pn" ? "PN" : t.examType === "both" ? "RN+PN" : "Any track";

  const minutes =
    t.estimatedMinutes != null && t.estimatedMinutes > 0
      ? t.estimatedMinutes
      : pool != null
        ? Math.max(1, Math.ceil(pool * 1.2))
        : "—";

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
        t.isActive ? "border-gray-200 bg-white" : "border-dashed border-gray-300 bg-gray-50 opacity-80"
      }`}
    >
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-gray-900">{t.title}</p>
        {t.description ? <p className="text-sm text-muted-foreground">{t.description}</p> : null}
        <p className="text-xs text-muted-foreground">
          Track: {trackLabel}
          {t.nclexCategory ? ` · ${t.nclexCategory}` : ""}
          {t.isGeneral ? " · General" : ""}
          {" · "}
          {t.filterCategory ? `Bank category: ${t.filterCategory}` : "All bank categories"}
          {" · "}
          {pool != null ? `${pool} questions` : "…"}
          {" · ~"}
          {minutes}
          {typeof minutes === "number" ? " min" : ""}
          {!t.isActive ? " · Hidden" : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

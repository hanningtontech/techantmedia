import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import {
  countQuizQuestionPool,
  createQuizTemplate,
  deleteQuizTemplate,
  getQuestionCategorySummaries,
  listQuizTemplatesForEditor,
  updateQuizTemplate,
} from "@/lib/firestore/nclex";
import type { QuizTemplate } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";

export default function QuizManagement() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
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

  const reload = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    const [list, cats] = await Promise.all([
      listQuizTemplatesForEditor({ tutorUid: profile.uid, isAdmin: profile.role === "admin" }),
      getQuestionCategorySummaries(),
    ]);
    setItems(list);
    setCategories(cats);
  };

  useEffect(() => {
    if (!loading && profile && isTutorOrAdmin(profile)) {
      void reload().catch(() => toast.error("Failed to load quizzes"));
    }
  }, [loading, profile]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setFilterCategory("");
    setQuestionLimit("0");
    setEstimatedMinutes("");
    setSortOrder("0");
    setIsActive(true);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !isTutorOrAdmin(profile)) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const lim = Math.max(0, parseInt(questionLimit, 10) || 0);
    const sort = parseInt(sortOrder, 10) || 0;
    const est = estimatedMinutes.trim() ? Math.max(1, parseInt(estimatedMinutes, 10) || 0) : null;

    setBusy(true);
    try {
      if (editingId) {
        await updateQuizTemplate(editingId, {
          title: title.trim(),
          description: description.trim(),
          filterCategory: filterCategory.trim() || null,
          questionLimit: lim,
          estimatedMinutes: est,
          sortOrder: sort,
          isActive,
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
          or leave category empty for all topics, then optionally cap how many questions load in one attempt.
        </p>

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
            <CardDescription>Students see active quizzes on /student/nclex</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quizzes yet. Add one above, or students will only see the default “by topic” cards.</p>
            ) : (
              items.map((t) => (
                <QuizRow key={t.id} template={t} busy={busy} onEdit={() => startEdit(t)} onDelete={() => void onDelete(t.id)} />
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
  busy,
  onEdit,
  onDelete,
}: {
  template: QuizTemplate;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pool, setPool] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void countQuizQuestionPool(t.filterCategory, t.questionLimit > 0 ? t.questionLimit : null).then((n) => {
      if (!cancelled) setPool(n);
    });
    return () => {
      cancelled = true;
    };
  }, [t.filterCategory, t.questionLimit]);

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
          {t.filterCategory ? `Category: ${t.filterCategory}` : "All topics"}
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

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import {
  deleteQuizTemplate,
  getQuestionCategorySummaries,
  listQuizTemplatesForEditor,
  setQuizTemplateActive,
} from "@/lib/firestore/nclex";
import type { QuizTemplate } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, LayoutList } from "lucide-react";

const CATALOG_CACHE_KEY = "nclex_admin_catalog_cache_v1";

export default function AdminCatalogControl() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    if (!profile || !isTutorOrAdmin(profile) || profile.role !== "admin") return;
    const [t, c] = await Promise.all([
      listQuizTemplatesForEditor({ tutorUid: profile.uid, isAdmin: true }),
      getQuestionCategorySummaries(),
    ]);
    setTemplates(t);
    setCategories(c);
    try {
      sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ at: Date.now(), templates: t, categories: c }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!profile || loading || profile.role !== "admin") return;
    // Warm from cache for quicker first paint.
    try {
      const cached = sessionStorage.getItem(CATALOG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          templates: QuizTemplate[];
          categories: Array<{ category: string; count: number }>;
        };
        if (Array.isArray(parsed.templates)) setTemplates(parsed.templates);
        if (Array.isArray(parsed.categories)) setCategories(parsed.categories);
      }
    } catch {
      // ignore
    }
    void reload().catch(() => toast.error("Could not load catalog"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading]);

  const activeTemplates = useMemo(() => templates.filter((t) => t.isActive), [templates]);
  const inactiveTemplates = useMemo(() => templates.filter((t) => !t.isActive), [templates]);

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }
  if (profile.role !== "admin") {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">This page is only available to administrators.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/tutor/nclex")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-5xl space-y-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutList className="h-5 w-5" />
              Quiz catalog (admin)
            </CardTitle>
            <CardDescription>Disable or delete quizzes. Disabled quizzes won’t be assignable to students.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-medium">{templates.length}</span> · Active:{" "}
              <span className="font-medium">{activeTemplates.length}</span> · Disabled:{" "}
              <span className="font-medium">{inactiveTemplates.length}</span>
            </div>
            <div className="rounded-lg border bg-white overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-3">Quiz</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Limit</th>
                    <th className="p-3">Active</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-t align-top">
                      <td className="p-3">
                        <p className="font-medium">{t.title}</p>
                        {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                        <p className="text-[11px] text-muted-foreground break-all pt-1">id: {t.id}</p>
                      </td>
                      <td className="p-3">{t.filterCategory ?? "All topics"}</td>
                      <td className="p-3">{t.questionLimit ?? 0}</td>
                      <td className="p-3">{t.isActive ? "Yes" : "No"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === t.id}
                            onClick={() => {
                              setBusy(t.id);
                              void setQuizTemplateActive(t.id, !t.isActive)
                                .then(() => reload())
                                .then(() => toast.success(t.isActive ? "Quiz disabled" : "Quiz enabled"))
                                .catch((e) => toast.error(e instanceof Error ? e.message : "Save failed"))
                                .finally(() => setBusy(null));
                            }}
                          >
                            {t.isActive ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy === t.id}
                            onClick={() => {
                              if (!confirm(`Delete quiz "${t.title}"?`)) return;
                              setBusy(t.id);
                              void deleteQuizTemplate(t.id)
                                .then(() => reload())
                                .then(() => toast.success("Quiz deleted"))
                                .catch((e) => toast.error(e instanceof Error ? e.message : "Delete failed"))
                                .finally(() => setBusy(null));
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        No quizzes yet. Create them in{" "}
                        <Link className="underline" href="/tutor/nclex/quizzes">
                          Manage quizzes
                        </Link>
                        .
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Question bank categories
            </CardTitle>
            <CardDescription>
              Categories shown to students when you assign by category. To disable/delete individual questions, use the{" "}
              <Link className="underline" href="/tutor/nclex/questions">
                question bank
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-white overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Questions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.category} className="border-t">
                      <td className="p-3 font-medium">{c.category}</td>
                      <td className="p-3 tabular-nums">{c.count}</td>
                    </tr>
                  ))}
                  {categories.length === 0 ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={2}>
                        No categories found (no active questions).
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


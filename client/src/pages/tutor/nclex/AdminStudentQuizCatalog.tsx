import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { countQuizQuestionPool, listPublishedQuizTemplates } from "@/lib/firestore/nclex";
import type { QuizTemplate } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Clock, Eye, ListPlus, Upload } from "lucide-react";

function categoryQuery(cat: string | null | undefined): string {
  const c = cat?.trim();
  if (!c) return "";
  return `?category=${encodeURIComponent(c)}`;
}

export default function AdminStudentQuizCatalog() {
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [pools, setPools] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        const tmpl = await listPublishedQuizTemplates();
        if (cancelled) return;
        setTemplates(tmpl);
        const pairs = await Promise.all(
          tmpl.map(async (t) => {
            const n = await countQuizQuestionPool(t.filterCategory, t.questionLimit > 0 ? t.questionLimit : null);
            return [t.id, n] as const;
          }),
        );
        if (!cancelled) setPools(Object.fromEntries(pairs));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load quizzes");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const minutesByTemplate = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) {
      const pool = pools[t.id] ?? 0;
      const minutes =
        t.estimatedMinutes != null && t.estimatedMinutes > 0
          ? t.estimatedMinutes
          : Math.max(1, Math.ceil(pool * 1.2));
      m.set(t.id, minutes);
    }
    return m;
  }, [templates, pools]);

  if (loading) {
    return (
      <div className="container py-16 text-muted-foreground">
        <p>Loading…</p>
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="container max-w-lg py-16">
        <Card>
          <CardHeader>
            <CardTitle>Admin only</CardTitle>
            <CardDescription>This preview matches the student quiz cards for published (active) templates.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/tutor/nclex")}>
              Tutor dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="nclex-app min-h-screen bg-gradient-to-b from-slate-50/80 to-white">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Tutor dashboard
        </Button>

        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
            style={{ backgroundColor: "var(--nclex-primary)" }}
          >
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Quizzes (student view)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Active templates students can be assigned — same layout as the student home. Open a quiz to review every
              item with the <span className="font-medium">answer key applied</span>, then add questions or bulk import in
              that quiz&apos;s category.
            </p>
          </div>
        </div>

        {busy ? (
          <p className="text-sm text-slate-600">Loading published quizzes…</p>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No active quiz templates. Activate or create one under Manage quizzes.
            </CardContent>
          </Card>
        ) : (
          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Published quizzes</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => {
                const pool = pools[t.id] ?? 0;
                const minutes = minutesByTemplate.get(t.id) ?? 1;
                const catLabel = t.filterCategory?.trim() || "All categories";
                const q = categoryQuery(t.filterCategory);
                return (
                  <motion.div key={t.id} whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
                    <Card className="nclex-card nclex-card-interactive h-full border-[var(--nclex-border)] shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {t.description ? <span className="mb-2 block text-gray-600">{t.description}</span> : null}
                          <span className="flex flex-wrap items-center gap-2 text-gray-700">
                            <Clock className="h-4 w-4 shrink-0" />
                            {pool} questions in pool · ~{minutes} min
                          </span>
                          <span className="mt-2 block text-xs font-medium text-slate-700">
                            Category filter: <span className="text-slate-900">{catLabel}</span>
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2">
                        <Button className="nclex-btn-primary w-full" asChild>
                          <Link href={`/tutor/nclex/student-preview/${t.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Open (answer key)
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full" asChild>
                          <Link href={`/tutor/nclex/questions${q}`}>
                            <ListPlus className="mr-2 h-4 w-4" />
                            Add question in category
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full" asChild>
                          <Link href={`/tutor/nclex/bulk-import${q}${q ? "&" : "?"}templateId=${encodeURIComponent(t.id)}`}>
                            <Upload className="mr-2 h-4 w-4" />
                            Bulk additional (add questions)
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

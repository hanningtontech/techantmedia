import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { NCLEX_CONTENT_CATALOG } from "@/lib/nclex/nclexCatalogHierarchy";
import { listPublishedClassNotes, type ClassNote } from "@/lib/firestore/classNotes";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { STUDENT_NCLEX_DASHBOARD } from "@/lib/nclex/studentNclexRoutes";
import { toast } from "sonner";
import { ArrowLeft, FileText } from "lucide-react";

export default function StudentNclexNotes() {
  useRedirectStudentIfPending();
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [rows, setRows] = useState<ClassNote[]>([]);
  const [q, setQ] = useState("");
  const [catId, setCatId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subId, setSubId] = useState("");

  const category = NCLEX_CONTENT_CATALOG.find((c) => c.id === catId) ?? null;
  const topic = category?.topics.find((t) => t.id === topicId) ?? null;

  useEffect(() => {
    if (!profile?.nursingTrack) return;
    const cat = NCLEX_CONTENT_CATALOG.find((c) => c.id === catId);
    const top = cat?.topics.find((t) => t.id === topicId);
    const sub = top?.subtopics.find((s) => s.id === subId);
    void (async () => {
      try {
        const list = await listPublishedClassNotes({
          studentTrack: profile.nursingTrack,
          category: cat?.label,
          topic: top?.label,
          subtopic: sub?.label,
          take: 120,
        });
        setRows(list);
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      }
    })();
  }, [profile?.nursingTrack, catId, topicId, subId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(t) ||
        r.description.toLowerCase().includes(t) ||
        r.body.toLowerCase().includes(t),
    );
  }, [rows, q]);

  if (loading || !profile) {
    return <div className="container py-12 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NclexHeader
        title="Class notes"
        subtitle="Study materials for your NCLEX track"
        homeHref={STUDENT_NCLEX_DASHBOARD}
        homeLabel="NCLEX Home"
      />
      <div className="container max-w-4xl space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid gap-1">
            <Label>Search</Label>
            <Input placeholder="Search titles or text…" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[200px]" />
          </div>
          <div className="grid gap-1">
            <Label>Category</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={catId}
              onChange={(e) => {
                setCatId(e.target.value);
                setTopicId("");
                setSubId("");
              }}
            >
              <option value="">All</option>
              {NCLEX_CONTENT_CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label>Topic</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={topicId}
              disabled={!category}
              onChange={(e) => {
                setTopicId(e.target.value);
                setSubId("");
              }}
            >
              <option value="">All</option>
              {category?.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label>Subtopic</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={subId}
              disabled={!topic}
              onChange={(e) => setSubId(e.target.value)}
            >
              <option value="">All</option>
              {topic?.subtopics.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes match your filters.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((note) => (
              <Card key={note.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    {note.title}
                  </CardTitle>
                  {note.description ? <CardDescription>{note.description}</CardDescription> : null}
                  <p className="text-xs text-muted-foreground">
                    {note.isGeneral
                      ? "General"
                      : [note.nclexCategory, note.nclexTopic, note.nclexSubtopic].filter(Boolean).join(" → ")}
                    {note.examType ? ` · ${note.examType.toUpperCase()}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border bg-white p-4 text-sm text-slate-800">
                    {note.body}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { useNclexAdminExamType } from "@/hooks/useNclexAdminExamType";
import { NCLEX_CONTENT_CATALOG, NCLEX_EXAM_LABELS } from "@/lib/nclex/nclexCatalogHierarchy";
import {
  createClassNote,
  deleteClassNote,
  listAllClassNotes,
  updateClassNote,
  type ClassNote,
} from "@/lib/firestore/classNotes";
import type { NclexExamType } from "@/lib/firestore/nclexTypes";
import { templateMatchesAdminSession } from "@/lib/nclex/examTypeFilters";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";

export default function AdminNclexNotes() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const { adminExamType } = useNclexAdminExamType();
  const [rows, setRows] = useState<ClassNote[]>([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [examType, setExamType] = useState<NclexExamType | "">("");
  const [catId, setCatId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subId, setSubId] = useState("");
  const [isGeneral, setIsGeneral] = useState(false);
  const [published, setPublished] = useState(false);

  const category = NCLEX_CONTENT_CATALOG.find((c) => c.id === catId) ?? null;
  const topic = category?.topics.find((t) => t.id === topicId) ?? null;

  const reload = async () => {
    const list = await listAllClassNotes({ limit: 200 });
    setRows(list);
  };

  useEffect(() => {
    if (!loading && profile && isTutorOrAdmin(profile)) {
      void reload().catch(() => toast.error("Failed to load notes"));
    }
  }, [loading, profile]);

  const filteredRows = useMemo(() => {
    if (!adminExamType) return rows;
    return rows.filter((r) => templateMatchesAdminSession(r.examType, adminExamType) || r.isGeneral);
  }, [rows, adminExamType]);

  const onSave = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    if (!adminExamType) {
      toast.error("Select NCLEX-RN or NCLEX-PN on the tutor dashboard first.");
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error("Title and note body are required");
      return;
    }
    const ex: NclexExamType =
      examType === "rn" || examType === "pn" || examType === "both" ? examType : adminExamType === "rn" ? "rn" : "pn";
    setBusy(true);
    try {
      await createClassNote({
        title: title.trim(),
        description: description.trim(),
        body: body.trim(),
        examType: ex,
        nclexCategory: category?.label ?? "",
        nclexTopic: topic?.label ?? "",
        nclexSubtopic: topic?.subtopics.find((s) => s.id === subId)?.label ?? "",
        isGeneral,
        published,
        createdBy: profile.uid,
      });
      toast.success("Note saved");
      setTitle("");
      setDescription("");
      setBody("");
      setIsGeneral(false);
      setPublished(false);
      await reload();
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-4xl space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        {!adminExamType ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-lg">Select your NCLEX workspace</CardTitle>
              <CardDescription>
                Open the tutor dashboard and choose <strong>NCLEX-RN</strong> or <strong>NCLEX-PN</strong> before creating
                notes.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <p className="text-sm text-slate-600">
            Workspace: <span className="font-semibold">{NCLEX_EXAM_LABELS[adminExamType].title}</span> — notes default to
            this track unless you pick &quot;Both tracks&quot; below.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              New class note
            </CardTitle>
            <CardDescription>Published notes appear to students on their track (and General applies broadly).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label>Exam type for this note</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={examType}
                  onChange={(e) => setExamType((e.target.value as NclexExamType | "") || "")}
                >
                  <option value="">Match my workspace ({adminExamType?.toUpperCase() ?? "—"})</option>
                  <option value="rn">NCLEX-RN only</option>
                  <option value="pn">NCLEX-PN only</option>
                  <option value="both">Both RN and PN</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="gen" checked={isGeneral} onCheckedChange={setIsGeneral} />
                <Label htmlFor="gen">General (cross-topic)</Label>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
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
                  <option value="">—</option>
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
                  <option value="">—</option>
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
                  <option value="">—</option>
                  {topic?.subtopics.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>Short description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>Note body</Label>
              <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="pub" checked={published} onCheckedChange={setPublished} />
              <Label htmlFor="pub">Published (visible to students)</Label>
            </div>
            <Button className="w-fit bg-blue-600 hover:bg-blue-700" disabled={busy} onClick={() => void onSave()}>
              Save note
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded notes</CardTitle>
            <CardDescription>{filteredRows.length} item(s) for current workspace filter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border bg-white">
                {filteredRows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.examType?.toUpperCase() ?? "—"} · {r.isGeneral ? "General" : [r.nclexCategory, r.nclexTopic, r.nclexSubtopic].filter(Boolean).join(" → ") || "—"}{" "}
                        · {r.published ? "Published" : "Draft"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void updateClassNote(r.id, { published: !r.published }).then(() => reload())
                        }
                      >
                        {r.published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => {
                          if (!confirm("Delete this note?")) return;
                          void deleteClassNote(r.id).then(() => {
                            toast.success("Deleted");
                            void reload();
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Switch RN/PN workspace on the{" "}
          <Link href="/tutor/nclex" className="underline">
            main tutor dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

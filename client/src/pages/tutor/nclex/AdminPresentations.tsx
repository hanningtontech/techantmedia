import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import {
  deletePresentation,
  listAllPresentations,
  setPresentationPublished,
  uploadClassPresentation,
  type ClassPresentation,
} from "@/lib/firestore/presentations";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Presentation, Trash2 } from "lucide-react";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const kb = 1024;
  const mb = kb * 1024;
  if (n >= mb) return `${(n / mb).toFixed(1)} MB`;
  if (n >= kb) return `${Math.round(n / kb)} KB`;
  return `${n} B`;
}

export default function AdminPresentations() {
  const [, navigate] = useLocation();
  const { firebaseReady, loading, profile } = useFirebaseAuth();

  const [rows, setRows] = useState<ClassPresentation[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [className, setClassName] = useState("");
  const [published, setPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const canUse = useMemo(() => Boolean(profile && isTutorOrAdmin(profile)), [profile]);

  const refresh = async () => {
    if (!firebaseReady) return;
    setRefreshing(true);
    try {
      const all = await listAllPresentations({ limit: 250 });
      setRows(all);
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  const onUpload = async () => {
    if (!profile) return;
    if (!file) {
      toast.error("Pick a .pptx file first.");
      return;
    }
    const t = title.trim();
    if (!t) {
      toast.error("Add a title.");
      return;
    }
    setBusy(true);
    try {
      await uploadClassPresentation({
        file,
        title: t,
        description,
        className,
        createdBy: profile.uid,
        published,
      });
      toast.success("Presentation uploaded.");
      setTitle("");
      setDescription("");
      setClassName("");
      setPublished(true);
      setFile(null);
      await refresh();
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseReady) {
    return (
      <div className="container py-16">
        <Card>
          <CardHeader>
            <CardTitle>NCLEX module unavailable</CardTitle>
            <CardDescription>Add VITE_FIREBASE_* keys to your environment, then rebuild.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to portfolio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!profile || !canUse) {
    return (
      <div className="container py-16">
        <Card>
          <CardHeader>
            <CardTitle>Tutor access only</CardTitle>
            <CardDescription>Sign in with a tutor or admin account to manage presentations.</CardDescription>
          </CardHeader>
          <CardContent className="space-x-2">
            <Button asChild>
              <Link href="/student/nclex">Student area</Link>
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container flex h-14 items-center justify-between">
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/tutor/nclex")}>
            <ArrowLeft className="h-4 w-4" />
            NCLEX tutor
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing || busy}>
            Refresh
          </Button>
        </div>
      </header>

      <main className="container py-10 space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Presentation className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Class presentations</h1>
            <p className="text-muted-foreground">Upload PPTX documents to show to students under Notes → Presentations.</p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Upload a PPTX
            </CardTitle>
            <CardDescription>Only `.pptx` is accepted. Students will only see items marked “Published”.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Medication Essentials" />
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note for students…" />
            </div>
            <div className="grid gap-2 sm:max-w-md">
              <Label>Class (optional)</Label>
              <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. RN Year 2" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={published} onCheckedChange={setPublished} id="published" />
                <Label htmlFor="published">Published</Label>
              </div>
              {busy ? <span className="text-xs text-muted-foreground">Uploading…</span> : null}
            </div>
            <div className="grid gap-2">
              <Label>PPTX file</Label>
              <Input
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                }}
              />
              {file ? (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium text-slate-700">{file.name}</span> ({formatBytes(file.size)})
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-orange-600 hover:bg-orange-700" disabled={busy} onClick={() => void onUpload()}>
                Upload
              </Button>
              <Button asChild variant="outline" disabled={busy}>
                <Link href="/student/nclex/presentations">Open student view</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Uploaded presentations</CardTitle>
            <CardDescription>{rows.length ? `${rows.length} item(s)` : "No uploads yet."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Upload your first PPTX above.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--nclex-border)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-slate-900">{r.title || r.filename}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            r.published ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {r.published ? "Published" : "Draft"}
                        </span>
                        {r.className ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                            {r.className}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.filename} · {formatBytes(r.sizeBytes)}
                      </p>
                      {r.description ? <p className="mt-1 text-sm text-slate-700">{r.description}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void setPresentationPublished(r.id, !r.published)
                            .then(() => refresh())
                            .then(() => toast.success(!r.published ? "Published." : "Unpublished."))
                            .catch((e) => toast.error(formatAuthOrFirestoreError(e)))
                        }
                      >
                        {r.published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button asChild type="button" variant="outline" size="sm" disabled={!r.downloadUrl}>
                        <a href={r.downloadUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          const ok = window.confirm(`Delete "${r.title || r.filename}"? This cannot be undone.`);
                          if (!ok) return;
                          setBusy(true);
                          void deletePresentation(r.id, { fileId: r.b2FileId, fileName: r.b2FileName })
                            .then(() => toast.success("Deleted."))
                            .then(() => refresh())
                            .catch((e) => toast.error(formatAuthOrFirestoreError(e)))
                            .finally(() => setBusy(false));
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


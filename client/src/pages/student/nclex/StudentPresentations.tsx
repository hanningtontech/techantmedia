import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { listPublishedPresentations, type ClassPresentation } from "@/lib/firestore/presentations";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";
import { ArrowLeft, Presentation } from "lucide-react";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const kb = 1024;
  const mb = kb * 1024;
  if (n >= mb) return `${(n / mb).toFixed(1)} MB`;
  if (n >= kb) return `${Math.round(n / kb)} KB`;
  return `${n} B`;
}

export default function StudentPresentations() {
  useRedirectStudentIfPending();
  const [, navigate] = useLocation();
  const { profile, loading, firebaseReady } = useFirebaseAuth();
  const [rows, setRows] = useState<ClassPresentation[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async (cls?: string) => {
    if (!firebaseReady) return;
    setBusy(true);
    try {
      const list = await listPublishedPresentations({
        className: (cls ?? classFilter).trim() || undefined,
        limit: 120,
      });
      setRows(list);
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  if (!firebaseReady) {
    return (
      <div className="nclex-app nclex-shell min-h-screen">
        <div className="nclex-main-narrow py-16">
          <Card className="nclex-card">
            <CardHeader>
              <CardTitle>NCLEX unavailable</CardTitle>
              <CardDescription>Configure Firebase environment variables first.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="nclex-app nclex-shell min-h-screen">
        <NclexHeader title="Presentations" homeHref="/student/nclex" homeLabel="Dashboard" />
        <div className="nclex-main flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-[var(--nclex-primary)]" />
          <p className="text-sm font-medium text-slate-700">Loading…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="nclex-app nclex-shell px-4 py-16">
        <Card className="nclex-card mx-auto max-w-md">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-medium text-slate-800">Sign in to view presentations.</p>
            <Button className="nclex-btn-primary" onClick={() => navigate("/student/nclex")}>
              Student home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="nclex-app nclex-shell min-h-screen pb-16">
      <NclexHeader
        title="Presentations"
        subtitle="PPTX resources shared by your instructor"
        homeHref="/student/nclex"
        homeLabel="Dashboard"
      />

      <main className="nclex-main mx-auto max-w-4xl space-y-5 pt-2 sm:space-y-6 xl:max-w-5xl">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/student/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <Card className="nclex-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Presentation className="h-5 w-5" />
              Notes → Presentations
            </CardTitle>
            <CardDescription>Open or download the PPTX files.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <Label>Filter by class (optional)</Label>
              <Input value={classFilter} onChange={(e) => setClassFilter(e.target.value)} placeholder="e.g. RN Year 2" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
                Apply
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setClassFilter("");
                  void refresh("");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {rows.length === 0 ? (
          <Card className="nclex-card shadow-sm">
            <CardContent className="py-10 text-center text-sm leading-relaxed text-muted-foreground sm:px-8">
              No presentations available yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {rows.map((r) => (
              <Card key={r.id} className="nclex-card border-[var(--nclex-border)] shadow-sm">
                <CardHeader className="space-y-1 pb-2 sm:pb-3">
                  <CardTitle className="text-balance text-base leading-snug sm:text-lg">{r.title || r.filename}</CardTitle>
                  <CardDescription className="text-xs">
                    {r.className ? `${r.className} · ` : ""}
                    {r.filename} · {formatBytes(r.sizeBytes)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {r.description ? <p className="text-sm text-slate-700">{r.description}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="nclex-btn-primary">
                      <Link href={`/student/nclex/presentations/view/${r.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <a href={`/api/public/presentations/${encodeURIComponent(r.id)}?download=1`}>
                        Download
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


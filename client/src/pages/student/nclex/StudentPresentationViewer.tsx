import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { STUDENT_NCLEX_DASHBOARD } from "@/lib/nclex/studentNclexRoutes";
import { getPresentationById } from "@/lib/firestore/presentations";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Presentation } from "lucide-react";

function officeViewerUrl(src: string): string {
  // Microsoft Office online viewer (requires a publicly reachable URL).
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(src)}`;
}

export default function StudentPresentationViewer() {
  useRedirectStudentIfPending();
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { profile, loading, firebaseReady } = useFirebaseAuth();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => {
    const pid = String(id ?? "").trim();
    if (!pid || !firebaseReady) return;
    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        const row = await getPresentationById(pid);
        if (!row) throw new Error("Presentation not found.");
        if (!cancelled) {
          setTitle(row.title || row.filename || "Presentation");
          // Use B2 URL directly (avoids proxying large files through Firebase Hosting).
          const fileUrl = String(row.downloadUrl ?? "").trim();
          setDownloadUrl(
            fileUrl || `${window.location.origin}/api/public/presentations/${encodeURIComponent(pid)}`,
          );
        }
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, firebaseReady]);

  const viewer = useMemo(() => (downloadUrl ? officeViewerUrl(downloadUrl) : ""), [downloadUrl]);
  const downloadHref = useMemo(() => (downloadUrl ? `${downloadUrl}?download=1` : ""), [downloadUrl]);

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

  if (loading || busy) {
    return (
      <div className="nclex-app nclex-shell min-h-screen">
        <NclexHeader title="Presentation viewer" homeHref={STUDENT_NCLEX_DASHBOARD} homeLabel="Dashboard" />
        <div className="nclex-main flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-[var(--nclex-primary)]" />
          <p className="text-sm font-medium text-slate-700">Loading presentation…</p>
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
            <Button className="nclex-btn-primary" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
              Student home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="nclex-app nclex-shell min-h-screen pb-6">
      <NclexHeader
        title="Presentation viewer"
        subtitle={title ? `Viewing: ${title}` : "Viewing presentation"}
        homeHref="/student/nclex/presentations"
        homeLabel="Presentations"
      />

      <main className="nclex-main mx-auto max-w-[90rem] space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/student/nclex/presentations")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" disabled={!downloadUrl}>
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in new tab
              </a>
            </Button>
            <Button asChild className="nclex-btn-primary" disabled={!downloadUrl}>
              <a href={downloadHref}>
                <Presentation className="mr-2 h-4 w-4" />
                Download PPTX
              </a>
            </Button>
          </div>
        </div>

        {viewer ? (
          <div className="overflow-hidden rounded-[var(--nclex-radius-card)] border border-[var(--nclex-border)] bg-white shadow-sm">
            <iframe
              title={title || "Presentation"}
              src={viewer}
              className="h-[75vh] w-full"
              allowFullScreen
            />
          </div>
        ) : (
          <Card className="nclex-card">
            <CardHeader>
              <CardTitle>Viewer unavailable</CardTitle>
              <CardDescription>Try opening or downloading the file instead.</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        )}
      </main>
    </div>
  );
}


import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { NursingFactLoader } from "@/components/nclex/NursingFactLoader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { listRatSessionsForStudent } from "@/lib/firestore/nclex";
import type { RatSession } from "@/lib/firestore/nclexTypes";
import { STUDENT_NCLEX_DASHBOARD } from "@/lib/nclex/studentNclexRoutes";
import { ArrowLeft } from "lucide-react";

function whenLabel(ts: any): string {
  if (!ts || typeof ts.toDate !== "function") return "";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "";
  }
}

export default function StudentRATHistory() {
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [rows, setRows] = useState<RatSession[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    setBusy(true);
    void listRatSessionsForStudent(profile.uid, 30)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  if (loading) {
    return (
      <div className="nclex-app nclex-shell min-h-screen">
        <NclexHeader title="RAT history" homeHref={STUDENT_NCLEX_DASHBOARD} homeLabel="Dashboard" />
        <NursingFactLoader seed="ratHistory" title="Loading RAT history" subtitle="Fetching your attempts…" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="nclex-app nclex-shell px-4 py-16">
        <Card className="nclex-card mx-auto max-w-md">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-medium text-slate-800">Sign in to view RAT history.</p>
            <Button className="nclex-btn-primary" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
              Student home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="nclex-app nclex-shell min-h-screen pb-16">
      <NclexHeader title="RAT history" subtitle="Your Random Assessment Tests only" homeHref={STUDENT_NCLEX_DASHBOARD} homeLabel="Dashboard" />
      <main className="nclex-main mx-auto max-w-3xl space-y-5 pt-2 sm:space-y-6 xl:max-w-4xl">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        {busy ? (
          <NursingFactLoader seed={`ratHistory:${profile.uid}`} title="Loading RAT history" subtitle="Fetching your attempts…" />
        ) : rows.length === 0 ? (
          <Card className="nclex-card shadow-sm">
            <CardContent className="py-10 text-center text-sm leading-relaxed text-muted-foreground sm:px-8">
              No RAT attempts yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {rows.map((r) => (
              <Card key={r.id} className="nclex-card border-[var(--nclex-border)] shadow-sm">
                <CardHeader className="space-y-1 pb-2 sm:pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">RAT · {r.questionCount} questions</CardTitle>
                      <CardDescription className="text-[11px] sm:text-xs">{whenLabel(r.startedAt ?? r.createdAt)}</CardDescription>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                      {r.status === "submitted" ? `${Math.round(Number(r.percentageScore) || 0)}%` : "In progress"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={r.status === "submitted" ? `/student/nclex/rat-results/${r.id}` : `/student/nclex/rat/${r.id}`}>
                      View
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


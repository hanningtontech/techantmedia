import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { getStudentQuizzes } from "@/lib/firestore/nclex";
import type { QuizSession } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function StudentQuizHistory() {
  useRedirectStudentIfPending();
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [rows, setRows] = useState<QuizSession[]>([]);

  useEffect(() => {
    if (!profile) return;
    void getStudentQuizzes(profile.uid)
      .then(setRows)
      .catch(() => toast.error("Could not load history"));
  }, [profile]);

  if (loading) {
    return (
      <div className="nclex-app nclex-shell flex min-h-[45vh] flex-col items-center justify-center gap-3 px-4 py-16">
        <Spinner className="h-10 w-10 text-[var(--nclex-primary)]" />
        <p className="text-sm font-medium text-slate-700">Loading history…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="nclex-app nclex-shell px-4 py-16">
        <p className="text-sm text-slate-600">Sign in to view your attempts.</p>
        <Button className="mt-4 nclex-btn-primary" onClick={() => navigate("/student/nclex")}>
          Student home
        </Button>
      </div>
    );
  }

  return (
    <div className="nclex-app nclex-shell min-h-screen py-8 sm:py-10">
      <div className="nclex-main mx-auto max-w-2xl space-y-5 sm:space-y-6 xl:max-w-3xl">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/student/nclex")}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <Card className="nclex-card shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg sm:text-xl">Past attempts</CardTitle>
          <CardDescription className="text-xs leading-relaxed sm:text-sm">
            Submitted attempts appear here; scores show after your tutor releases them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--nclex-border)] bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{r.status}</p>
                  <p className="text-xs text-muted-foreground">{r.id}</p>
                </div>
                {r.status === "submitted" || r.status === "reviewed" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/student/nclex/results/${r.id}`}>View</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href={`/student/nclex/quiz/${r.id}`}>Continue</Link>
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

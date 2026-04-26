import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { areQuizResultsReleasedToStudent, getAllStudentScores } from "@/lib/firestore/nclex";
import type { StudentScoreRow } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function StudentPerformance() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [rows, setRows] = useState<StudentScoreRow[]>([]);

  useEffect(() => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    if (profile.role === "admin") {
      // Admin performance moved into Manage users drawer.
      navigate("/tutor/nclex/users");
      return;
    }
    const run = async () => {
      try {
        const data = await getAllStudentScores(profile.uid);
        setRows(data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      }
    };
    void run();
  }, [profile, loading]);

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8 space-y-6">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Student performance</CardTitle>
            <CardDescription>Scores for sessions linked to you.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Released to student</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sessionId} className="border-t">
                      <td className="p-3">{r.studentName || r.studentId}</td>
                      <td className="p-3">
                        {!r.totalQuestions ? (
                          "—"
                        ) : !areQuizResultsReleasedToStudent({ resultsReleasedToStudent: r.resultsReleasedToStudent }) ? (
                          <span className="text-amber-800">
                            Pending · linear ref. {r.linearPercentScore ?? r.percentageScore}%
                          </span>
                        ) : (
                          `${r.totalCorrect}/${r.totalQuestions} · CAT ${r.percentageScore}%`
                        )}
                      </td>
                      <td className="p-3">
                        {areQuizResultsReleasedToStudent({ resultsReleasedToStudent: r.resultsReleasedToStudent })
                          ? "Yes"
                          : "No"}
                      </td>
                      <td className="p-3">{r.status}</td>
                      <td className="p-3">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/tutor/nclex/review/${r.studentId}/${r.sessionId}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

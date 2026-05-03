import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { areQuizResultsReleasedToStudent, getQuizTemplateById, getStudentQuizzes } from "@/lib/firestore/nclex";
import { toast } from "sonner";
import { ArrowLeft, LineChart } from "lucide-react";

type TopicAgg = { topicKey: string; attempts: number; sumPct: number; released: number };

export default function AdminTopicProgress() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<TopicAgg[]>([]);

  const load = async () => {
    const sid = studentId.trim();
    if (!sid) {
      toast.error("Enter a student UID");
      return;
    }
    if (!profile || profile.role !== "admin") return;
    setBusy(true);
    try {
      const sessions = await getStudentQuizzes(sid);
      const done = sessions.filter(
        (s) => (s.status === "submitted" || s.status === "reviewed") && areQuizResultsReleasedToStudent(s),
      );
      const byTopic = new Map<string, TopicAgg>();
      for (const s of done) {
        const tid = s.templateId?.trim() || "";
        let topicKey = "Practice (no template)";
        if (tid) {
          const tmpl = await getQuizTemplateById(tid);
          const cat = tmpl?.nclexCategory?.trim();
          const top = tmpl?.nclexTopic?.trim();
          const bank = tmpl?.filterCategory?.trim();
          topicKey =
            cat || top
              ? [cat, top].filter(Boolean).join(" → ")
              : bank
                ? `Bank category: ${bank}`
                : tmpl?.title
                  ? `Template: ${tmpl.title}`
                  : `Template ${tid.slice(0, 8)}`;
        } else if (s.filterCategory?.trim()) {
          topicKey = `Bank category: ${s.filterCategory}`;
        }
        const pct = Math.round(Number(s.percentageScore) || 0);
        const cur = byTopic.get(topicKey) ?? { topicKey, attempts: 0, sumPct: 0, released: 0 };
        cur.attempts += 1;
        cur.sumPct += pct;
        cur.released += 1;
        byTopic.set(topicKey, cur);
      }
      const list = Array.from(byTopic.values()).sort((a, b) => b.attempts - a.attempts);
      setRows(list);
      if (!list.length) toast.info("No released quiz attempts found for this student.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  const tableRows = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      avg: r.attempts ? Math.round(r.sumPct / r.attempts) : 0,
    }));
  }, [rows]);

  if (loading) {
    return <div className="container py-12 text-muted-foreground">Loading…</div>;
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Admins only.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/tutor/nclex")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-3xl space-y-8 py-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <LineChart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Progress by topic</h1>
            <p className="text-sm text-muted-foreground">
              Aggregates released quiz scores by NCLEX blueprint labels on templates (or bank category fallback).
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Student</CardTitle>
            <CardDescription>Paste the Firebase UID from Manage users.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="tp-uid">Student UID</Label>
              <Input id="tp-uid" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="font-mono text-sm" />
            </div>
            <Button type="button" className="bg-sky-600 hover:bg-sky-700" disabled={busy} onClick={() => void load()}>
              Load
            </Button>
          </CardContent>
        </Card>

        {tableRows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Released attempts by topic</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Topic / grouping</th>
                    <th className="py-2 pr-4 font-semibold">Attempts</th>
                    <th className="py-2 font-semibold">Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.topicKey} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{r.topicKey}</td>
                      <td className="py-2 pr-4 tabular-nums">{r.attempts}</td>
                      <td className="py-2 tabular-nums font-medium">{r.avg}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

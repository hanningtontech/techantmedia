import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { createStudentNotification } from "@/lib/firestore/nclex";
import { listUsersForAdmin } from "@/lib/firestore/usersAdmin";
import type { UserListRow } from "@/lib/userTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const defaultOpts = [
  { id: "a", text: "" },
  { id: "b", text: "" },
  { id: "c", text: "" },
  { id: "d", text: "" },
];

export default function AdminSendStudentNotification() {
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(defaultOpts);
  const [explanationsText, setExplanationsText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    void listUsersForAdmin()
      .then((rows) => {
        setUsers(rows.filter((r) => r.role === "student" && r.accountStatus !== "disabled" && r.accountStatus !== "disqualified"));
      })
      .catch(() => toast.error("Could not load users"));
  }, [profile]);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  const toggleStudent = (uid: string) => {
    setSelected((s) => ({ ...s, [uid]: !s[uid] }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || profile.role !== "admin") return;
    if (!selectedIds.length) {
      toast.error("Select at least one student.");
      return;
    }
    const noteTrim = noteBody.trim();
    const filledOpts = options.filter((o) => o.text.trim());
    const hasPlainNote = noteTrim.length > 0;
    const hasQuestion =
      Boolean(questionText.trim()) && filledOpts.length >= 2 && Boolean(explanationsText.trim());
    if (!hasPlainNote && !hasQuestion) {
      toast.error("Add a custom note and/or a full question with at least two choices and explanations.");
      return;
    }

    setBusy(true);
    try {
      for (const studentId of selectedIds) {
        const row = users.find((u) => u.uid === studentId);
        await createStudentNotification(
          {
            studentId,
            studentEmail: row?.email,
            title: title.trim() || "Message from your instructor",
            noteBody: hasPlainNote ? noteTrim : undefined,
            questionText: hasQuestion ? questionText.trim() : "",
            options: hasQuestion ? filledOpts.map((o) => ({ id: o.id.toLowerCase(), text: o.text.trim() })) : [],
            explanationsText: hasQuestion ? explanationsText.trim() : "",
          },
          profile.uid,
        );
      }
      toast.success(`Sent to ${selectedIds.length} student(s).`);
      setSelected({});
      setTitle("");
      setNoteBody("");
      setQuestionText("");
      setOptions(defaultOpts.map((o) => ({ ...o, text: "" })));
      setExplanationsText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="container py-16 text-muted-foreground">Loading…</div>;
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="container max-w-lg py-16">
        <Card>
          <CardHeader>
            <CardTitle>Admin only</CardTitle>
            <CardDescription>Only administrators can send student teaching notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/tutor/nclex")}>
              Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-3xl space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Student teaching notes</CardTitle>
            <CardDescription>
              Send a plain custom note, a question with choices and explanations, or both. Selected students see it on
              their NCLEX area (bell and Teaching notes page).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-6">
              <div className="space-y-2">
                <Label>Recipients</Label>
                <p className="text-xs text-muted-foreground">Check every student who should receive this same note.</p>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-white p-3">
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active students found.</p>
                  ) : (
                    users.map((u) => (
                      <label key={u.uid} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={Boolean(selected[u.uid])}
                          onChange={() => toggleStudent(u.uid)}
                        />
                        <span>
                          <span className="font-medium">{u.name || u.email}</span>
                          <span className="block text-xs text-muted-foreground">{u.email}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Title (optional)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Priority review" />
              </div>

              <div className="grid gap-2">
                <Label>Custom note (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Plain text only — reminders, encouragement, or context. You can send this alone or together with a
                  question below.
                </p>
                <Textarea
                  rows={5}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="e.g. Focus on lab values this week; we will review on Thursday."
                />
              </div>

              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Include <strong>either</strong> a custom note above, <strong>or</strong> a full question (stem + two or
                more choices + explanations), <strong>or</strong> both.
              </div>

              <div className="grid gap-2">
                <Label>Question (optional)</Label>
                <Textarea rows={5} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Stem…" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {options.map((opt, idx) => (
                  <div key={opt.id} className="grid gap-1">
                    <Label>Choice {opt.id.toUpperCase()} (optional)</Label>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const next = [...options];
                        next[idx] = { ...opt, text: e.target.value };
                        setOptions(next);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-2">
                <Label>Explanations for the choices (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Required when you include a question with choices. Explain why each option is right or wrong (plain text
                  or bullets).
                </p>
                <Textarea
                  rows={8}
                  value={explanationsText}
                  onChange={(e) => setExplanationsText(e.target.value)}
                  placeholder={'e.g.\nA. …\nB. …\nC. …\nD. …'}
                />
              </div>

              <Button type="submit" disabled={busy} className="bg-blue-600 hover:bg-blue-700">
                {busy ? "Sending…" : `Send to ${selectedIds.length || 0} student(s)`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { markStudentNotificationRead, subscribeStudentNotifications } from "@/lib/firestore/nclex";
import type { StudentNotification } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

function notificationHasQuestionBlock(n: StudentNotification): boolean {
  return (
    Boolean(n.questionText?.trim()) &&
    n.options.length >= 2 &&
    Boolean(n.explanationsText?.trim())
  );
}

function formatWhen(n: StudentNotification["createdAt"]): string {
  if (!n || typeof (n as { toDate?: () => Date }).toDate !== "function") return "";
  try {
    return (n as { toDate: () => Date }).toDate().toLocaleString();
  } catch {
    return "";
  }
}

export default function StudentNotificationsPage() {
  useRedirectStudentIfPending();
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [rows, setRows] = useState<StudentNotification[]>([]);
  const [busyMark, setBusyMark] = useState(false);
  const [hideRead, setHideRead] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeStudentNotifications(profile.uid, setRows);
    return () => unsub();
  }, [profile?.uid]);

  const unread = rows.filter((r) => !r.read).length;
  const visibleRows = hideRead ? rows.filter((r) => !r.read) : rows;

  const markAll = async () => {
    if (!profile) return;
    const targets = rows.filter((r) => !r.read);
    if (!targets.length) return;
    setBusyMark(true);
    try {
      await Promise.all(targets.map((r) => markStudentNotificationRead(r.id)));
      toast.success("Marked all as read.");
    } catch {
      toast.error("Could not update one or more items.");
    } finally {
      setBusyMark(false);
    }
  };

  if (loading) {
    return (
      <div className="nclex-app nclex-shell min-h-screen">
        <NclexHeader title="Teaching notes" homeHref="/student/nclex" homeLabel="Dashboard" />
        <div className="nclex-main flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-[var(--nclex-primary)]" />
          <p className="text-sm font-medium text-slate-700">Loading your notes…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="nclex-app nclex-shell px-4 py-16">
        <Card className="nclex-card mx-auto max-w-md">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-medium text-slate-800">Sign in to view your notes.</p>
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
        title="Teaching notes"
        subtitle="Notes, questions, and explanations from your instructor"
        homeHref="/student/nclex"
        homeLabel="Dashboard"
      />
      <main className="nclex-main mx-auto max-w-3xl space-y-5 pt-2 sm:space-y-6 xl:max-w-4xl">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/student/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        {unread > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nclex-radius-card)] border border-sky-200/90 bg-gradient-to-r from-sky-50 to-blue-50/80 px-3 py-3 text-xs text-sky-950 shadow-sm sm:px-4 sm:text-sm">
            <span>
              You have <strong>{unread}</strong> unread note{unread === 1 ? "" : "s"}.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={busyMark} onClick={() => void markAll()}>
                Mark all read
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setHideRead((s) => !s)}>
                {hideRead ? "Show all" : "Clear read"}
              </Button>
            </div>
          </div>
        ) : null}

        {visibleRows.length === 0 ? (
          <Card className="nclex-card shadow-sm">
            <CardContent className="py-10 text-center text-sm leading-relaxed text-muted-foreground sm:px-8">
              No teaching notes yet. When your instructor sends a note or question, it will appear here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {visibleRows.map((n) => (
              <Card
                key={n.id}
                className={`nclex-card border-[var(--nclex-border)] shadow-sm ${!n.read ? "ring-2 ring-sky-300/80" : ""}`}
              >
                <CardHeader className="space-y-1 pb-2 sm:pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-balance text-base leading-snug sm:text-lg">
                        {n.title || "Teaching note"}
                      </CardTitle>
                      <CardDescription className="text-[11px] sm:text-xs">{formatWhen(n.createdAt)}</CardDescription>
                    </div>
                    {!n.read ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void markStudentNotificationRead(n.id)
                            .then(() => toast.success("Marked read"))
                            .catch(() => toast.error("Update failed"))
                        }
                      >
                        Mark read
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-relaxed sm:space-y-4 sm:text-base">
                  {n.noteBody?.trim() ? (
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Note</p>
                      <p className="whitespace-pre-wrap rounded-md border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-3 text-slate-900 sm:p-4">
                        {n.noteBody}
                      </p>
                    </div>
                  ) : null}
                  {notificationHasQuestionBlock(n) ? (
                    <>
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Question</p>
                        <p className="whitespace-pre-wrap text-pretty text-slate-900">{n.questionText}</p>
                      </div>
                      <ul className="space-y-2 rounded-md border border-[var(--nclex-border)] bg-white/90 p-2.5 sm:p-3">
                        {n.options.map((o) => (
                          <li key={o.id} className="flex gap-2">
                            <span className="shrink-0 font-bold tabular-nums text-slate-900">{o.id.toUpperCase()}.</span>
                            <span className="text-slate-800">{o.text}</span>
                          </li>
                        ))}
                      </ul>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Explanations
                        </p>
                        <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-slate-800">{n.explanationsText}</p>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

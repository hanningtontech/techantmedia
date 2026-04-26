import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { listAdminNotifications, listAdminScoreNotifications, markAdminNotificationRead } from "@/lib/firestore/nclex";
import type { AdminNotification } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function AdminNotifications() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [fallbackRows, setFallbackRows] = useState<
    Array<{
      id: string;
      read: boolean;
      studentId: string;
      studentName: string;
      quizTitle: string;
      label: string;
      sessionId: string;
    }>
  >([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    // Prefer server-authored adminNotifications (Cloud Functions / Blaze plan).
    // Fallback: scan quizSessions for "needs marking" / section requests (works on Spark plan).
    try {
      const n = await listAdminNotifications({ status: "open", limit: 50 });
      setRows(n);
      if (n.length) {
        setFallbackRows([]);
        return;
      }
    } catch {
      setRows([]);
    }
    const localKey = "nclex_admin_notifications_read_v1";
    const readSet = (() => {
      try {
        const raw = localStorage.getItem(localKey);
        const arr = raw ? (JSON.parse(raw) as string[]) : [];
        return new Set(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set<string>();
      }
    })();
    const s = await listAdminScoreNotifications({ limit: 50, scanLimit: 350 });
    const mapped = s.map((x) => {
      const id = `${x.kind}:${x.sessionId}`;
      const label =
        x.kind === "final_results"
          ? "Submitted for marking"
          : `Section results requested (up to Q${x.requestedUpTo || "—"})`;
      return {
        id,
        read: readSet.has(id),
        studentId: x.studentId,
        studentName: x.studentName,
        quizTitle: (x.quizTitle ?? "Quiz submission") as string,
        label,
        sessionId: x.sessionId,
      };
    });
    setFallbackRows(mapped);
  };

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    void reload().catch((e) => toast.error(e instanceof Error ? e.message : "Could not load notifications"));
  }, [profile]);

  const unreadCount = useMemo(() => {
    if (rows.length) return rows.filter((r) => !r.read).length;
    return fallbackRows.filter((r) => !r.read).length;
  }, [rows, fallbackRows]);

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  if (profile.role !== "admin") {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">This page is only available to administrators.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/tutor/nclex")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-4xl space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Notifications</span>
              {unreadCount ? (
                <Badge className="bg-red-600 text-white tabular-nums">{unreadCount > 99 ? "99+" : unreadCount}</Badge>
              ) : (
                <Badge variant="secondary">0</Badge>
              )}
            </CardTitle>
            <CardDescription>Unread submissions and section-score requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void reload()}>
                Refresh
              </Button>
            </div>

            {rows.length ? (
              <div className="space-y-2">
                {rows.map((n) => {
                  const label =
                    n.type === "final_results"
                      ? "Submitted for marking"
                      : `Section results requested (up to Q${n.requestedUpTo ?? "—"})`;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className="w-full rounded-lg border bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                      onClick={() => {
                        setBusyId(n.id);
                        void markAdminNotificationRead(n.id)
                          .catch(() => {})
                          .finally(() => {
                            navigate(`/tutor/nclex/review/${n.studentId}/${n.sessionId}`);
                          });
                      }}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {n.studentName || "Student"}
                            </div>
                            {!n.read ? <Badge className="bg-blue-600 text-white">Unread</Badge> : null}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {n.quizTitle?.trim() ? n.quizTitle : "Quiz submission"}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs font-medium text-slate-700">
                          {busyId === n.id ? "Opening…" : label}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : fallbackRows.length ? (
              <div className="space-y-2">
                {fallbackRows.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="w-full rounded-lg border bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                    onClick={() => {
                      const localKey = "nclex_admin_notifications_read_v1";
                      try {
                        const raw = localStorage.getItem(localKey);
                        const arr = raw ? (JSON.parse(raw) as string[]) : [];
                        const next = Array.from(new Set([...(Array.isArray(arr) ? arr : []), n.id]));
                        localStorage.setItem(localKey, JSON.stringify(next));
                      } catch {
                        // ignore
                      }
                      setFallbackRows((s) => s.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                      navigate(`/tutor/nclex/review/${n.studentId}/${n.sessionId}`);
                    }}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-slate-900">{n.studentName || "Student"}</div>
                          {!n.read ? <Badge className="bg-blue-600 text-white">Unread</Badge> : null}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{n.quizTitle}</div>
                      </div>
                      <div className="shrink-0 text-xs font-medium text-slate-700">{n.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
                No open notifications right now.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


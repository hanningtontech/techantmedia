import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { useNclexAdminExamType } from "@/hooks/useNclexAdminExamType";
import { templateVisibleToStudent } from "@/lib/nclex/examTypeFilters";
import {
  getUserForAdmin,
  listUsersForAdminPage,
  resetStudentRatCooldown,
  setUserAccountStatus,
  setUserApprovalStatus,
  type AdminUserCursor,
  type AdminUserFilters,
} from "@/lib/firestore/usersAdmin";
import {
  assignQuizTemplateToStudent,
  createQuizTemplate,
  getQuestionCategorySummaries,
  getStudentQuizzes,
  areQuizResultsReleasedToStudent,
  listAdminScoreNotifications,
  listAdminNotifications,
  listAssignedTemplateIds,
  listQuizTemplatesForEditor,
} from "@/lib/firestore/nclex";
import type { QuizTemplate } from "@/lib/firestore/nclexTypes";
import type { NursingTrack, UserListRow } from "@/lib/userTypes";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const QUIZ_CACHE_KEY = "nclex_admin_quiz_catalog_cache_v1";
const CAT_CACHE_KEY = "nclex_admin_category_cache_v1";
const PAGE_SIZE_KEY = "nclex_admin_users_page_size_v1";

function quizTemplateAssignableToStudent(t: QuizTemplate, studentTrack: NursingTrack | null | undefined): boolean {
  if (!studentTrack) return t.examType == null || t.examType === "both";
  return templateVisibleToStudent(t.examType, studentTrack);
}

export default function AdminUserManagement() {
  const [, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const { adminExamType } = useNclexAdminExamType();

  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [quizLoadErr, setQuizLoadErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<AdminUserFilters>({
    role: "all",
    approvalStatus: "all",
    accountStatus: "all",
    nursingTrack: "all",
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem(PAGE_SIZE_KEY);
      const n = Math.floor(Number(raw) || 24);
      return Math.max(10, Math.min(60, n));
    } catch {
      return 24;
    }
  });
  const [pageRows, setPageRows] = useState<UserListRow[]>([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<AdminUserCursor | null>(null);
  const [cursorStack, setCursorStack] = useState<AdminUserCursor[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [drawerAssignments, setDrawerAssignments] = useState<number | null>(null);
  const [drawerErr, setDrawerErr] = useState<string | null>(null);
  const [drawerAvgScore, setDrawerAvgScore] = useState<number | null>(null);
  const [drawerAttemptCount, setDrawerAttemptCount] = useState<number | null>(null);
  const [drawerSessions, setDrawerSessions] = useState<
    Array<{
      id: string;
      status: string;
      quizTitle: string;
      submittedAtLabel: string;
      scoreLabel: string;
      isReleased: boolean;
      sortMillis: number;
    }>
  >([]);
  const [drawerSessionsLoading, setDrawerSessionsLoading] = useState(false);

  const [notifications, setNotifications] = useState<
    Array<
      | { kind: "final_results"; sessionId: string; studentId: string; studentName: string; quizTitle?: string | null }
      | {
          kind: "section_results";
          sessionId: string;
          studentId: string;
          studentName: string;
          quizTitle?: string | null;
          requestedUpTo: number;
        }
    >
  >([]);
  const [needsAttentionIds, setNeedsAttentionIds] = useState<Set<string>>(new Set());
  const [pinnedUser, setPinnedUser] = useState<UserListRow | null>(null);
  const [pinnedSessionId, setPinnedSessionId] = useState<string | null>(null);

  const loadPage = async (cursor: AdminUserCursor | null, resetStack: boolean) => {
    if (!profile || profile.role !== "admin") return;
    setLoadingPage(true);
    try {
      const res = await listUsersForAdminPage({ pageSize, cursor, filters });
      setPageRows(res.rows);
      setNextCursor(res.nextCursor);
      if (resetStack) setCursorStack(cursor ? [cursor] : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load users");
      setPageRows([]);
      setNextCursor(null);
      if (resetStack) setCursorStack([]);
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    try {
      const quizCached = sessionStorage.getItem(QUIZ_CACHE_KEY);
      if (quizCached) {
        const parsed = JSON.parse(quizCached) as { at: number; templates: QuizTemplate[] };
        if (Array.isArray(parsed.templates)) setTemplates(parsed.templates);
      }
      const catCached = sessionStorage.getItem(CAT_CACHE_KEY);
      if (catCached) {
        const parsed = JSON.parse(catCached) as { at: number; categories: Array<{ category: string; count: number }> };
        if (Array.isArray(parsed.categories)) setCategories(parsed.categories);
      }
    } catch {
      // ignore
    }

    void loadPage(null, true);
    void getQuestionCategorySummaries()
      .then((c) => {
        setCategories(c);
        try {
          sessionStorage.setItem(CAT_CACHE_KEY, JSON.stringify({ at: Date.now(), categories: c }));
        } catch {
          // ignore
        }
      })
      .catch(() => setCategories([]));

    void listAdminNotifications({ limit: 12, status: "open" })
      .then((n) =>
        setNotifications(
          n.map((x) =>
            x.type === "final_results"
              ? {
                  kind: "final_results",
                  sessionId: x.sessionId,
                  studentId: x.studentId,
                  studentName: x.studentName,
                  quizTitle: x.quizTitle,
                }
              : {
                  kind: "section_results",
                  sessionId: x.sessionId,
                  studentId: x.studentId,
                  studentName: x.studentName,
                  quizTitle: x.quizTitle,
                  requestedUpTo: x.requestedUpTo ?? 0,
                },
          ),
        ),
      )
      .catch(() => setNotifications([]));

    // For Spark (no Functions), also compute "needs attention" from recent sessions.
    void listAdminScoreNotifications({ limit: 80, scanLimit: 500 })
      .then((n) => setNeedsAttentionIds(new Set(n.map((x) => x.studentId).filter(Boolean))))
      .catch(() => setNeedsAttentionIds(new Set()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    void listQuizTemplatesForEditor({ tutorUid: profile.uid, isAdmin: true, adminExamType })
      .then((t) => {
        setTemplates(t);
        setQuizLoadErr(null);
        try {
          sessionStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify({ at: Date.now(), templates: t }));
        } catch {
          // ignore
        }
      })
      .catch((e) => {
        setTemplates([]);
        setQuizLoadErr(e instanceof Error ? e.message : "Could not load quiz catalog");
      });
  }, [profile, adminExamType]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    try {
      sessionStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
    } catch {
      // ignore
    }
    void loadPage(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    void loadPage(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    const params = new URLSearchParams(window.location.search);
    const uid = (params.get("user") ?? "").trim();
    if (!uid) return;
    void getUserForAdmin(uid)
      .then((u) => {
        if (!u) return;
        openDrawer(u);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    const params = new URLSearchParams(window.location.search);
    const uid = (params.get("pin") ?? "").trim();
    const sid = (params.get("session") ?? "").trim();
    if (!uid) {
      setPinnedUser(null);
      setPinnedSessionId(null);
      return;
    }
    setPinnedSessionId(sid || null);
    void getUserForAdmin(uid)
      .then((u) => {
        setPinnedUser(u);
        if (u) openDrawer(u);
      })
      .catch(() => {
        setPinnedUser(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

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

  const statusLabel = (r: UserListRow) => {
    if (r.role !== "student") return "—";
    if (r.approvalStatus === "pending") return "Pending";
    if (r.approvalStatus === "rejected") return "Rejected";
    return "Approved";
  };

  const templateOptions = useMemo(() => {
    const active = templates.filter((t) => t.isActive);
    const base = active.length ? active : templates;
    if (!selectedUser || selectedUser.role !== "student") return base;
    return base.filter((t) => quizTemplateAssignableToStudent(t, selectedUser.nursingTrack ?? null));
  }, [templates, selectedUser]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = pinnedUser ? pageRows.filter((r) => r.uid !== pinnedUser.uid) : pageRows;
    if (!t) return base;
    return base.filter((r) => {
      const hay = `${r.name} ${r.email} ${r.role} ${(r.nursingTrack ?? "")}`.toLowerCase();
      return hay.includes(t);
    });
  }, [pageRows, q, pinnedUser]);

  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => listEl,
    estimateSize: () => 56,
    overscan: 8,
  });

  const openDrawer = (u: UserListRow) => {
    setSelectedUser(u);
    setDrawerOpen(true);
    setDrawerAssignments(null);
    setDrawerErr(null);
    setSelectedTemplate("");
    setSelectedCategory("");
    setDrawerSessions([]);
    setDrawerSessionsLoading(false);
    setDrawerAvgScore(null);
    setDrawerAttemptCount(null);

    void (async () => {
      try {
        if (u.role !== "student") return;
        setDrawerSessionsLoading(true);
        const [assignedIds, sessions] = await Promise.all([listAssignedTemplateIds(u.uid), getStudentQuizzes(u.uid)]);
        setDrawerAssignments(assignedIds.size);
        const done = sessions.filter((s) => s.status === "submitted" || s.status === "reviewed");
        const scored = done.filter((s) => areQuizResultsReleasedToStudent(s) && (s.totalQuestions ?? 0) > 0);
        const avg = scored.length
          ? Math.round(scored.reduce((a, s) => a + (Number(s.percentageScore) || 0), 0) / scored.length)
          : 0;
        setDrawerAvgScore(avg);
        setDrawerAttemptCount(done.length);
        const toMillis = (t: any) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
        const toLabel = (t: any) => {
          if (!t || typeof t.toDate !== "function") return "—";
          const d = t.toDate();
          return d.toLocaleString();
        };
        const mapped = sessions.map((s) => {
          const sortMillis = toMillis(s.submittedAt ?? s.startedAt);
          const isReleased = s.resultsReleasedToStudent !== false;
          const hasScore = Number(s.totalQuestions ?? 0) > 0;
          const scoreLabel = !hasScore
            ? "—"
            : isReleased
              ? `CAT ${Math.round(Number(s.percentageScore) || 0)}%`
              : `Pending · linear ${Math.round(Number(s.linearPercentScore ?? s.percentageScore) || 0)}%`;
          return {
            id: s.id,
            status: String(s.status ?? ""),
            quizTitle: String(s.quizTitle ?? "Quiz"),
            submittedAtLabel: toLabel(s.submittedAt ?? s.startedAt),
            scoreLabel,
            isReleased,
            sortMillis,
          };
        });
        // Locked (pending) first, then newest -> oldest within each group.
        mapped.sort((a, b) => {
          const la = a.isReleased ? 1 : 0;
          const lb = b.isReleased ? 1 : 0;
          if (la !== lb) return la - lb;
          return b.sortMillis - a.sortMillis;
        });
        setDrawerSessions(mapped);
      } catch (e) {
        setDrawerErr(e instanceof Error ? e.message : "Could not load student details");
      } finally {
        setDrawerSessionsLoading(false);
      }
    })();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-6xl space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Manage users</CardTitle>
            <CardDescription>
              Use filters + pagination for large user sets. Open a user to see details and actions in a drawer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (current page)…" className="h-9 w-full" />
                <select
                  className="h-9 w-full rounded-md border bg-white px-2 text-sm"
                  value={filters.role ?? "all"}
                  onChange={(e) => setFilters((s) => ({ ...s, role: (e.target.value as AdminUserFilters["role"]) ?? "all" }))}
                >
                  <option value="all">Role: All</option>
                  <option value="student">Role: Student</option>
                  <option value="tutor">Role: Tutor</option>
                  <option value="admin">Role: Admin</option>
                </select>
                <select
                  className="h-9 w-full rounded-md border bg-white px-2 text-sm"
                  value={filters.approvalStatus ?? "all"}
                  onChange={(e) =>
                    setFilters((s) => ({ ...s, approvalStatus: (e.target.value as AdminUserFilters["approvalStatus"]) ?? "all" }))
                  }
                >
                  <option value="all">Approval: All</option>
                  <option value="pending">Approval: Pending</option>
                  <option value="rejected">Approval: Rejected</option>
                  <option value="approved">Approval: Approved</option>
                </select>
                <select
                  className="h-9 w-full rounded-md border bg-white px-2 text-sm"
                  value={filters.accountStatus ?? "all"}
                  onChange={(e) =>
                    setFilters((s) => ({ ...s, accountStatus: (e.target.value as AdminUserFilters["accountStatus"]) ?? "all" }))
                  }
                >
                  <option value="all">Status: All</option>
                  <option value="active">Status: Active</option>
                  <option value="disabled">Status: Disabled</option>
                  <option value="disqualified">Status: Disqualified</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Page</span>
                  <select className="h-9 w-full rounded-md border bg-white px-2 text-sm" value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>
                    <option value="10">10</option>
                    <option value="24">24</option>
                    <option value="40">40</option>
                    <option value="60">60</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                <div className="text-xs text-muted-foreground">
                  Showing <span className="font-medium">{visible.length}</span>
                  {q.trim() ? <span> (filtered)</span> : null}
                </div>
                <Button type="button" variant="outline" size="sm" disabled={loadingPage} onClick={() => void loadPage(null, true)}>
                  Refresh page
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Quiz catalog loaded: <span className="font-medium">{templates.length}</span>{" "}
              {quizLoadErr ? <span className="text-red-600">· {quizLoadErr}</span> : null}
              {templates.length === 0 && !quizLoadErr ? (
                <span>
                  {" "}
                  · No quizzes found. Create one in{" "}
                  <Button variant="link" className="h-auto p-0 text-xs text-[var(--nclex-primary)]" onClick={() => navigate("/tutor/nclex/quizzes")}>
                    Quiz catalog
                  </Button>
                  .
                </span>
              ) : null}
            </div>

            <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>Notifications</span>
                  {notifications.length ? (
                    <Badge variant="secondary" className="tabular-nums">
                      {notifications.length}
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>Students requesting section results or final results show up here.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {notifications.length ? (
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <button
                        key={`${n.kind}:${n.sessionId}`}
                        type="button"
                        className="w-full rounded-lg border bg-white/70 px-3 py-2 text-left transition hover:bg-white"
                        onClick={() =>
                          navigate(
                            `/tutor/nclex/users?pin=${encodeURIComponent(n.studentId)}&session=${encodeURIComponent(n.sessionId)}`,
                          )
                        }
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{n.studentName || "Student"}</div>
                            <div className="truncate text-xs text-muted-foreground">{n.quizTitle?.trim() ? n.quizTitle : "Quiz submission"}</div>
                          </div>
                          <div className="shrink-0 text-xs font-medium text-slate-700">
                            {n.kind === "final_results" ? "Final results requested" : `Section results requested (up to Q${n.requestedUpTo || "—"})`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No pending requests right now.</div>
                )}
              </CardContent>
            </Card>

            {pinnedUser ? (
              <Card className="overflow-hidden border-amber-200 bg-amber-50/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate">{pinnedUser.name || pinnedUser.email || "Pinned user"}</span>
                    <Badge className="bg-amber-600 text-white">Needs marking</Badge>
                  </CardTitle>
                  <CardDescription className="truncate">
                    Pinned from notifications. This user is shown first.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {pinnedSessionId ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => navigate(`/tutor/nclex/review/${pinnedUser.uid}/${pinnedSessionId}`)}
                      >
                        Open review
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => openDrawer(pinnedUser)}>
                      Open user drawer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPinnedUser(null);
                        setPinnedSessionId(null);
                        navigate("/tutor/nclex/users");
                      }}
                    >
                      Clear pin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.7fr_0.7fr_0.8fr] gap-3 bg-gray-50 px-4 py-2 text-xs font-semibold text-slate-700">
                <div>User</div>
                <div>Email</div>
                <div>Role</div>
                <div>Score</div>
                <div>Allocated</div>
                <div>Access</div>
              </div>
              <div ref={setListEl} className="max-h-[560px] overflow-auto">
                {loadingPage ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">Loading users…</div>
                ) : visible.length ? (
                  <div className="divide-y" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
                    {rowVirtualizer.getVirtualItems().map((v) => {
                      const r = visible[v.index];
                      const score =
                        r.role === "student" && r.adminStats?.averageScoreReleased != null
                          ? `${Math.round(Number(r.adminStats.averageScoreReleased) || 0)}%`
                          : "—";
                      const allocated =
                        r.role === "student" && r.adminStats?.activeAssignments != null
                          ? String(Math.max(0, Math.floor(Number(r.adminStats.activeAssignments) || 0)))
                          : "—";
                  const attention = r.role === "student" && needsAttentionIds.has(r.uid);
                      return (
                        <button
                          key={r.uid}
                          type="button"
                          className="grid w-full grid-cols-[1.2fr_1fr_0.6fr_0.7fr_0.7fr_0.8fr] gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${v.start}px)`,
                          }}
                          onClick={() => openDrawer(r)}
                        >
                          <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <div className="truncate font-medium text-slate-900">{r.name || "—"}</div>
                          {attention ? <Badge className="bg-amber-600 text-white">Pending</Badge> : null}
                        </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {r.nursingTrack ? <span>{r.nursingTrack.toUpperCase()}</span> : null}
                              {r.accountStatus && r.accountStatus !== "active" ? (
                                <span className="font-medium text-red-700">{r.accountStatus}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="min-w-0 truncate text-muted-foreground">{r.email || "—"}</div>
                          <div className="text-slate-700">{r.role}</div>
                          <div className="font-semibold tabular-nums text-emerald-700">{score}</div>
                          <div className="font-semibold tabular-nums text-slate-700">{allocated}</div>
                          <div className="text-slate-700">{statusLabel(r)}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No users on this page.</div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t bg-white px-4 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingPage || cursorStack.length <= 1}
                  onClick={() => {
                    const next = cursorStack.slice(0, -1);
                    setCursorStack(next);
                    const prevCursor = next.length ? next[next.length - 1] : null;
                    void loadPage(prevCursor, false);
                  }}
                >
                  Prev
                </Button>
                <div className="text-xs text-muted-foreground">Page {cursorStack.length || 1}</div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingPage || !nextCursor}
                  onClick={() => {
                    if (!nextCursor) return;
                    const next = [...cursorStack, nextCursor];
                    setCursorStack(next);
                    void loadPage(nextCursor, false);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="truncate">{selectedUser?.name || "User"}</span>
              {selectedUser && selectedUser.role === "student" && needsAttentionIds.has(selectedUser.uid) ? (
                <Badge className="bg-amber-600 text-white">Pending</Badge>
              ) : null}
            </SheetTitle>
            <SheetDescription className="truncate">{selectedUser?.email || ""}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {drawerErr ? (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{drawerErr}</div>
            ) : null}

            {selectedUser ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Quizzes allocated</div>
                    <div className="mt-1 text-lg font-bold tabular-nums">{selectedUser.role === "student" ? (drawerAssignments ?? "…") : "—"}</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Average score</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-emerald-700">
                      {selectedUser.role !== "student"
                        ? "—"
                        : drawerAvgScore != null
                          ? `${drawerAvgScore}%`
                          : selectedUser.adminStats?.averageScoreReleased != null
                            ? `${Math.round(Number(selectedUser.adminStats.averageScoreReleased) || 0)}%`
                            : "—"}
                    </div>
                    {selectedUser.role === "student" ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Attempts: <span className="font-medium tabular-nums">{drawerAttemptCount ?? "…"}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">RATs done</div>
                    <div className="mt-1 text-lg font-bold tabular-nums">
                      {selectedUser.role === "student" ? Math.max(0, Math.floor(Number(selectedUser.ratStats?.count ?? 0))) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">RAT mean</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-emerald-700">
                      {selectedUser.role !== "student"
                        ? "—"
                        : selectedUser.ratStats?.meanScore != null && Number(selectedUser.ratStats.meanScore) > 0
                          ? `${Math.round(Number(selectedUser.ratStats.meanScore) || 0)}%`
                          : "—"}
                    </div>
                  </div>
                </div>

                {selectedUser.role === "student" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                      <Link href={`/tutor/nclex/users/${selectedUser.uid}/quizzes`}>Assign quizzes</Link>
                    </Button>
                  </div>
                ) : null}

                <Accordion type="single" collapsible className="w-full">
                  {selectedUser.role === "student" ? (
                    <AccordionItem value="performance">
                      <AccordionTrigger className="py-3">Performance</AccordionTrigger>
                      <AccordionContent>
                        {drawerSessionsLoading ? (
                          <div className="text-sm text-muted-foreground">Loading performance…</div>
                        ) : drawerSessions.length ? (
                          <div className="space-y-2">
                            {drawerSessions.map((s) => (
                              <div key={s.id} className="rounded-lg border bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-900">{s.quizTitle}</div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">{s.submittedAtLabel}</div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className="text-xs font-semibold tabular-nums text-slate-900">{s.scoreLabel}</div>
                                    <div className="mt-1 flex justify-end gap-2">
                                      <Badge variant={s.status === "submitted" ? "secondary" : "outline"}>{s.status}</Badge>
                                      <Badge variant={s.isReleased ? "outline" : "secondary"}>
                                        {s.isReleased ? "Released" : "Locked"}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <Button asChild size="sm" variant="outline" className="w-full">
                                    <Link href={`/tutor/nclex/review/${selectedUser.uid}/${s.id}`}>Open review</Link>
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No quiz attempts yet.</div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ) : null}

                  <AccordionItem value="details">
                    <AccordionTrigger className="py-3">User details</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Role</span>
                          <span className="font-medium">{selectedUser.role}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Nursing track</span>
                          <span className="font-medium">{selectedUser.nursingTrack ? selectedUser.nursingTrack.toUpperCase() : "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Approval</span>
                          <span className="font-medium">{statusLabel(selectedUser)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Account status</span>
                          <span className="font-medium">{selectedUser.accountStatus ?? "active"}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="intake">
                    <AccordionTrigger className="py-3">Questionnaire / profile answers</AccordionTrigger>
                    <AccordionContent>
                      {selectedUser.intakeQuestionnaire ? (
                        <div className="grid gap-2 text-sm">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Education</div>
                            <div className="font-medium">{selectedUser.intakeQuestionnaire.educationLevel || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Exam</div>
                            <div className="font-medium">{selectedUser.intakeQuestionnaire.examPreparing || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Interested categories</div>
                            <div className="font-medium">
                              {selectedUser.intakeQuestionnaire.interestedCategories?.length ? selectedUser.intakeQuestionnaire.interestedCategories.join(", ") : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Comfortable topics</div>
                            <div className="font-medium">
                              {selectedUser.intakeQuestionnaire.comfortableTopics?.length ? selectedUser.intakeQuestionnaire.comfortableTopics.join(", ") : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Challenging topics</div>
                            <div className="font-medium">
                              {selectedUser.intakeQuestionnaire.challengingTopics?.length ? selectedUser.intakeQuestionnaire.challengingTopics.join(", ") : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Goals</div>
                            <div className="font-medium">{selectedUser.intakeQuestionnaire.coachingGoals || "—"}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No questionnaire answers yet.</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {selectedUser.role === "student" ? (
                    <AccordionItem value="actions">
                      <AccordionTrigger className="py-3">Admin actions</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">Quick assign</div>
                            <div className="flex flex-col gap-2">
                              <select className="h-9 w-full rounded-md border bg-white px-2 text-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                                <option value="">Category…</option>
                                {categories.map((c) => (
                                  <option key={c.category} value={c.category}>
                                    {c.category} ({c.count})
                                  </option>
                                ))}
                              </select>
                              <select className="h-9 w-full rounded-md border bg-white px-2 text-sm" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                                <option value="">Select quiz…</option>
                                {templateOptions.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.title}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                className="bg-orange-600 hover:bg-orange-700"
                                disabled={busyId === selectedUser.uid || (!selectedTemplate.trim() && !selectedCategory.trim()) || !profile}
                                onClick={() => {
                                  if (!profile) return;
                                  const pickedTemplate = selectedTemplate.trim();
                                  const pickedCategory = selectedCategory.trim();
                                  if (!pickedTemplate && !pickedCategory) return;
                                  setBusyId(selectedUser.uid);
                                  void (async () => {
                                    let tid = pickedTemplate;
                                    if (!tid && pickedCategory) {
                                      const existing =
                                        templateOptions.find(
                                          (t) =>
                                            (t.filterCategory ?? "").trim().toLowerCase() === pickedCategory.toLowerCase() && t.questionLimit === 0,
                                        ) ?? null;
                                      if (existing) tid = existing.id;
                                      else {
                                        if (!adminExamType) {
                                          toast.error("Select NCLEX-RN or NCLEX-PN on the tutor dashboard before auto-creating a quiz.");
                                          return;
                                        }
                                        tid = await createQuizTemplate(
                                          {
                                            title: `${pickedCategory} quiz`,
                                            description: `Auto-created from category assignment (${pickedCategory}).`,
                                            filterCategory: pickedCategory,
                                            questionLimit: 0,
                                            estimatedMinutes: null,
                                            sortOrder: 0,
                                            isActive: true,
                                            examType: adminExamType,
                                          },
                                          profile.uid,
                                        );
                                        const all = await listQuizTemplatesForEditor({
                                          tutorUid: profile.uid,
                                          isAdmin: true,
                                          adminExamType,
                                        });
                                        setTemplates(all);
                                      }
                                    }
                                    await assignQuizTemplateToStudent(selectedUser.uid, tid, profile.uid);
                                    toast.success("Quiz assigned");
                                    const ids = await listAssignedTemplateIds(selectedUser.uid);
                                    setDrawerAssignments(ids.size);
                                  })()
                                    .catch((e) => toast.error(e instanceof Error ? e.message : "Assign failed"))
                                    .finally(() => setBusyId(null));
                                }}
                              >
                                Assign
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === selectedUser.uid}
                              onClick={() => {
                                if (!profile || profile.role !== "admin") return;
                                setBusyId(selectedUser.uid);
                                void resetStudentRatCooldown(selectedUser.uid)
                                  .then(() => toast.success("RAT re-enabled for this student"))
                                  .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                                  .finally(() => setBusyId(null));
                              }}
                            >
                              Re-enable RAT now
                            </Button>
                            {selectedUser.accountStatus !== "disabled" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === selectedUser.uid}
                                onClick={() => {
                                  setBusyId(selectedUser.uid);
                                  void setUserAccountStatus(selectedUser.uid, "disabled")
                                    .then(() => loadPage(cursorStack.length ? cursorStack[cursorStack.length - 1] : null, false))
                                    .then(() => toast.success("User disabled"))
                                    .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                                    .finally(() => setBusyId(null));
                                }}
                              >
                                Disable user
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                disabled={busyId === selectedUser.uid}
                                onClick={() => {
                                  setBusyId(selectedUser.uid);
                                  void setUserAccountStatus(selectedUser.uid, "active")
                                    .then(() => loadPage(cursorStack.length ? cursorStack[cursorStack.length - 1] : null, false))
                                    .then(() => toast.success("User re-enabled"))
                                    .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                                    .finally(() => setBusyId(null));
                                }}
                              >
                                Re-enable user
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busyId === selectedUser.uid}
                              onClick={() => {
                                if (!confirm(`Permanently disqualify ${selectedUser.email}? They will be blocked from the site.`)) return;
                                setBusyId(selectedUser.uid);
                                void setUserAccountStatus(selectedUser.uid, "disqualified")
                                  .then(() => loadPage(cursorStack.length ? cursorStack[cursorStack.length - 1] : null, false))
                                  .then(() => toast.success("User disqualified"))
                                  .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                                  .finally(() => setBusyId(null));
                              }}
                            >
                              Permanently disqualify
                            </Button>
                          </div>

                          {selectedUser.approvalStatus === "pending" ? (
                            <div className="grid gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                disabled={busyId === selectedUser.uid}
                                onClick={() => {
                                  setBusyId(selectedUser.uid);
                                  void setUserApprovalStatus(selectedUser.uid, "approved")
                                    .then(() => {
                                      toast.success("User approved");
                                      return loadPage(cursorStack.length ? cursorStack[cursorStack.length - 1] : null, false);
                                    })
                                    .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                                    .finally(() => setBusyId(null));
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busyId === selectedUser.uid}
                                onClick={() => {
                                  if (!confirm(`Reject access for ${selectedUser.email}?`)) return;
                                  setBusyId(selectedUser.uid);
                                  void setUserApprovalStatus(selectedUser.uid, "rejected")
                                    .then(() => {
                                      toast.success("User rejected");
                                      return loadPage(cursorStack.length ? cursorStack[cursorStack.length - 1] : null, false);
                                    })
                                    .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                                    .finally(() => setBusyId(null));
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ) : null}
                </Accordion>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select a user from the list.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

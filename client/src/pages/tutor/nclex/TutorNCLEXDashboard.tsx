import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { useNclexAdminExamType } from "@/hooks/useNclexAdminExamType";
import { NCLEX_EXAM_LABELS } from "@/lib/nclex/nclexCatalogHierarchy";
import { listAdminNotifications, listAdminScoreNotifications } from "@/lib/firestore/nclex";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  BookText,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutList,
  LineChart,
  MessageCircle,
  Presentation,
  Settings,
  Upload,
  Users,
  User,
} from "lucide-react";

export default function TutorNCLEXDashboard() {
  const [, navigate] = useLocation();
  const { firebaseReady, loading, profile } = useFirebaseAuth();
  const { adminExamType, setAdminExamType } = useNclexAdminExamType();
  const [openCount, setOpenCount] = useState<number>(0);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    void (async () => {
      try {
        const n = await listAdminNotifications({ limit: 50, status: "open", unreadOnly: true });
        setOpenCount(n.length);
        return;
      } catch {
        // fallback for Spark plan (no Cloud Functions)
      }
      try {
        const localKey = "nclex_admin_notifications_read_v1";
        const raw = localStorage.getItem(localKey);
        const arr = raw ? (JSON.parse(raw) as string[]) : [];
        const readSet = new Set(Array.isArray(arr) ? arr : []);
        const s = await listAdminScoreNotifications({ limit: 50, scanLimit: 350 });
        const unread = s.filter((x) => !readSet.has(`${x.kind}:${x.sessionId}`)).length;
        setOpenCount(unread);
      } catch {
        setOpenCount(0);
      }
    })();
  }, [profile]);

  if (!firebaseReady) {
    return (
      <div className="container py-16">
        <Card>
          <CardHeader>
            <CardTitle>NCLEX module unavailable</CardTitle>
            <CardDescription>Add VITE_FIREBASE_* keys to your environment, then rebuild.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to portfolio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!profile || !isTutorOrAdmin(profile)) {
    return (
      <div className="container py-16">
        <Card>
          <CardHeader>
            <CardTitle>Tutor access only</CardTitle>
            <CardDescription>Sign in with a tutor or admin account to manage NCLEX content.</CardDescription>
          </CardHeader>
          <CardContent className="space-x-2">
            <Button asChild>
              <Link href="/student/nclex">Student area</Link>
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container flex h-14 items-center justify-between">
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
            Portfolio
          </Button>
          <div className="flex items-center gap-3">
            {profile.role === "admin" ? (
              <Button
                variant="outline"
                size="sm"
                className="relative"
                onClick={() => navigate("/tutor/nclex/notifications")}
                title="Open admin notifications"
              >
                <Bell className="h-4 w-4" />
                {openCount > 0 ? (
                  <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                    {openCount > 99 ? "99+" : openCount}
                  </span>
                ) : null}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-0.5" title="Account">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile.name ?? "Account"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                    <p className="text-xs capitalize text-muted-foreground">Role: {profile.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile.role === "admin" ? (
                  <DropdownMenuItem onClick={() => navigate("/tutor/nclex/users")}>
                    Manage users (authorize tutors)
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => navigate("/student/nclex")}>Student area</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <Card
          className={`mb-8 ${adminExamType ? "border-emerald-200 bg-emerald-50/40" : "border-amber-300 bg-amber-50/90"}`}
        >
          <CardHeader>
            <CardTitle className="text-lg">NCLEX workspace</CardTitle>
            <CardDescription>
              Choose <strong>NCLEX-RN</strong> or <strong>NCLEX-PN</strong> before creating quizzes, notes, or assignments.
              This filters what you see in tutor tools (stored on this browser only).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {(["rn", "pn"] as const).map((k) => (
              <Button
                key={k}
                type="button"
                variant={adminExamType === k ? "default" : "outline"}
                className={adminExamType === k ? "bg-blue-600 hover:bg-blue-700" : ""}
                onClick={() => setAdminExamType(k)}
              >
                {NCLEX_EXAM_LABELS[k].title}
              </Button>
            ))}
            {adminExamType ? (
              <span className="text-sm text-slate-700">
                Active: <span className="font-semibold">{NCLEX_EXAM_LABELS[adminExamType].short}</span>
              </span>
            ) : (
              <span className="text-sm font-medium text-amber-900">Select a track to align new content.</span>
            )}
          </CardContent>
        </Card>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NCLEX Practice Manager</h1>
            <p className="text-muted-foreground">Questions, imports, scores, and review</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isTutorOrAdmin(profile) ? (
            <Card className="hover:shadow-md border-blue-200 bg-blue-50/60 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Presentation className="h-5 w-5" />
                  Add presentations (PPTX)
                </CardTitle>
                <CardDescription>Upload PPTX presentations for students to view/download.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/tutor/nclex/presentations">Upload PPTX</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isTutorOrAdmin(profile) ? (
            <Card className="hover:shadow-md border-violet-200 bg-violet-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5" />
                  Tutoring sessions
                </CardTitle>
                <CardDescription>
                  Instructor-led sessions: blueprint tags, roster, attach quizzes, publish and assign to students.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-violet-600 hover:bg-violet-700">
                  <Link href="/tutor/nclex/tutoring-sessions">Manage sessions</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {profile.role === "admin" ? (
            <Card className="hover:shadow-md border-slate-200 bg-slate-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LineChart className="h-5 w-5" />
                  Topic progress
                </CardTitle>
                <CardDescription>
                  Average released scores by NCLEX topic for a student (admin).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/tutor/nclex/topic-progress">Open</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayoutList className="h-5 w-5" />
                Student quizzes
              </CardTitle>
              <CardDescription>Name quizzes, pick category and length; they show on the student home.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="bg-orange-600 hover:bg-orange-700">
                <Link href="/tutor/nclex/quizzes">Manage quizzes</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5" />
                Questions
              </CardTitle>
              <CardDescription>
                Create and search items; admins can edit any question (including bulk imports) and add more in the same
                category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/tutor/nclex/questions">Open</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5" />
                Bulk import
              </CardTitle>
              <CardDescription>Paste blocks with **CORRECT** markers.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/tutor/nclex/bulk-import">Open</Link>
              </Button>
            </CardContent>
          </Card>

          {profile.role !== "admin" ? (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LineChart className="h-5 w-5" />
                  Student performance
                </CardTitle>
                <CardDescription>Scores for sessions linked to you.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/tutor/nclex/performance">Open</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {profile.role === "admin" ? (
            <Card className="hover:shadow-md border-blue-200 bg-blue-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Manage users
                </CardTitle>
                <CardDescription>Approve new student accounts and review intake questionnaires.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/tutor/nclex/users">Open</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {profile.role === "admin" ? (
            <Card className="hover:shadow-md border-blue-200 bg-blue-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5" />
                  Catalog control
                </CardTitle>
                <CardDescription>Enable/disable quizzes and review question bank categories.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/tutor/nclex/catalog">Open</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {profile.role === "admin" ? (
            <Card className="hover:shadow-md border-blue-200 bg-blue-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageCircle className="h-5 w-5" />
                  Student teaching notes
                </CardTitle>
                <CardDescription>
                  Send a question with choices and explanations to one or more students; they see a Notes bell on their
                  NCLEX pages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/tutor/nclex/student-notes">Compose</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isTutorOrAdmin(profile) ? (
            <Card className="hover:shadow-md border-blue-200 bg-blue-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Presentation className="h-5 w-5" />
                  Class presentations (PPTX)
                </CardTitle>
                <CardDescription>Upload PPTX documents; students see them under Notes → Presentations.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/tutor/nclex/presentations">Manage</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isTutorOrAdmin(profile) ? (
            <Card className="hover:shadow-md border-violet-200 bg-violet-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Class notes (text)
                </CardTitle>
                <CardDescription>
                  Structured notes by category/topic; tagged RN or PN. Students read them under Class notes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-violet-600 hover:bg-violet-700">
                  <Link href="/tutor/nclex/class-notes">Manage notes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isTutorOrAdmin(profile) ? (
            <Card className="hover:shadow-md border-blue-200 bg-blue-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookText className="h-5 w-5" />
                  Study guides (PDF/DOC)
                </CardTitle>
                <CardDescription>Upload study guides; students see them under Study guides.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/tutor/nclex/study-guides">Manage</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {profile.role === "admin" ? (
            <Card className="hover:shadow-md border-blue-200 bg-blue-50/50 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5" />
                  Student quiz preview
                </CardTitle>
                <CardDescription>
                  See published quizzes like the student home, open with answer key, add questions or bulk import by
                  category.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/tutor/nclex/student-preview">Open</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}

import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NclexRouteFallback } from "@/components/nclex/NclexRouteFallback";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Portfolio from "./Portfolio";
import NclexTutoringPage from "./pages/NclexTutoringPage";
import StudentPendingApprovalPage from "./pages/student/nclex/StudentPendingApprovalPage";
import StudentDisabledPage from "./pages/student/nclex/StudentDisabledPage";
import StudentDisqualifiedPage from "./pages/student/nclex/StudentDisqualifiedPage";
import AdminUserManagement from "./pages/tutor/nclex/AdminUserManagement";
import BulkImport from "./pages/tutor/nclex/BulkImport";
import AssignQuizzesToStudent from "./pages/tutor/nclex/AssignQuizzesToStudent";
import AdminCatalogControl from "./pages/tutor/nclex/AdminCatalogControl";
import QuizManagement from "./pages/tutor/nclex/QuizManagement";
import QuestionManagement from "./pages/tutor/nclex/QuestionManagement";
import ReviewDashboard from "./pages/tutor/nclex/ReviewDashboard";
import StudentPerformance from "./pages/tutor/nclex/StudentPerformance";
import TutorNCLEXDashboard from "./pages/tutor/nclex/TutorNCLEXDashboard";
import AdminStudentQuizCatalog from "./pages/tutor/nclex/AdminStudentQuizCatalog";
import AdminTemplateAnswerKeyPreview from "./pages/tutor/nclex/AdminTemplateAnswerKeyPreview";
import AdminSendStudentNotification from "./pages/tutor/nclex/AdminSendStudentNotification";
import AdminNotifications from "./pages/tutor/nclex/AdminNotifications";
import AdminPresentations from "./pages/tutor/nclex/AdminPresentations";
import AdminStudyGuides from "./pages/tutor/nclex/AdminStudyGuides";
import AdminNclexNotes from "./pages/tutor/nclex/AdminNclexNotes";
import WrittenQnsPage from "./pages/WrittenQnsPage";
import { Route, Switch } from "wouter";
import { StudentTutoringFloatingDock } from "@/components/tutoring/StudentTutoringFloatingDock";

const QuizResults = lazy(() => import("./pages/student/nclex/QuizResults"));
const StudentNCLEXDashboard = lazy(() => import("./pages/student/nclex/StudentNCLEXDashboard"));
const StudentQuizFirestore = lazy(() => import("./pages/student/nclex/StudentQuizFirestore"));
const StudentQuizHistory = lazy(() => import("./pages/student/nclex/StudentQuizHistory"));
const StudentProfile = lazy(() => import("./pages/student/nclex/StudentProfile"));
const StudentNotificationsPage = lazy(() => import("./pages/student/nclex/StudentNotificationsPage"));
const StudentRATTake = lazy(() => import("./pages/student/nclex/StudentRATTake"));
const StudentRATResults = lazy(() => import("./pages/student/nclex/StudentRATResults"));
const StudentRATHistory = lazy(() => import("./pages/student/nclex/StudentRATHistory"));
const StudentPresentations = lazy(() => import("./pages/student/nclex/StudentPresentations"));
const StudentStudyGuides = lazy(() => import("./pages/student/nclex/StudentStudyGuides"));
const StudentNclexNotes = lazy(() => import("./pages/student/nclex/StudentNclexNotes"));
const StudentNclexHub = lazy(() => import("./pages/student/nclex/StudentNclexHub"));
const StudentNclexTrackSelect = lazy(() => import("./pages/student/nclex/StudentNclexTrackSelect"));
const StudentPresentationViewer = lazy(() => import("./pages/student/nclex/StudentPresentationViewer"));
const AdminTutoringSessions = lazy(() => import("./pages/tutor/nclex/AdminTutoringSessions"));
const AdminTutoringSessionDetail = lazy(() => import("./pages/tutor/nclex/AdminTutoringSessionDetail"));
const AdminTopicProgress = lazy(() => import("./pages/tutor/nclex/AdminTopicProgress"));
const StudentTutoringSessionDetail = lazy(() => import("./pages/student/nclex/StudentTutoringSessionDetail"));

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <FirebaseAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<NclexRouteFallback />}>
          <Switch>
            <Route path="/written-qns/:step" component={WrittenQnsPage} />
            <Route path="/written-qns" component={WrittenQnsPage} />
            <Route path="/tutoring" component={NclexTutoringPage} />
            <Route path="/tutor/nclex/review/:studentId/:sessionId" component={ReviewDashboard} />
            <Route path="/tutor/nclex/questions" component={QuestionManagement} />
            <Route path="/tutor/nclex/quizzes" component={QuizManagement} />
            <Route path="/tutor/nclex/bulk-import" component={BulkImport} />
            <Route path="/tutor/nclex/performance" component={StudentPerformance} />
            <Route path="/tutor/nclex/users" component={AdminUserManagement} />
            <Route path="/tutor/nclex/users/:studentId/quizzes" component={AssignQuizzesToStudent} />
            <Route path="/tutor/nclex/catalog" component={AdminCatalogControl} />
            <Route path="/tutor/nclex/student-preview/:templateId" component={AdminTemplateAnswerKeyPreview} />
            <Route path="/tutor/nclex/student-preview" component={AdminStudentQuizCatalog} />
            <Route path="/tutor/nclex/student-notes" component={AdminSendStudentNotification} />
            <Route path="/tutor/nclex/notifications" component={AdminNotifications} />
            <Route path="/tutor/nclex/presentations" component={AdminPresentations} />
            <Route path="/tutor/nclex/study-guides" component={AdminStudyGuides} />
            <Route path="/tutor/nclex/class-notes" component={AdminNclexNotes} />
            <Route path="/tutor/nclex/tutoring-sessions/:sessionId" component={AdminTutoringSessionDetail} />
            <Route path="/tutor/nclex/tutoring-sessions" component={AdminTutoringSessions} />
            <Route path="/tutor/nclex/topic-progress" component={AdminTopicProgress} />
            <Route path="/tutor/nclex" component={TutorNCLEXDashboard} />
            <Route path="/student/pending-approval" component={StudentPendingApprovalPage} />
            <Route path="/student/disabled" component={StudentDisabledPage} />
            <Route path="/student/disqualified" component={StudentDisqualifiedPage} />
            <Route path="/student/nclex/quiz/:sessionId" component={StudentQuizFirestore} />
            <Route path="/student/nclex/results/:sessionId" component={QuizResults} />
            <Route path="/student/nclex/rat/:ratId" component={StudentRATTake} />
            <Route path="/student/nclex/rat-results/:ratId" component={StudentRATResults} />
            <Route path="/student/nclex/rat-history" component={StudentRATHistory} />
            <Route path="/student/nclex/history" component={StudentQuizHistory} />
            <Route path="/student/nclex/profile" component={StudentProfile} />
            <Route path="/student/nclex/notifications" component={StudentNotificationsPage} />
            <Route path="/student/nclex/track" component={StudentNclexTrackSelect} />
            <Route path="/student/nclex/class-notes" component={StudentNclexNotes} />
            <Route path="/student/nclex/presentations" component={StudentPresentations} />
            <Route path="/student/nclex/presentations/view/:id" component={StudentPresentationViewer} />
            <Route path="/student/nclex/study-guides" component={StudentStudyGuides} />
            <Route path="/student/nclex/tutoring/:sessionId" component={StudentTutoringSessionDetail} />
            <Route path="/student/nclex/dashboard" component={StudentNCLEXDashboard} />
            <Route path="/student/nclex" component={StudentNclexHub} />
            <Route path="/" component={Portfolio} />
            <Route component={Portfolio} />
          </Switch>
          <StudentTutoringFloatingDock />
          </Suspense>
        </TooltipProvider>
      </FirebaseAuthProvider>
    </ThemeProvider>
  );
}

export default App;

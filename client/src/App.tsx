import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NclexRouteFallback } from "@/components/nclex/NclexRouteFallback";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { SiteContentProvider } from "./contexts/SiteContentContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GlobalSeo } from "@/components/seo/GlobalSeo";
import { ScrollToTopOnNavigate } from "@/components/tech-media/ScrollToTopOnNavigate";
import Portfolio from "./Portfolio";
import XaiPortfolioPage from "./pages/xai-portfolio/XaiPortfolioPage";
import XaiPortfolioAdminPage from "./pages/admin/XaiPortfolioAdminPage";
import HomePage from "./pages/tech-media/HomePage";
import PhotographyPage from "./pages/tech-media/PhotographyPage";
import ContractsIndexPage from "./pages/tech-media/ContractsIndexPage";
import ContractSlugPage from "./pages/tech-media/ContractSlugPage";
import ClientSignUpPage from "./pages/tech-media/ClientSignUpPage";
import MyGalleryPage from "./pages/tech-media/MyGalleryPage";
import GalleryCategoryPage from "./pages/tech-media/GalleryCategoryPage";
import InsposPage from "./pages/tech-media/InsposPage";
import { InspoProvider } from "./contexts/InspoContext";
import DevelopmentPage from "./pages/tech-media/DevelopmentPage";
import TutoringPage from "./pages/tech-media/TutoringPage";
import ContactPage from "./pages/tech-media/ContactPage";
import LivestreamPage from "./pages/livestream/LivestreamPage";
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
import PortfolioAdminPage from "./pages/admin/PortfolioAdminPage";
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
const ExtractionPage = lazy(() => import("./pages/ntsa/ExtractionPage"));
const BlockGameSimulationPage = lazy(() => import("./pages/simulation/BlockGameSimulationPage"));
const BlockGamePage = lazy(() => import("./pages/game/BlockGamePage"));
const SimulationChartPage = lazy(() => import("./pages/simulation/SimulationChartPage"));
const PlayerChartPage = lazy(() => import("./pages/game/PlayerChartPage"));
const PlayerSessionHistoryPage = lazy(() => import("./pages/game/PlayerSessionHistoryPage"));
const PlayerSessionAnalysisPage = lazy(() => import("./pages/game/PlayerSessionAnalysisPage"));
const BlockGamePlayersAnalysisPage = lazy(() => import("./pages/admin/BlockGamePlayersAnalysisPage"));
const WrittenQnsPage = lazy(() => import("./pages/WrittenQnsPage"));

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <FirebaseAuthProvider>
        <SiteContentProvider>
        <InspoProvider>
        <ScrollToTopOnNavigate />
        <GlobalSeo />
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<NclexRouteFallback />}>
          <Switch>
            <Route path="/written-qns/:step" component={WrittenQnsPage} />
            <Route path="/written-qns" component={WrittenQnsPage} />
            <Route path="/admin/block-game/players" component={BlockGamePlayersAnalysisPage} />
            <Route path="/admin/portfolio" component={XaiPortfolioAdminPage} />
            <Route path="/admin" component={PortfolioAdminPage} />
            <Route path="/photography/contracts/:slug" component={ContractSlugPage} />
            <Route path="/photography/contracts" component={ContractsIndexPage} />
            <Route path="/photography/gallery/:slug" component={GalleryCategoryPage} />
            <Route path="/photography/my-gallery" component={MyGalleryPage} />
            <Route path="/photography/account" component={ClientSignUpPage} />
            <Route path="/photography" component={PhotographyPage} />
            <Route path="/inspos/:boardId" component={InsposPage} />
            <Route path="/inspos" component={InsposPage} />
            <Route path="/development" component={DevelopmentPage} />
            <Route path="/tutoring" component={TutoringPage} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/livestream" component={LivestreamPage} />
            <Route path="/live" component={LivestreamPage} />
            <Route path="/extraction" component={ExtractionPage} />
            <Route path="/game/history/analysis" component={PlayerSessionAnalysisPage} />
            <Route path="/game/history" component={PlayerSessionHistoryPage} />
            <Route path="/game/chart" component={PlayerChartPage} />
            <Route path="/game" component={BlockGamePage} />
            <Route path="/simulation/chart" component={SimulationChartPage} />
            <Route path="/simulation" component={BlockGameSimulationPage} />
            <Route path="/nclex-platform" component={NclexTutoringPage} />
            <Route path="/portfolio" component={XaiPortfolioPage} />
            <Route path="/developer-portfolio" component={Portfolio} />
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
            <Route path="/" component={HomePage} />
            <Route component={HomePage} />
          </Switch>
          <StudentTutoringFloatingDock />
          </Suspense>
        </TooltipProvider>
        </InspoProvider>
        </SiteContentProvider>
      </FirebaseAuthProvider>
    </ThemeProvider>
  );
}

export default App;

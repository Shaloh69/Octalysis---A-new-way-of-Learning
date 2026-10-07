import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Toaster } from "./components/ui/toast";
import { LocksPage } from "./pages/LocksPage";
import { ChangelogPage } from "./pages/ChangelogPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import { AttemptPage } from "./pages/AttemptPage";
import { StudioLayout } from "./pages/studio/StudioLayout";
import { OverviewView } from "./pages/studio/OverviewView";
import { ReviewView } from "./pages/studio/ReviewView";
import { SubjectView } from "./pages/studio/SubjectView";
import { ChapterView } from "./pages/studio/ChapterView";
import { ChapterRedirect, ContentRedirect } from "./pages/studio/redirects";
import { ItemsPage } from "./pages/ItemsPage";
import { SubmissionsPage } from "./pages/SubmissionsPage";
import { LivePage } from "./pages/LivePage";
import { ChatPage } from "./pages/ChatPage";
import { LivePresentPage } from "./pages/LivePresentPage";
import { AssessmentsPage } from "./pages/AssessmentsPage";
import { AuditPage } from "./pages/AuditPage";
import { SystemPage } from "./pages/SystemPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { ClaimPage } from "./pages/ClaimPage";
import { TeachersPage } from "./pages/TeachersPage";
import { TeacherDetailPage } from "./pages/TeacherDetailPage";
import { SignInPage } from "./pages/SignInPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

/**
 * The gradebook is lazy, and it is the only page that is.
 *
 * Recharts is ~135 KB gzipped and NOTHING else imports it. Loading it eagerly
 * put it in front of every teacher who opened the locks page mid-class, on
 * whatever the room WiFi happens to be — the same mistake apps/web made with
 * three.js, where a manualChunks entry emitted a modulepreload and shipped
 * 220 KB of 3D to students who never opened the galaxy.
 *
 * Splitting it here costs one Suspense boundary and takes the initial bundle
 * from 208 KB to well under half that.
 *
 * Since the 28 Sep 2026 rebuild the gradebook draws its chart in HTML and
 * imports no Recharts at all (`design/templates/console/gradebook/SPEC.md`):
 * every value is text the gate can measure. It stays lazy anyway; it is the
 * page nobody opens mid-class, and `console-gradebook.spec.ts` asserts that
 * no Recharts module loads and that this chunk is not in the first load.
 */
const GradebookPage = lazy(() =>
  import("./pages/GradebookPage").then((m) => ({ default: m.GradebookPage })),
);

export function App() {
  return (
    <Router>
      <Routes>
        {/*
         * Sign-in sits OUTSIDE the shell, and must. AppShell redirects an
         * unauthenticated visitor here; if this route were inside it, that
         * redirect would land on itself forever.
         */}
        <Route path="/signin" element={<SignInPage />} />
        {/* The password reset sits outside the shell for the same reason:
            whoever needs it is, by definition, not signed in. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* A teacher claims their employee ID (T1): not signed in, by definition. */}
        <Route path="/claim" element={<ClaimPage />} />

        {/* The projector: staff-only like every console route, with no frame
            around it, so the nav is not on a screen the whole class reads. */}
        <Route element={<AppShell bare />}>
          <Route path="/live/present" element={<LivePresentPage />} />
        </Route>

        <Route element={<AppShell />}>
          {/* Locks first: it is the page a teacher opens mid-class. */}
          <Route path="/" element={<Navigate to="/locks" replace />} />
          <Route path="/locks" element={<LocksPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:userId" element={<StudentDetailPage />} />
          <Route path="/attempts/:attemptId" element={<AttemptPage />} />
          <Route
            path="/gradebook"
            element={
              <Suspense fallback={<p className="p-8 text-sm text-ink-muted">Loading the gradebook…</p>}>
                <GradebookPage />
              </Suspense>
            }
          />
          <Route path="/assessments" element={<AssessmentsPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          {/* Course Studio (CS1, 7 Oct 2026) took in /content; both addresses still land. */}
          <Route path="/studio" element={<StudioLayout />}>
            <Route index element={<OverviewView />} />
            <Route path="review" element={<ReviewView />} />
            <Route path=":subject" element={<SubjectView />} />
            <Route path=":subject/:stageId" element={<ChapterView />} />
          </Route>
          <Route path="/content" element={<ContentRedirect />} />
          <Route path="/content/:stageId" element={<ChapterRedirect />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          {/* The admin's (T1). The page itself tells a teacher it is the admin's. */}
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/teachers/:key" element={<TeacherDetailPage />} />
          <Route path="*" element={<Navigate to="/locks" replace />} />
        </Route>
      </Routes>

      {/*
       * ONE toaster, for every route, mounted here rather than in AppShell.
       * `/signin` and the two gate screens render outside the shell's layout,
       * and a successful sign-in raises its toast on /signin and navigates
       * away: a toaster scoped to the shell could not reach the first and
       * would have been swapped out under the second. It is position: fixed,
       * so where it sits in the tree changes nothing about where it paints.
       */}
      <Toaster />
    </Router>
  );
}

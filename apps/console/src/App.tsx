import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Toaster } from "./components/ui/toast";
import { LocksPage } from "./pages/LocksPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import { AttemptPage } from "./pages/AttemptPage";
import { ContentPage } from "./pages/ContentPage";
import { ItemsPage } from "./pages/ItemsPage";
import { SubmissionsPage } from "./pages/SubmissionsPage";
import { LivePage } from "./pages/LivePage";
import { AssessmentsPage } from "./pages/AssessmentsPage";
import { AuditPage } from "./pages/AuditPage";
import { SystemPage } from "./pages/SystemPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { SignInPage } from "./pages/SignInPage";

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

        <Route element={<AppShell />}>
          {/* Locks first: it is the page a teacher opens mid-class. */}
          <Route path="/" element={<Navigate to="/locks" replace />} />
          <Route path="/locks" element={<LocksPage />} />
          <Route path="/live" element={<LivePage />} />
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
          <Route path="/content" element={<ContentPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
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

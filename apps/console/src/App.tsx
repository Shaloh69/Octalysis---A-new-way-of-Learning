import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LocksPage } from "./pages/LocksPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import { AttemptPage } from "./pages/AttemptPage";
import { ContentPage } from "./pages/ContentPage";
import { ItemsPage } from "./pages/ItemsPage";
import { SubmissionsPage } from "./pages/SubmissionsPage";
import { LivePage } from "./pages/LivePage";
import { AuditPage } from "./pages/AuditPage";
import { SystemPage } from "./pages/SystemPage";
import { FeedbackPage } from "./pages/FeedbackPage";

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
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/content" element={<ContentPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="*" element={<Navigate to="/locks" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

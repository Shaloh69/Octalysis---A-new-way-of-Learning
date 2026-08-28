import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { RegisterBar } from "./components/RegisterBar";
import { DepthGauge } from "./components/DepthGauge";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { SusSurvey } from "./components/SusSurvey";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import {
  CheckPage,
  MaintenancePage,
  MapPage,
  NotFoundPage,
  ProgressPage,
  StagePage,
} from "./pages/StudentPages";
import { SettingsPage } from "./pages/SettingsPage";
import { SubmitPage } from "./pages/SubmitPage";
import { api, type ProgressGrid as Grid, type StageMapData } from "./lib/api";
import { currentIdentity, onAuthChange, signOut, type Identity } from "./lib/auth";

/**
 * The student app.
 *
 * REAL ROUTES, and that is the point of this file. It used to be a three-way
 * `useState` switch: no deep link to a stage, no browser back button, and no
 * URL a student could send to a classmate. `react-router-dom` was already a
 * dependency and was never imported.
 *
 * The shell is deliberately thin. It owns the Register Bar, the Depth Gauge,
 * the offline banner and the auth gate; everything else is a route.
 */

function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    const read = () => {
      void currentIdentity().then((i) => {
        if (live) setIdentity(i);
      });
    };
    read();
    const off = onAuthChange(read);
    return () => {
      live = false;
      off();
    };
  }, []);

  return identity;
}

/** Everything under `/app` requires a session. */
function RequireSession(): JSX.Element {
  const identity = useIdentity();
  if (identity === undefined) {
    return <div className="state state-loading">Checking your session…</div>;
  }
  if (identity === null) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AppShell(): JSX.Element {
  const identity = useIdentity();
  const nav = useNavigate();
  const [map, setMap] = useState<StageMapData | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // The gauge and bar need the map, and every route under here needs it too --
  // but each route loads its own, so this is only for the chrome.
  useEffect(() => {
    void Promise.all([api.stages(), api.progress()])
      .then(([m, g]) => {
        setMap(m);
        setGrid(g);
      })
      .catch(() => {
        /* the route below will show the real error; chrome degrades quietly */
      });
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <RegisterBar />

      {offline && (
        <div className="banner banner-offline" role="status">
          You are offline. Anything you have answered is saved locally and will send when you
          reconnect.
        </div>
      )}

      <div className="app-body">
        <DepthGauge
          depth={grid?.depth ?? 6}
          revealed={(map?.nodes.find((n) => n.id === "11")?.state ?? "locked") !== "locked"}
        />

        <main id="main" className="app-main">
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/app" end>
              Map
            </NavLink>
            <NavLink to="/app/progress">Progress</NavLink>
            <NavLink to="/app/work">Your work</NavLink>
            <NavLink to="/app/settings">Settings</NavLink>
            <button
              type="button"
              className="app-nav-out"
              onClick={async () => {
                await signOut();
                nav("/login", { replace: true });
              }}
            >
              Sign out
            </button>
          </nav>

          <Outlet />
        </main>
      </div>

      {/* Both are gated on their own terms and render nothing until earned. */}
      <FeedbackWidget />
      {identity && <SusSurvey />}
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />

        <Route element={<RequireSession />}>
          <Route element={<AppShell />}>
            {/*
             * `/app` and `/app/map` are the SAME page. The galaxy is a
             * decorative layer on the first and suppressed on the second --
             * neither is a fallback, and nothing redirects, so every URL works
             * on every device. See pages/StudentPages.tsx.
             */}
            <Route path="/app" element={<MapPage />} />
            <Route path="/app/map" element={<MapPage flat />} />
            <Route path="/app/stage/:id" element={<StagePage />} />
            <Route path="/app/stage/:id/check" element={<CheckPage />} />
            <Route path="/app/progress" element={<ProgressPage />} />
            <Route path="/app/work" element={<SubmitPage />} />
            <Route path="/app/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export { Link };

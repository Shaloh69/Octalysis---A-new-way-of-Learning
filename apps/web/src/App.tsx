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
  useLocation,
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
import { StagesPage } from "./pages/StagesPage";
import { SubmitPage } from "./pages/SubmitPage";
import { api, type ProgressGrid as Grid, type StageMapData } from "./lib/api";
import { useCosmetics } from "./solar-system/cosmetic-seed";
import { SolarProvider } from "./solar-system/SolarBackdrop";
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
  const location = useLocation();

  /*
   * The student's seeded look, applied once for the whole authenticated app.
   *
   * It lives here rather than on the map because a landing biome dresses a
   * STAGE (BIOME-AND-LOADING-SPEC.md §1), and the stage reader is a different
   * route -- called from the map alone, `data-biome` would never be set on the
   * page that actually uses it. Cosmetic only: it changes what a student looks
   * at and nothing about what they can do.
   */
  useCosmetics();
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

  /*
   * Where the solar system is the page background, and where it is not.
   *
   * OFF on content surfaces -- the stage reader, the attempt runner, and the
   * labs and games that live under them. Those carry their own theatre: a LAB
   * beat wears its encounter theme, a landing wears its biome, and a star field
   * behind either is a third visual system competing with them.
   *
   * The harder reason is the assessment. DESIGN-MANDATE.md 1B rule 1: theatre
   * dresses the practice, never the assessment. A drifting star field behind a
   * graded question is exactly what that rule exists to keep out -- and it
   * would be MOTION behind an assessment, which is worse than decoration.
   */
  const onContentSurface = /^\/app\/stage\//.test(location.pathname);
  const backdrop = !onContentSurface;

  return (
    <SolarProvider data={map} active={backdrop} pathname={location.pathname}>
      <div className={`app${backdrop ? " app-over-solar" : ""}`}>
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
            <NavLink to="/app/stages">Stages</NavLink>
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
    </SolarProvider>
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
            <Route path="/app/stages" element={<StagesPage />} />
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

import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Toaster } from "./components/Toaster";
import { ChangePasswordPage, LoginPage, RegisterPage } from "./pages/AuthPages";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/RecoveryPages";
import {
  CheckPage,
  MaintenancePage,
  MapPage,
  MoonJourneyPage,
  NotFoundPage,
  ProgressPage,
  StagePage,
} from "./pages/StudentPages";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { StagesPage } from "./pages/StagesPage";
import { SubmitPage } from "./pages/SubmitPage";
import { ChatPage } from "./pages/ChatPage";
import { WhatsNewPage } from "./pages/WhatsNewPage";
import { useCosmetics } from "./solar-system/cosmetic-seed";
import { currentIdentity, onAuthChange, type Identity } from "./lib/auth";
import { useRealm } from "./lib/realm";
import { ShellDataProvider } from "./shell/ShellData";
import { StarShell } from "./shell/StarShell";
import { BiomeShell } from "./shell/BiomeShell";
import { RealmWarp } from "./shell/RealmWarp";
import { KeyHintProvider } from "./shell/keyHints";

/**
 * The student app (docs/redesign/WEB-REMAKE.md, rulings of 30 Sep 2026).
 *
 * Two realms, two shells. Every hub route sits in the STAR shell (Starfield's
 * HUD); a planet and everything under it sits in the BIOME shell (the planet's
 * biome, its chrome in Kenney's sprites). The realm itself is decided once,
 * from the route (`useRealm`, and index.html for the first frame), and every
 * move between the two is a warp (`RealmWarp`), a cut under reduced motion.
 *
 * `/app` is the 3D map and the ONLY map: the 2D map is removed (ruling 2), and
 * `/app/map` redirects to `/app`, keeping a selected `?stage=`.
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
    return (
      <main className="boot-wait" id="main" aria-busy="true">
        <h1 className="sr-only">Checking your session</h1>
        <p className="boot-wait-text">Checking your session…</p>
      </main>
    );
  }
  if (identity === null) return <Navigate to="/login" replace />;
  // A temporary password from the instructor: their own first (6 Oct 2026).
  if (identity.mustChangePassword) return <ChangePasswordPage />;
  return <Outlet />;
}

/**
 * The signed-in app: the seeded look (the accent, the palette variant and the
 * per-planet biomes the realm reads) and the map and progress both shells show.
 */
function SignedIn(): JSX.Element {
  useCosmetics();
  return (
    <ShellDataProvider>
      <Outlet />
    </ShellDataProvider>
  );
}

/** `/app/map` is gone; its selection is not. */
function MapRedirect(): JSX.Element {
  const { search } = useLocation();
  return <Navigate to={`/app${search}`} replace />;
}

/** The realm, applied to <html> for every route. Renders nothing. */
function RealmSync(): null {
  useRealm();
  return null;
}

export default function App(): JSX.Element {
  return (
    <Router>
      <RealmSync />
      <KeyHintProvider>
        <RealmWarp />
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />

          <Route element={<RequireSession />}>
            <Route element={<SignedIn />}>
              <Route element={<StarShell signedIn />}>
                <Route path="/app" element={<MapPage />} />
                <Route path="/app/stages" element={<StagesPage />} />
                <Route path="/app/progress" element={<ProgressPage />} />
                <Route path="/app/work" element={<SubmitPage />} />
                <Route path="/app/chat" element={<ChatPage />} />
                <Route path="/app/settings" element={<SettingsPage />} />
                <Route path="/app/profile" element={<ProfilePage />} />
                <Route path="/app/changelog" element={<WhatsNewPage />} />
              </Route>
              <Route path="/app/map" element={<MapRedirect />} />
              <Route path="/app/stage/:id" element={<BiomeShell signedIn />}>
                <Route index element={<StagePage />} />
                <Route path="check" element={<CheckPage />} />
                <Route path="moon/:objectiveId" element={<MoonJourneyPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </KeyHintProvider>
      <Toaster />
    </Router>
  );
}

import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "../lib/auth";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { SusSurvey } from "../components/SusSurvey";
import { Readout } from "./Readout";
import { MissionPanel } from "./MissionPanel";
import { Starfield } from "./Starfield";
import { KeyHintBar } from "./KeyHintBar";
import { useKeyHints } from "./keyHints";
import { useOnline } from "./useOnline";

/**
 * The star system's shell (WEB-REMAKE.md §2): Starfield's HUD.
 *
 *   top      the readout strip (OCTA, the registers, Sign out)
 *   nav      a tab strip of the five hub routes, ← and → stepping between them;
 *            at 640 and under it is a bottom bar of the same five
 *   main     the mission panel, then the route (the map draws its own panels)
 *   hints    the key-hint bar, bottom-right at 1440, hidden on a phone
 *
 * The nav sits OUTSIDE `<main>` now (NEXT-SESSION §0p.2): a landmark of its
 * own, and the gate's surfaces are the route's, not the chrome's.
 */
const TABS = [
  { to: "/app", label: "Map", short: "Map", end: true },
  { to: "/app/stages", label: "Stages", short: "Stages", end: false },
  { to: "/app/progress", label: "Progress", short: "Progress", end: false },
  { to: "/app/work", label: "Your work", short: "Work", end: false },
  { to: "/app/settings", label: "Settings", short: "Settings", end: false },
] as const;

function currentTab(pathname: string): number {
  const i = TABS.findIndex((t) => (t.end ? pathname === t.to || pathname === `${t.to}/` : pathname.startsWith(t.to)));
  return i < 0 ? 0 : i;
}

export function StarShell({ signedIn }: { signedIn: boolean }): JSX.Element {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const online = useOnline();
  const [reporting, setReporting] = useState(false);
  const isMap = pathname === "/app" || pathname === "/app/";
  const here = currentTab(pathname);
  const prev = TABS[(here + TABS.length - 1) % TABS.length]!;
  const next = TABS[(here + 1) % TABS.length]!;

  useKeyHints("shell", [
    ...(isMap ? [] : [{ key: "m", cap: "M", label: "Map", run: () => nav("/app") }]),
    { key: "f", cap: "F", label: "Report a problem", run: () => setReporting(true) },
  ]);

  // A route change closes the report dialog rather than carrying it along.
  useEffect(() => setReporting(false), [pathname]);

  return (
      <div className={`star-shell${isMap ? " is-map" : ""}`} data-shell>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {!isMap && <Starfield />}

        <header className="star-top">
          <Readout dress="hud" />
          <button
            type="button"
            className="star-signout"
            onClick={async () => {
              await signOut();
              nav("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </header>

        <nav className="star-nav" aria-label="Main">
          <Link className="star-nav-step" to={prev.to} aria-label={`Previous: ${prev.label}`}>
            <span aria-hidden="true">←</span>
          </Link>
          <ul className="star-tabs">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink to={t.to} end={t.end} className="star-tab" aria-label={t.label}>
                  <span className="star-tab-long">{t.label}</span>
                  <span className="star-tab-short" aria-hidden="true">
                    {t.short}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
          <Link className="star-nav-step" to={next.to} aria-label={`Next: ${next.label}`}>
            <span aria-hidden="true">→</span>
          </Link>
        </nav>

        {!online && (
          <p className="shell-banner" role="status">
            You are offline. Answers you give in a check are kept and sent when you reconnect.
          </p>
        )}

        <main id="main" className={`star-main${isMap ? " is-map" : ""}`}>
          {!isMap && <MissionPanel />}
          <Outlet />
        </main>

        <KeyHintBar dress="hud" />
        {reporting && <FeedbackDialog framed="hud-panel" onClose={() => setReporting(false)} />}
        {signedIn && <SusSurvey />}
      </div>
  );
}

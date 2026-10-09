import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { signOut } from "../lib/auth";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { SusSurvey } from "../components/SusSurvey";
import { Readout } from "./Readout";
import { MissionPanel } from "./MissionPanel";
import { Starfield } from "./Starfield";
import { KeyHintBar } from "./KeyHintBar";
import { useKeyHints } from "./keyHints";
import { useOnline } from "./useOnline";
import { api } from "../lib/api";
import { useChatLive } from "../lib/chat-live";
import { clearProfile, useProfile } from "../lib/profile";
import { Avatar } from "../components/Avatar";
import { Tour } from "./Tour";
import { RouteBoundary } from "../components/RouteBoundary";

/**
 * The star system's shell (WEB-REMAKE.md §2): Starfield's HUD.
 *
 *   top      the readout strip (OCTA, the registers, Sign out)
 *   nav      a tab strip of the six hub routes, ← and → stepping between them;
 *            at 640 and under it is a bottom bar of the same six. Chat (6 Oct
 *            2026, docs/CHAT-PLAN.md) carries the count of unread @mentions
 *   main     the mission panel, then the route (the map draws its own panels)
 *   hints    the key-hint bar, bottom-right at 1440, hidden on a phone
 *
 * The nav sits OUTSIDE `<main>` now (NEXT-SESSION §0p.2): a landmark of its
 * own, and the gate's surfaces are the route's, not the chrome's.
 */
const TABS = [
  { to: "/app", label: "Map", short: "Map", end: true, tour: "map" },
  { to: "/app/stages", label: "Stages", short: "Stages", end: false, tour: "stages" },
  { to: "/app/progress", label: "Progress", short: "Progress", end: false, tour: "progress" },
  { to: "/app/work", label: "Your work", short: "Work", end: false, tour: "work" },
  { to: "/app/chat", label: "Chat", short: "Chat", end: false, tour: "chat" },
  { to: "/app/settings", label: "Settings", short: "Settings", end: false, tour: "settings" },
] as const;

/**
 * The tour runs by itself ONCE per student, on their first visit to the map, and
 * the ? brings it back. "Once" is remembered per account in this browser (a
 * convenience, never a grade): a student who signs in on a second device sees it
 * there too, and one who clears site data sees it again, which does no harm.
 */
const tourKey = (userId: string) => `octa:tour:v1:${userId}`;

/**
 * Unread @mentions, for the Chat tab: read on every route change, and on any
 * chat message where Realtime is available (no polling here: the chat page
 * polls for itself). Silent on failure: no count is better than a wrong one.
 */
function useChatMentions(pathname: string): number {
  const [n, setN] = useState(0);
  const read = useCallback(() => {
    void api
      .chatUnread()
      .then((u) => setN(u.mentions))
      .catch(() => setN(0));
  }, []);
  useEffect(read, [read, pathname]);
  useChatLive("nav", null, read, false);
  return n;
}

function currentTab(pathname: string): number {
  const i = TABS.findIndex((t) => (t.end ? pathname === t.to || pathname === `${t.to}/` : pathname.startsWith(t.to)));
  return i < 0 ? 0 : i;
}

export function StarShell({ signedIn }: { signedIn: boolean }): JSX.Element {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [query] = useSearchParams();
  const online = useOnline();
  const [reporting, setReporting] = useState(false);
  const isMap = pathname === "/app" || pathname === "/app/";
  const here = currentTab(pathname);
  const mentions = useChatMentions(pathname);
  const { profile } = useProfile();
  const [touring, setTouring] = useState(false);
  const prev = TABS[(here + TABS.length - 1) % TABS.length]!;
  const next = TABS[(here + 1) % TABS.length]!;

  useKeyHints("shell", [
    ...(isMap ? [] : [{ key: "m", cap: "M", label: "Map", run: () => nav("/app") }]),
    { key: "f", cap: "F", label: "Report a problem", run: () => setReporting(true) },
  ]);

  // A route change closes the report dialog rather than carrying it along.
  useEffect(() => setReporting(false), [pathname]);

  // First ever visit to the map: start the tour, and remember that it has been shown.
  // The key is written when it STARTS (not when it is finished), so a reload mid-tour
  // does not loop it, and only inside the timer, so React's double effect cannot eat it.
  const userId = profile?.id ?? null;
  useEffect(() => {
    if (!userId || pathname !== "/app") return;
    const t = window.setTimeout(() => {
      try {
        // An automated browser (Playwright, a screenshot job) is not a student, and the
        // tour's shield would block every script that visits the map. `octa:tour:force`
        // lets the tour's own spec exercise the real path.
        if (navigator.webdriver === true && localStorage.getItem("octa:tour:force") !== "1") return;
        if (localStorage.getItem(tourKey(userId))) return;
        localStorage.setItem(tourKey(userId), new Date().toISOString());
      } catch {
        return; // no storage: it cannot be remembered, so it is not forced on anyone
      }
      setTouring(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [userId, pathname]);

  return (
      <div
        className={`star-shell${isMap ? " is-map" : ""}${pathname === "/app/chat" ? " is-chat" : ""}${pathname === "/app/chat" && query.get("room") ? " is-chat-thread" : ""}`}
        data-shell
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {!isMap && <Starfield />}

        <header className="star-top">
          <Readout dress="hud" />
          {/* What's new (7 Oct 2026, night): in the top strip, not a seventh
              tab, so the bottom bar at 640 keeps its six. */}
          <button type="button" className="star-help" aria-label="Take the tour of the app" data-tour="help" onClick={() => setTouring(true)}>
            ?
          </button>
          <NavLink className="star-news" to="/app/changelog">
            What&apos;s new
          </NavLink>
          <button
            type="button"
            className="star-signout"
            onClick={async () => {
              await signOut();
              clearProfile();
              nav("/login", { replace: true });
            }}
          >
            Sign out
          </button>
          {/* Your profile (8 Oct 2026): your own picture, or your system's planet, links to it. */}
          <NavLink
            className={({ isActive }) => `star-me${isActive ? " active" : ""}`}
            to="/app/profile"
            aria-label="Your profile"
            data-me=""
            data-tour="profile"
          >
            <Avatar avatar={profile?.avatar} size="sm" />
            <span className="star-me-label" aria-hidden="true">
              Profile
            </span>
          </NavLink>
        </header>

        <nav className="star-nav" aria-label="Main">
          <Link className="star-nav-step" to={prev.to} aria-label={`Previous: ${prev.label}`}>
            <span aria-hidden="true">←</span>
          </Link>
          <ul className="star-tabs">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className="star-tab"
                  data-tour={t.tour}
                  aria-label={
                    t.to === "/app/chat" && mentions > 0
                      ? `${t.label}, ${mentions} unread mention${mentions === 1 ? "" : "s"}`
                      : t.label
                  }
                >
                  <span className="star-tab-long">{t.label}</span>
                  <span className="star-tab-short" aria-hidden="true">
                    {t.short}
                  </span>
                  {t.to === "/app/chat" && mentions > 0 && (
                    <span className="star-tab-count mono" aria-hidden="true" data-chat-mentions="">
                      {mentions}
                    </span>
                  )}
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
          <RouteBoundary resetKey={pathname}>
            <Outlet />
          </RouteBoundary>
        </main>

        <KeyHintBar dress="hud" />
        {reporting && <FeedbackDialog framed="hud-panel" onClose={() => setReporting(false)} />}
        {signedIn && <SusSurvey />}
        {touring && <Tour onClose={() => setTouring(false)} />}
      </div>
  );
}

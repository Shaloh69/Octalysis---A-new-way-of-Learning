import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Users, Lock, BookOpen, Table2, ScrollText, ShieldCheck, MessageSquare,
  Boxes, ClipboardCheck, Radio, FileCheck2, LogOut, Menu, X, ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getIdentity, isStaff, setTheme, signOut, type Identity, type Theme } from "@/lib/session";
import { useDelayed } from "@/lib/useDelayed";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangeCredentialsScreen, StudentAccountScreen } from "@/pages/GateScreens";

/**
 * The console shell: sidebar, nav, account block, and the 380 top bar.
 * `design/templates/console/shell/SPEC.md`, against shadcn-admin's sidebar.
 *
 * The nav is grouped by JOB, an instructor ruling of 28 Sep 2026: the two
 * pages opened mid-class first, then the students' record, then the course's
 * material, then the records that keep the system honest. Within a group,
 * the order is how much each page is used (`apps/console/CLAUDE.md`).
 * Every route is offered; none was added or removed by the grouping.
 */
const GROUPS = [
  {
    id: "in-class",
    label: "In class",
    items: [
      { to: "/locks", label: "Locks", icon: Lock, hint: "Open or close a stage for one student" },
      { to: "/live", label: "Live", icon: Radio, hint: "What the room is doing. Projector view: no names, ever" },
    ],
  },
  {
    id: "students",
    label: "Students",
    items: [
      { to: "/students", label: "Students", icon: Users, hint: "Roster, progress, and paper drill-down" },
      { to: "/submissions", label: "Submissions", icon: ClipboardCheck, hint: "Labs, project, participation — 40% of the grade" },
      { to: "/gradebook", label: "Gradebook", icon: Table2, hint: "Every student's grade so far, exportable" },
    ],
  },
  {
    id: "course",
    label: "Course",
    items: [
      { to: "/assessments", label: "Assessments", icon: FileCheck2, hint: "What a student can open. Nothing to sit without one" },
      { to: "/items", label: "Items", icon: Boxes, hint: "The bank: preview, review, approve, retire" },
      { to: "/content", label: "Content", icon: BookOpen, hint: "Stages, objectives, authoring status" },
    ],
  },
  {
    id: "records",
    label: "Records",
    items: [
      { to: "/audit", label: "Audit log", icon: ScrollText, hint: "Who changed what, and why" },
      { to: "/system", label: "System health", icon: ShieldCheck, hint: "The invariant suite, run live" },
      { to: "/feedback", label: "Feedback", icon: MessageSquare, hint: "Reports from students" },
    ],
  },
] as const;

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: "bare-metal", label: "Bare metal" },
  { value: "blueprint", label: "Blueprint" },
  { value: "phosphor", label: "Phosphor" },
];

/** What the 380 bar calls the page you are on. */
function pageName(pathname: string): string {
  for (const g of GROUPS) {
    for (const i of g.items) if (pathname === i.to || pathname.startsWith(`${i.to}/`)) return i.label;
  }
  return pathname.startsWith("/attempts/") ? "Attempt" : "Teacher console";
}

function initials(identity: Identity): string {
  const source = identity.fullName ?? identity.email ?? "";
  const words = source.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * `bare`: the same guard, no frame. For `/live/present` (29 Sep 2026), the
 * projector view: it must be staff-only like every console route, and it must
 * not carry the nav, which as an overlay it once hid but left in the Tab order.
 */
export function AppShell({ bare = false }: { bare?: boolean }) {
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    void getIdentity().then(setIdentity);
  }, []);

  /*
   * §0b.3: this used to render "Checking your access…" the instant the shell
   * mounted, so it blinked on every load. Under 400ms nothing renders; past
   * it, the shell's own shape; past 3s, a sentence saying why it is slow.
   */
  const checking = identity === undefined;
  const slow = useDelayed(checking, 400);
  const verySlow = useDelayed(checking, 3000);

  /*
   * ONE sign-out, for all three places that offer it (the account menu, the
   * student screen, the credential screen). §0b.2: it used to land on
   * /signin in silence. The toaster is mounted at the app root, so the toast
   * survives the navigation.
   */
  const leave = useCallback(
    async (who: Identity) => {
      try {
        await signOut();
      } catch {
        toast.error(
          "Not signed out",
          "The sign-in service did not answer. Try again, or close this browser window.",
        );
        return;
      }
      toast.success(
        "Signed out",
        `${who.email ?? who.fullName ?? "This account"} is no longer signed in on this browser.`,
      );
      navigate("/signin", { replace: true });
    },
    [navigate],
  );

  if (checking) return slow ? <ShellSkeleton slow={verySlow} /> : null;

  /*
   * The guard. It decides what to RENDER, and nothing more.
   *
   * Every console route calls requireStaff() on the server and RLS denies
   * beneath that, so a student who edits this out of the bundle still gets 403
   * and reads nothing. Role comes from the JWT, never from profiles.role — a
   * student who rewrites their own profiles row is still a student here.
   */
  // Nobody signed in: send them to the sign-in page rather than a dead-end.
  // This used to render a screen with one link to the student app and NO WAY
  // IN, which is what a deployed console showed a teacher on first open.
  if (identity === null) return <Navigate to="/signin" replace />;

  /*
   * Signed in, but a student. A different situation and a different screen:
   * there is nothing to try again here, so it explains and offers the two
   * things that can help -- the app they actually want, and a way OUT of this
   * session so a teacher sharing the machine can sign in.
   */
  if (!isStaff(identity.role)) {
    return <StudentAccountScreen identity={identity} onSignOut={() => void leave(identity)} />;
  }

  /*
   * THE BOOTSTRAP ACCOUNT HAS NOT CHANGED ITS CREDENTIALS YET.
   *
   * `bootstrap-admin.mjs` creates the first staff account with a password
   * PRINTED TO A TERMINAL. It has been seen — scrolled back to, copied, possibly
   * screenshotted — so it is not a secret, and this account can read every
   * answer key in the bank.
   *
   * This blocks the whole console rather than showing a dismissible banner. A
   * banner on the busiest screen in the app is a banner nobody reads, and the
   * window between "deployed" and "credentials changed" is exactly when a known
   * password matters most.
   *
   * The flag lives in `app_metadata`, which is service-role only, so it cannot
   * be cleared by editing a row — only by actually changing the credentials.
   */
  if (identity.mustChangeCredentials) {
    return <ChangeCredentialsScreen identity={identity} onSignOut={() => void leave(identity)} />;
  }

  if (bare) return <Outlet />;
  return <Shell identity={identity} onSignOut={() => void leave(identity)} />;
}

/* ------------------------------------------------------------------ the frame */

function Shell({ identity, onSignOut }: { identity: Identity; onSignOut: () => void }) {
  const [navOpen, setNavOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { pathname, key } = useLocation();

  /** Close the 380 sheet; `refocus` sends focus back to the button that opened it. */
  const close = useCallback((refocus: boolean) => {
    setNavOpen(false);
    if (refocus) requestAnimationFrame(() => menuButton.current?.focus());
  }, []);

  // Any route change closes the sheet: a nav link, Back, or a link in <main>.
  const openRef = useRef(navOpen);
  openRef.current = navOpen;
  useEffect(() => {
    if (openRef.current) close(true);
  }, [key, close]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape inside the account menu closes that menu, not the sheet under it.
      if (e.key !== "Escape" || (e.target as Element | null)?.closest?.("[role=menu]")) return;
      close(true);
    };
    // A disclosure, not a modal: nothing is trapped. Tabbing on into the page
    // closes the sheet, without pulling focus back out of where it went.
    const onFocus = (e: FocusEvent) => {
      if ((e.target as Element | null)?.closest?.("main")) close(false);
    };
    // Widening past lg while open: the sidebar is simply there.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onWide = () => mq.matches && close(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      mq.removeEventListener("change", onWide);
    };
  }, [navOpen, close]);

  return (
    <div className="shell">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-toast focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>

      {/* The 380 bar. The console is used on a tablet at the front of a room,
          and the bar says which page that tablet is on. */}
      <header data-shell className="shell-bar lg:hidden">
        <Button
          ref={menuButton}
          variant="ghost"
          size="icon"
          aria-expanded={navOpen}
          aria-controls="console-nav"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          onClick={() => (navOpen ? close(true) : setNavOpen(true))}
        >
          {navOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </Button>
        <span className="shell-bar-rule" aria-hidden="true" />
        <span className="font-display text-base text-ink">{pageName(pathname)}</span>
      </header>

      {navOpen && (
        <div className="dialog-scrim shell-scrim lg:hidden" data-state="open" aria-hidden="true" onClick={() => close(true)} />
      )}

      <aside
        id="console-nav"
        data-shell
        className={cn("shell-side", navOpen ? "shell-side-open" : "hidden lg:flex")}
      >
        <div className="shell-brand">
          <img src="/icon.svg" alt="" width={32} height={32} className="shell-mark" />
          <div className="min-w-0">
            <p className="font-display text-base text-ink">OCTA</p>
            <p className="text-xs text-ink-muted">CPE 412 · Teacher console</p>
          </div>
        </div>

        <nav aria-label="Console sections" className="shell-nav">
          {GROUPS.map((g) => (
            <div key={g.id} className="shell-group">
              <p id={`nav-${g.id}`} className="shell-group-label">
                {g.label}
              </p>
              <ul aria-labelledby={`nav-${g.id}`}>
                {g.items.map(({ to, label, icon: Icon, hint }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      title={hint}
                      className={({ isActive }) => cn("shell-link", isActive && "shell-link-current")}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <AccountMenu identity={identity} onSignOut={onSignOut} />
      </aside>

      <main id="main" tabIndex={-1} className="shell-main">
        <Outlet />
      </main>

      {/* The toaster is NOT here: it is mounted once in App.tsx, so the gate
          screens outside this layout, and /signin after a sign-out, reach it. */}
    </div>
  );
}

/* ------------------------------------------------------------------ the foot */

function AccountMenu({ identity, onSignOut }: { identity: Identity; onSignOut: () => void }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "bare-metal",
  );
  const name = identity.fullName ?? identity.email ?? "Signed in";
  const role = identity.role === "admin" ? "Admin" : "Teacher";

  return (
    <div className="shell-foot">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shell-account"
            aria-label={`${name}${identity.email && identity.fullName ? `, ${identity.email}` : ""}, account menu`}
          >
            <span className="shell-avatar" aria-hidden="true">
              {initials(identity)}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm text-ink" title={name}>
                {name}
              </span>
              {identity.email && identity.fullName && (
                <span className="block truncate text-xs text-ink-muted" title={identity.email}>
                  {identity.email}
                </span>
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="shell-menu">
          <DropdownMenuLabel className="text-ink">
            <span className="block truncate text-sm">{name}</span>
            {identity.email && <span className="block truncate text-xs text-ink-muted">{identity.email}</span>}
            <span className="block text-xs text-ink-muted">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(v) => {
              setTheme(v as Theme);
              setThemeState(v as Theme);
            }}
          >
            {THEMES.map((t) => (
              <DropdownMenuRadioItem key={t.value} value={t.value}>
                {t.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ------------------------------------------------------------------ loading */

/** The shell's own shape, shown only once checking access has taken 400ms. */
function ShellSkeleton({ slow }: { slow: boolean }) {
  return (
    <div className="shell" aria-busy="true">
      <header data-shell className="shell-bar lg:hidden">
        <span className="skeleton-bar h-5 w-5" />
        <span className="skeleton-bar w-24" />
      </header>
      <aside data-shell className="shell-side hidden lg:flex" aria-hidden="true">
        <div className="shell-brand">
          <span className="skeleton-bar h-8 w-8" />
          <span className="skeleton-bar w-24" />
        </div>
        <div className="shell-nav">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className="skeleton-bar shell-skel-link" />
          ))}
        </div>
      </aside>
      <main id="main" className="shell-main">
        <p role="status" className="text-sm text-ink-muted">
          Checking your access…
        </p>
        {slow && (
          <p className="mt-2 text-sm text-ink-muted">
            Still checking. The sign-in service can take a moment to answer.
          </p>
        )}
      </main>
    </div>
  );
}

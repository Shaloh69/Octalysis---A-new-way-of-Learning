import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Users, Lock, BookOpen, Table2, ScrollText, ShieldCheck, MessageSquare,
  Boxes, ClipboardCheck, Radio, LogOut, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getIdentity, isStaff, setTheme, signOut, type Identity, type Theme } from "@/lib/session";
import { Button } from "@/components/ui/button";

/**
 * The console shell.
 *
 * Ordered by how much each page will actually be used, which is the order
 * `apps/console/CLAUDE.md` gives — not alphabetically, and not by how
 * interesting each page was to build.
 */
const NAV = [
  { to: "/locks", label: "Locks", icon: Lock, hint: "Open or close a stage for one student" },
  { to: "/students", label: "Students", icon: Users, hint: "Roster, progress, and paper drill-down" },
  { to: "/live", label: "Live", icon: Radio, hint: "What the room is doing. Projector view: no names, ever" },
  { to: "/items", label: "Items", icon: Boxes, hint: "The bank: preview, review, approve, retire" },
  { to: "/submissions", label: "Submissions", icon: ClipboardCheck, hint: "Labs, project, participation — 40% of the grade" },
  { to: "/gradebook", label: "Gradebook", icon: Table2, hint: "Mastery per stage, exportable" },
  { to: "/content", label: "Content", icon: BookOpen, hint: "Stages, objectives, authoring status" },
  { to: "/audit", label: "Audit log", icon: ScrollText, hint: "Who changed what, and why" },
  { to: "/system", label: "System health", icon: ShieldCheck, hint: "The invariant suite, run live" },
  { to: "/feedback", label: "Feedback", icon: MessageSquare, hint: "Reports from students" },
] as const;

export function AppShell() {
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void getIdentity().then(setIdentity);
  }, []);

  if (identity === undefined) {
    return <div className="p-8 text-sm text-ink-muted">Checking your access…</div>;
  }

  /*
   * The guard. It decides what to RENDER, and nothing more.
   *
   * Every console route calls requireStaff() on the server and RLS denies
   * beneath that, so a student who edits this out of the bundle still gets 403
   * and reads nothing. Role comes from the JWT, never from profiles.role — a
   * student who rewrites their own profiles row is still a student here.
   */
  if (identity === null || !isStaff(identity.role)) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-2 font-display text-xl">This is the teacher console</h1>
        <p className="mb-5 text-sm text-ink-muted">
          {identity === null
            ? "You are not signed in."
            : "Your account is a student account. If that is wrong, your instructor can change it."}
        </p>
        <Button asChild variant="outline">
          <a href={import.meta.env.VITE_WEB_URL ?? "http://localhost:5173"}>Go to the student app</a>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-toast focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>

      {/* Mobile bar. The console is used on a tablet at the front of a room. */}
      <div className="flex items-center justify-between border-b border-line bg-surface-1 p-3 lg:hidden">
        <span className="font-display text-base">OCTA Console</span>
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={navOpen}
          aria-controls="console-nav"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          onClick={() => setNavOpen((v) => !v)}
        >
          {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <nav
        id="console-nav"
        aria-label="Console sections"
        className={cn(
          "shrink-0 border-line bg-surface-1 lg:w-64 lg:border-r",
          navOpen ? "block border-b" : "hidden lg:block",
        )}
      >
        <div className="hidden p-5 lg:block">
          <p className="font-display text-lg text-ink">OCTA</p>
          <p className="text-xs text-ink-muted">Teacher console</p>
        </div>

        <ul className="p-2">
          {NAV.map(({ to, label, icon: Icon, hint }) => (
            <li key={to}>
              <NavLink
                to={to}
                title={hint}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast",
                    isActive
                      ? "bg-accent-muted text-accent"
                      : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="border-t border-line p-4">
          <p className="truncate text-xs text-ink-muted" title={identity.email ?? ""}>
            {identity.fullName ?? identity.email ?? "Signed in"}
          </p>
          <p className="mb-3 text-xs text-ink-faint">{identity.role}</p>

          <label className="mb-1 block text-xs text-ink-muted" htmlFor="theme-select">
            Theme
          </label>
          <select
            id="theme-select"
            className="mb-3 h-8 w-full rounded-md border border-line bg-surface-0 px-2 text-xs text-ink"
            defaultValue={document.documentElement.getAttribute("data-theme") ?? "bare-metal"}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="bare-metal">Bare metal</option>
            <option value="blueprint">Blueprint</option>
            <option value="phosphor">Phosphor</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
              navigate("/");
              setIdentity(null);
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </div>
      </nav>

      <main id="main" className="min-w-0 flex-1 p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
}

import { useRef } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { MoreHorizontal, ShieldAlert } from "lucide-react";
import type { TeacherRow } from "@octa/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Identity } from "@/lib/session";
import { canDisable, classLabel, ROLE_WORDS, STATUS_TONE, STATUS_WORDS } from "@/lib/teachers-view";

/** The signed-in identity, from AppShell's outlet (only /teachers reads it). */
export const useIdentity = () => useOutletContext<Identity>();

/**
 * What a teacher sees at an admin's URL. The nav never offers it to them and
 * the API answers 403 to every call the page would make; this is courtesy, so
 * they are told rather than shown a page of errors.
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const me = useIdentity();
  if (me.role === "admin") return <>{children}</>;
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface-1 px-6 py-8" role="alert">
      <ShieldAlert className="h-6 w-6 text-ink-muted" aria-hidden="true" />
      <h1 className="font-display text-xl text-ink">This page is the admin&apos;s</h1>
      <p className="max-w-lg text-sm text-ink-muted">
        Teachers, their classes and the teacher roster are managed by the admin. If you need a class
        assigned or a colleague added, ask them.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/locks">Back to Locks</Link>
      </Button>
    </div>
  );
}

export interface TeacherActions {
  assign: (t: TeacherRow, from: HTMLElement | null) => void;
  status: (t: TeacherRow, from: HTMLElement | null) => void;
}

/** The `⋯` menu: open, assign, and the destructive item last and apart. */
export function TeacherMenu({ teacher, me, on }: { teacher: TeacherRow; me: string | null; on: TeacherActions }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const disableable = canDisable(teacher, me);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger ref={trigger} aria-label={`Actions for ${teacher.fullName}`} className="roster-menu-trigger">
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={`/teachers/${encodeURIComponent(teacher.key)}`}>Open</Link>
        </DropdownMenuItem>
        {teacher.userId && teacher.status === "active" ? (
          <DropdownMenuItem onSelect={() => on.assign(teacher, trigger.current)}>Assign class…</DropdownMenuItem>
        ) : null}
        {disableable ? (
          <>
            <DropdownMenuSeparator />
            {teacher.status === "disabled" ? (
              <DropdownMenuItem onSelect={() => on.status(teacher, trigger.current)}>Re-enable…</DropdownMenuItem>
            ) : (
              <DropdownMenuItem tone="danger" onSelect={() => on.status(teacher, trigger.current)}>
                Disable…
              </DropdownMenuItem>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Classes({ t }: { t: TeacherRow }) {
  const live = t.classes.filter((c) => c.endedAt === null);
  if (live.length === 0) {
    return <span className="text-ink-muted">{t.status === "unclaimed" ? "Classes after they claim" : "No classes yet"}</span>;
  }
  return (
    <span className="teacher-classes">
      {live.map((c) => (
        <span key={c.id} className="teacher-class" title={`${c.term}${c.bookLabel ? ` · ${c.bookLabel}` : ""}`}>
          {classLabel(c)}
        </span>
      ))}
    </span>
  );
}

const tokens = (t: TeacherRow) =>
  t.tokensThisMonth > 0 ? <span className="num">{t.tokensThisMonth.toLocaleString("en-US")}</span> : <span className="text-ink-muted">None yet</span>;

function Name({ t }: { t: TeacherRow }) {
  return (
    <>
      <Link to={`/teachers/${encodeURIComponent(t.key)}`} className="roster-name">
        {t.fullName}
      </Link>
      {t.email ? <span className="block truncate text-xs text-ink-muted" title={t.email}>{t.email}</span> : null}
    </>
  );
}

/** At 56rem of its own width and up: seven columns, never a sideways scroll. */
export function TeacherTable({ rows, me, on }: { rows: TeacherRow[]; me: string | null; on: TeacherActions }) {
  return (
    <table className="roster-table">
      <colgroup>
        <col className="c-id" />
        <col />
        <col className="c-role" />
        <col className="c-state" />
        <col className="c-classes" />
        <col className="c-num" />
        <col className="c-menu" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Employee ID</th>
          <th scope="col">Name</th>
          <th scope="col">Role</th>
          <th scope="col">Status</th>
          <th scope="col">Classes</th>
          <th scope="col" className="num-col">AI tokens, this month</th>
          <th scope="col"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.key} data-teacher={t.key} data-state={t.status === "disabled" ? "deactivated" : t.status}>
            <td className="num text-xs">{t.employeeId ?? <span className="text-ink-muted">none</span>}</td>
            <td className="min-w-0"><Name t={t} /></td>
            <td>{ROLE_WORDS[t.role]}</td>
            <td><Badge tone={STATUS_TONE[t.status]}>{STATUS_WORDS[t.status]}</Badge></td>
            <td><Classes t={t} /></td>
            <td className="num-col">{tokens(t)}</td>
            <td className="c-menu-cell"><TeacherMenu teacher={t} me={me} on={on} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Below 56rem: one card per teacher, the same controls. */
export function TeacherList({ rows, me, on }: { rows: TeacherRow[]; me: string | null; on: TeacherActions }) {
  return (
    <ul className="roster-list" aria-label="Teachers">
      {rows.map((t) => (
        <li key={t.key} data-teacher={t.key} data-state={t.status === "disabled" ? "deactivated" : t.status} className="teacher-list-item">
          <div className="min-w-0">
            <Name t={t} />
            <p className="roster-list-meta">
              <span className="num">{t.employeeId ?? "no ID"}</span>
              <span>{ROLE_WORDS[t.role]}</span>
              <Badge tone={STATUS_TONE[t.status]}>{STATUS_WORDS[t.status]}</Badge>
            </p>
            <div className="mt-1 text-sm"><Classes t={t} /></div>
            <p className="roster-list-meta">
              <span>AI tokens this month: {tokens(t)}</span>
            </p>
          </div>
          <TeacherMenu teacher={t} me={me} on={on} />
        </li>
      ))}
    </ul>
  );
}

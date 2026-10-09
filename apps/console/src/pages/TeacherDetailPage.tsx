import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import type { TeacherClass, TeacherUsage } from "@octa/contracts";
import { ApiError, getTeacher } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { canDisable, ROLE_WORDS, STATUS_TONE, STATUS_WORDS } from "@/lib/teachers-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { RemovePictureDialog } from "@/components/RemovePictureDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminOnly, useIdentity } from "./teachers/parts";
import { AssignClassDialog, ClassChangeDialog, TeacherStatusDialog, type AssignPreset, type ClassChange } from "./teachers/dialogs";

/**
 * `/teachers/:key`: the admin's page for ONE teacher (T1, 7 Oct 2026;
 * `design/templates/console/teachers-detail/SPEC.md`; gated by
 * `design/specs/console-teachers-detail.spec.ts`).
 *
 * Their record, their classes (assign, change a class's book, end or re-open
 * one), their AI use (totals by month and engine, never a draft: round six),
 * and disable or re-enable. `:key` is a user id, or `employee:<id>` for a
 * roster row nobody has claimed yet.
 */

export function TeacherDetailPage() {
  return (
    <AdminOnly>
      <TeacherDetail />
    </AdminOnly>
  );
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "never";

function TeacherDetail() {
  const { key = "" } = useParams();
  const me = useIdentity();
  // A key that names nobody is a state of its own, not a failure to retry.
  const res = useAsync(
    () => getTeacher(key).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),
    [key],
  );
  const data = res.data;
  const firstLoad = res.loading && !data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  const [assign, setAssign] = useState<AssignPreset | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [removingPicture, setRemovingPicture] = useState(false);
  const [change, setChange] = useState<ClassChange | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const remember = (el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  };

  if (!res.loading && !res.error && data === null) {
    return (
      <div className="rounded-lg border border-line bg-surface-1 px-6 py-8">
        <h1 className="font-display text-xl text-ink">No such teacher</h1>
        <p className="mt-1 text-sm text-ink-muted">They may have been typed wrong, or never put on the roster.</p>
        <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/teachers">Back to Teachers</Link></Button>
      </div>
    );
  }

  const t = data?.teacher;
  const live = (t?.classes ?? []).filter((c) => c.endedAt === null);
  const ended = (t?.classes ?? []).filter((c) => c.endedAt !== null);

  return (
    <div className="teacher-detail">
      <Link to="/teachers" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Teachers
      </Link>

      {res.error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">This teacher could not be loaded. <span className="text-ink-muted">{res.error}</span></p>
          <Button size="sm" variant="outline" onClick={res.reload}>Try again</Button>
        </div>
      ) : !data || !t ? (
        showSkeleton ? <DetailSkeleton slow={slow} /> : <div className="min-h-[24rem]" aria-busy="true" />
      ) : (
        <>
          <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3" data-teacher-header="">
            <div className="record-who min-w-0">
              <Avatar avatar={t.avatar} size="lg" />
              <div className="min-w-0">
              <h1 className="font-display text-2xl text-ink" data-state={t.status === "disabled" ? "deactivated" : t.status}>{t.fullName}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                <span className="num text-ink">{t.employeeId ?? "no employee ID"}</span>
                <span>{ROLE_WORDS[t.role]}</span>
                <Badge tone={STATUS_TONE[t.status]}>{STATUS_WORDS[t.status]}</Badge>
                {t.email ? <span className="break-all">{t.email}</span> : null}
                <span>{t.lastSignInAt ? `last signed in ${when(t.lastSignInAt)}` : "never signed in"}</span>
              </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {t.userId && t.status === "active" ? (
                <Button variant="outline" onClick={() => { remember(); setAssign({ teacher: t }); }}>Assign class</Button>
              ) : null}
              {/* Only where the server said so (`can_remove_avatar`: the admin, for anyone). */}
              {t.userId && t.avatar.removable ? (
                <Button variant="outline" onClick={() => { remember(); setRemovingPicture(true); }}>Remove picture…</Button>
              ) : null}
              {canDisable(t, me.userId) ? (
                <Button
                  variant={t.status === "disabled" ? "default" : "outline"}
                  className={t.status === "disabled" ? undefined : "text-danger"}
                  onClick={() => { remember(); setStatusOpen(true); }}
                >
                  {t.status === "disabled" ? "Re-enable…" : "Disable…"}
                </Button>
              ) : null}
            </div>
          </header>

          <section aria-label="At a glance" className="teacher-stats">
            <Stat label="Classes held" value={String(data.stats.classes)} />
            <Stat label="Students in them" value={String(data.stats.students)} />
            <Stat label="AI tokens, this month" value={data.stats.tokensThisMonth > 0 ? data.stats.tokensThisMonth.toLocaleString("en-US") : "None yet"} mono={data.stats.tokensThisMonth > 0} />
            <Stat label="AI cost, this month" value={data.stats.costThisMonth > 0 ? `$${data.stats.costThisMonth.toFixed(2)}` : "None yet"} mono={data.stats.costThisMonth > 0} />
          </section>

          <section aria-labelledby="classes-heading" className="mt-6">
            <h2 id="classes-heading" className="font-display text-lg text-ink">Classes</h2>
            {t.classes.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                {t.userId ? "No classes yet. Assign one above." : "A class can be assigned once they claim their account."}
              </p>
            ) : (
              <ul className="roster-card unassigned-list mt-2" aria-label="Classes">
                {[...live, ...ended].map((c) => (
                  <ClassRow key={c.id} c={c} onChange={(kind, from) => { remember(from); setChange({ kind, cls: c }); }} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="usage-heading" className="mt-6">
            <h2 id="usage-heading" className="font-display text-lg text-ink">AI use</h2>
            <p className="mb-2 text-sm text-ink-muted">Totals by month and engine, from their own AI Assistant app. Never a draft or a prompt.</p>
            <Usage rows={data.usage} />
          </section>

          <AssignClassDialog
            preset={assign}
            teachers={[t]}
            sections={data.sections}
            subjects={data.subjects}
            onClose={() => setAssign(null)}
            onDone={res.reload}
            returnFocus={() => opener.current}
          />
          <RemovePictureDialog
            owner={removingPicture && t.userId ? { userId: t.userId, name: t.fullName, avatar: t.avatar } : null}
            onClose={() => setRemovingPicture(false)}
            onDone={res.reload}
            returnFocus={() => opener.current}
          />
          <TeacherStatusDialog teacher={statusOpen ? t : null} onClose={() => setStatusOpen(false)} onDone={res.reload} returnFocus={() => opener.current} />
          <ClassChangeDialog change={change} subjects={data.subjects} onClose={() => setChange(null)} onDone={res.reload} returnFocus={() => opener.current} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="teacher-stat">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={mono ? "num text-2xl text-ink" : "text-base text-ink-muted"}>{value}</p>
    </div>
  );
}

function ClassRow({ c, onChange }: { c: TeacherClass; onChange: (kind: ClassChange["kind"], from: HTMLElement | null) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const label = `${c.sectionCode} · ${c.subjectCode}`;
  return (
    <li className="unassigned-row" data-class={c.id} data-ended={c.endedAt ? "" : undefined}>
      <span className="min-w-0">
        <span className={c.endedAt ? "text-sm text-ink-muted line-through" : "text-sm text-ink"}>{label}</span>
        <span className="block text-xs text-ink-muted">
          <span className="num">{c.term}</span> · <span className="num">{c.students}</span> {c.students === 1 ? "student" : "students"}
          {c.bookLabel ? <> · {c.bookLabel}{c.bookId === null ? " (the subject's default)" : ""}</> : null}
          {c.endedAt ? <> · ended {when(c.endedAt)}</> : null}
        </span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger ref={trigger} aria-label={`Actions for ${label}, ${c.term}`} className="roster-menu-trigger">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {c.endedAt ? (
            <DropdownMenuItem onSelect={() => onChange("reopen", trigger.current)}>Re-open class…</DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => onChange("book", trigger.current)}>Change book…</DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={() => onChange("end", trigger.current)}>End class…</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function Usage({ rows }: { rows: TeacherUsage[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-4 text-sm text-ink-muted" data-usage-empty="">
        No AI use yet. Totals appear here once they draft with the AI Assistant app on their laptop.
      </p>
    );
  }
  const months = [...new Set(rows.map((r) => r.month))].sort().reverse();
  const ordered = months.flatMap((m) => rows.filter((r) => r.month === m));
  const cost = (r: TeacherUsage) => (r.costUsd > 0 ? `$${r.costUsd.toFixed(2)}` : "free");
  return (
    <>
    {/* Below sm a five-column table breaks its numbers mid-figure: a list instead. */}
    <ul className="roster-card unassigned-list sm:hidden" aria-label="AI use by month">
      {ordered.map((r) => (
        <li key={`${r.month}-${r.engine}`} className="unassigned-row">
          <span className="min-w-0">
            <span className="num text-sm text-ink">{r.month}</span> <span className="text-sm text-ink">· {r.engine}</span>
            <span className="block text-xs text-ink-muted">
              in <span className="num whitespace-nowrap text-ink">{r.tokensIn.toLocaleString("en-US")}</span> · out{" "}
              <span className="num whitespace-nowrap text-ink">{r.tokensOut.toLocaleString("en-US")}</span>
            </span>
          </span>
          <span className="num whitespace-nowrap text-sm text-ink">{cost(r)}</span>
        </li>
      ))}
    </ul>
    <table className="roster-table roster-card max-sm:hidden">
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Engine</th>
          <th scope="col" className="num-col">Tokens in</th>
          <th scope="col" className="num-col">Tokens out</th>
          <th scope="col" className="num-col">Cost</th>
        </tr>
      </thead>
      <tbody>
        {months.flatMap((m) =>
          rows.filter((r) => r.month === m).map((r) => (
            <tr key={`${m}-${r.engine}`}>
              <td className="num">{m}</td>
              <td>{r.engine}</td>
              <td className="num num-col">{r.tokensIn.toLocaleString("en-US")}</td>
              <td className="num num-col">{r.tokensOut.toLocaleString("en-US")}</td>
              <td className="num num-col">{cost(r)}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
    </>
  );
}

function DetailSkeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton="" aria-busy="true" aria-label="Loading the teacher" className="min-h-[24rem]">
      {slow ? <p role="status" className="mb-3 text-sm text-ink-muted">Still loading. If the API has been asleep it can take up to a minute to wake.</p> : null}
      <div className="teacher-stats">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="teacher-stat"><span className="skeleton-bar" /></div>)}
      </div>
    </div>
  );
}

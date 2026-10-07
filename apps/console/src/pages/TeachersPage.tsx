import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, Upload } from "lucide-react";
import type { TeacherRow, TeacherStatus } from "@octa/contracts";
import { getTeachers } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { classLabel, STATUS_WORDS, teacherCounts, teacherMatches, teachesSubject } from "@/lib/teachers-view";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { AdminOnly, TeacherList, TeacherTable, useIdentity, type TeacherActions } from "./teachers/parts";
import { AssignClassDialog, TeacherImportDialog, TeacherStatusDialog, type AssignPreset } from "./teachers/dialogs";

/**
 * `/teachers`: the ADMIN's page of every teacher (T1, 7 Oct 2026;
 * `design/templates/console/teachers/SPEC.md`; gated by
 * `design/specs/console-teachers.spec.ts`).
 *
 * Who teaches, what classes they hold, who has claimed their account, and how
 * much AI each uses this month (totals only). It owns three writes, each
 * audited by the API: the teacher roster import (dry run first), assigning a
 * class, and disabling or re-enabling a teacher (a reason, the employee ID
 * typed back; never an admin, never yourself). The admin is also a teacher,
 * so their own row is here with their classes.
 */

const WIDE_PX = 896; // 56rem, as /students

type StatusFilter = TeacherStatus | "all";
const FILTERS: Array<[StatusFilter, string]> = [
  ["all", "All"],
  ["active", STATUS_WORDS.active],
  ["unclaimed", STATUS_WORDS.unclaimed],
  ["disabled", STATUS_WORDS.disabled],
];

export function TeachersPage() {
  return (
    <AdminOnly>
      <Teachers />
    </AdminOnly>
  );
}

function Teachers() {
  const me = useIdentity();
  const res = useAsync(() => getTeachers(), []);
  const data = res.data;
  const firstLoad = res.loading && !data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  const box = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [subject, setSubject] = useState("all");

  const [importOpen, setImportOpen] = useState(false);
  const [statusFor, setStatusFor] = useState<TeacherRow | null>(null);
  const [assign, setAssign] = useState<AssignPreset | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const remember = (el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  };

  const teachers = useMemo(() => data?.teachers ?? [], [data]);
  const counts = teacherCounts(teachers);
  const shown = useMemo(
    () => teachers.filter((t) => (status === "all" || t.status === status) && teachesSubject(t, subject) && teacherMatches(t, query)),
    [teachers, status, subject, query],
  );

  const on: TeacherActions = {
    assign: (t, from) => {
      remember(from);
      setAssign({ teacher: t });
    },
    status: (t, from) => {
      remember(from);
      setStatusFor(t);
    },
  };

  return (
    <div ref={box} className="roster">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink">Teachers</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Every teacher, the classes they hold, and who has claimed their account. A teacher joins by
            claiming the employee ID you put on the teacher roster; nothing is sent to them.
          </p>
          {data ? (
            <p className="mt-1 text-xs text-ink-muted" data-teacher-counts="">
              <span className="num text-ink">{counts.all}</span> {counts.all === 1 ? "teacher" : "teachers"} ·{" "}
              <span className="num text-ink">{counts.active}</span> active ·{" "}
              <span className="num text-ink">{counts.unclaimed}</span> not yet claimed ·{" "}
              <span className="num text-ink">{counts.disabled}</span> disabled
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { remember(); setAssign({ teacher: null }); }} disabled={!data || data.sections.length === 0}>
            Assign class
          </Button>
          <Button onClick={() => { remember(); setImportOpen(true); }} disabled={!data}>
            <Upload className="h-4 w-4" aria-hidden="true" /> Import roster
          </Button>
        </div>
      </header>

      {res.error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The teachers could not be loaded. <span className="text-ink-muted">{res.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={res.reload}>Try again</Button>
        </div>
      ) : firstLoad || !data ? (
        showSkeleton ? <TeachersSkeleton wide={wide} slow={slow} /> : <div className="min-h-[24rem]" aria-busy="true" />
      ) : (
        <>
          <div className="roster-toolbar">
            <div className="roster-search">
              <Search className="roster-search-icon h-4 w-4" aria-hidden="true" />
              <Input aria-label="Search the teachers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, employee ID or email" className="roster-search-input" />
            </div>
            <div className="roster-filters" role="group" aria-label="Status">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" className="roster-filter" aria-pressed={status === id} onClick={() => setStatus(id)}>
                  {label} <span className="num">{counts[id]}</span>
                </button>
              ))}
            </div>
            {data.subjects.length > 0 ? (
              <label className="roster-section-filter">
                <span className="text-xs text-ink-muted">Subject</span>
                <select className="roster-select" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="all">Every subject</option>
                  {data.subjects.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          {res.error ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-danger bg-danger-bg px-3 py-2">
              <p className="min-w-0 flex-1 text-xs text-ink">Refreshing failed: {res.error}</p>
              <Button size="sm" variant="outline" onClick={res.reload}>Try again</Button>
            </div>
          ) : null}

          <section className="roster-card" aria-label="Teachers">
            {teachers.length === 0 ? (
              <Empty
                title="No teachers yet"
                hint="Import the teacher roster, and each teacher claims their own account with their employee ID."
              />
            ) : shown.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted">
                {query.trim() ? <>No teacher matches &ldquo;{query.trim()}&rdquo;</> : "No teacher is in this view"}
                {status !== "all" || subject !== "all" ? " with the filters set." : "."}
              </p>
            ) : wide ? (
              <TeacherTable rows={shown} me={me.userId} on={on} />
            ) : (
              <TeacherList rows={shown} me={me.userId} on={on} />
            )}
          </section>

          {data.unassigned.length > 0 ? (
            <section className="mt-6" aria-labelledby="unassigned-heading">
              <h2 id="unassigned-heading" className="font-display text-lg text-ink">Classes nobody holds yet</h2>
              <p className="mb-2 text-sm text-ink-muted">Each section became a class of its subject; give each a teacher.</p>
              <ul className="roster-card unassigned-list">
                {data.unassigned.map((c) => (
                  <li key={c.id} className="unassigned-row">
                    <span className="min-w-0">
                      <span className="text-sm text-ink">{classLabel(c)}</span>
                      <span className="block text-xs text-ink-muted">
                        <span className="num">{c.term}</span> · <span className="num">{c.students}</span> {c.students === 1 ? "student" : "students"}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Assign ${classLabel(c)}, ${c.term}`}
                      onClick={(e) => { remember(e.currentTarget); setAssign({ teacher: null, sectionId: c.sectionId, subjectCode: c.subjectCode, term: c.term }); }}
                    >
                      Assign…
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <TeacherImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={res.reload} returnFocus={() => opener.current} />
      <TeacherStatusDialog teacher={statusFor} onClose={() => setStatusFor(null)} onDone={res.reload} returnFocus={() => opener.current} />
      <AssignClassDialog
        preset={assign}
        teachers={teachers}
        sections={data?.sections ?? []}
        subjects={data?.subjects ?? []}
        onClose={() => setAssign(null)}
        onDone={res.reload}
        returnFocus={() => opener.current}
      />
    </div>
  );
}

function TeachersSkeleton({ wide, slow }: { wide: boolean; slow: boolean }) {
  return (
    <div data-skeleton="" data-cols={wide ? 7 : 1} aria-busy="true" aria-label="Loading the teachers" className="roster-card min-h-[24rem]">
      {slow ? (
        <p role="status" className="px-4 pt-3 text-sm text-ink-muted">
          Still loading. If the API has been asleep it can take up to a minute to wake.
        </p>
      ) : null}
      <div className="p-3">
        {Array.from({ length: 6 }, (_, r) => (
          <div key={r} className={wide ? "roster-skel-row" : "roster-skel-row roster-skel-narrow"}>
            {wide ? Array.from({ length: 7 }, (_, c) => <span key={c} className="skeleton-bar" />) : <span className="skeleton-bar" />}
          </div>
        ))}
      </div>
    </div>
  );
}

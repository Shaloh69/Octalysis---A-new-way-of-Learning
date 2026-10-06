import { useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { api, type AttemptDetail, type RosterRow } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { pct } from "@/lib/utils";
import { asRosterRow, dayDate } from "@/lib/record-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDialog } from "./students/StatusDialog";
import { MoveDialog } from "./students/MoveDialog";
import { PasswordDialog } from "./students/PasswordDialog";
import { AttemptList, AttemptTable, type PaperState } from "./record/Attempts";
import { MoonsCard } from "./record/Moons";

/**
 * `/students/:userId`: one student's record. Rebuilt 27 Sep 2026 against
 * `design/templates/console/students-detail/SPEC.md`; gated by
 * `design/specs/console-student-detail.spec.ts`.
 *
 * The question this page answers is "what did this student actually see?",
 * which is what a grade dispute turns on. Every attempt is listed, and opening
 * one regenerates the exact paper from the stored seed, in place, so a teacher
 * keeps their place in the list (TanStack's sub-component row).
 *
 * The header is Primer's record header: back to the list, who, their state in
 * a word, the facts in one line, and one Actions menu holding the roster's own
 * section move and deactivation, reused rather than copied.
 */

/** Below this much of its OWN width six columns do not fit: a list instead. */
const TABLE_PX = 640; // 40rem

export function StudentDetailPage() {
  const { userId = "" } = useParams();
  const record = useAsync(() => api.student(userId), [userId]);
  const data = record.data;
  const firstLoad = record.loading && !data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  /* ---- one paper open at a time, each fetched once and kept ---- */
  const [open, setOpen] = useState<string | null>(null);
  const [papers, setPapers] = useState<Record<string, AttemptDetail>>({});
  const [loadingPaper, setLoadingPaper] = useState<string | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);

  async function toggle(attemptId: string): Promise<void> {
    if (open === attemptId) {
      setOpen(null);
      return;
    }
    setOpen(attemptId);
    setPaperError(null);
    if (papers[attemptId]) return;
    setLoadingPaper(attemptId);
    try {
      const paper = await api.attempt(attemptId);
      setPapers((prev) => ({ ...prev, [attemptId]: paper }));
    } catch {
      setPaperError("This paper could not be loaded. Close it and open it again, or open it on its own page.");
    } finally {
      setLoadingPaper(null);
    }
  }
  const paperState: PaperState = {
    open, papers, loading: loadingPaper, error: paperError, toggle: (id) => void toggle(id),
  };

  /* ---- the attempts' own width decides table or list ---- */
  const box = useRef<HTMLElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= TABLE_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data !== null]);

  /* ---- the roster's dialogs, opened from the Actions menu ---- */
  const [statusFor, setStatusFor] = useState<RosterRow | null>(null);
  const [moving, setMoving] = useState<RosterRow[] | null>(null);
  const [resetting, setResetting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  if (record.error && !data) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-ink">
          This record could not be loaded. <span className="text-ink-muted">{record.error}</span>
        </p>
        <Button size="sm" variant="outline" onClick={record.reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (firstLoad || !data) {
    return showSkeleton ? <RecordSkeleton slow={slow} /> : <div className="min-h-[32rem]" aria-busy="true" />;
  }

  const { student, attempts, progress } = data;
  const row = asRosterRow(data);
  const registered = dayDate(student.claimedAt);

  return (
    <div className="record">
      <header className="record-head">
        <Link to="/students" className="record-back">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Students
        </Link>
        <div className="record-title">
          <h1 className="font-display text-2xl text-ink">{student.fullName}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={trigger} variant="outline" size="sm" aria-label={`Actions for ${student.fullName}`}>
                Actions <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setMoving([row])}>Move to section…</DropdownMenuItem>
              {/* A deactivated account is refused everywhere; a new password would not let it in. */}
              {!student.deactivated && (
                <DropdownMenuItem onSelect={() => setResetting(true)}>Reset password…</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {student.deactivated ? (
                <DropdownMenuItem onSelect={() => setStatusFor(row)}>Reactivate…</DropdownMenuItem>
              ) : (
                <DropdownMenuItem tone="danger" onSelect={() => setStatusFor(row)}>
                  Deactivate…
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="record-facts" data-record-facts="">
          <Badge tone={student.deactivated ? "neutral" : "success"} data-record-state="">
            {student.deactivated ? "Deactivated" : "Registered"}
          </Badge>
          <span className="num text-ink">{student.studentId}</span>
          <span aria-hidden="true">·</span>
          <span>{student.sectionCode ?? "no section"}</span>
          <span aria-hidden="true">·</span>
          <span>{registered ? `registered ${registered}` : "registration date not recorded"}</span>
        </p>
        {student.deactivated ? (
          <p className="text-sm text-ink-muted">
            Refused on every request until reactivated. Their attempts and grades below are kept.
          </p>
        ) : null}
      </header>

      {record.error ? (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-danger bg-danger-bg px-3 py-2">
          <p className="min-w-0 flex-1 text-xs text-ink">Refreshing failed: {record.error}</p>
          <Button size="sm" variant="outline" onClick={record.reload}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="record-body">
        <section ref={box} className="record-card" aria-labelledby="attempts-h" data-attempts="">
          <div className="record-card-head">
            <h2 id="attempts-h" className="font-display text-lg text-ink">Attempts</h2>
            <p className="text-xs text-ink-muted">
              Opening one regenerates the exact paper they sat from their stored seed, not a fresh one.
            </p>
          </div>
          {attempts.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">
              No attempts yet. An assessment appears here once this student presses Start.
            </p>
          ) : wide ? (
            <AttemptTable attempts={attempts} p={paperState} />
          ) : (
            <AttemptList attempts={attempts} p={paperState} />
          )}
        </section>

        {/* The side column: the check's result by stage, then the moons (30 Sep 2026). */}
        <div className="record-side">
        <section className="record-card" aria-labelledby="progress-h">
          <div className="record-card-head">
            <h2 id="progress-h" className="font-display text-lg text-ink">Progress by stage</h2>
          </div>
          {progress.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">
              Nothing recorded yet. Progress appears once this student opens a stage.
            </p>
          ) : (
            <ul className="record-progress">
              {progress.map((p) => (
                <li key={p.stageId}>
                  <span className="num text-xs text-ink-muted">{p.stageId}</span>
                  <span className="record-bar" role="img" aria-label={`Stage ${p.stageId}: ${pct(p.mastery)} mastery`}>
                    <span style={{ width: `${Math.round(p.mastery * 100)}%` }} />
                  </span>
                  <span className="num text-xs text-ink">{pct(p.mastery)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {data.moons ? <MoonsCard moons={data.moons} /> : null}
        </div>
      </div>

      <PasswordDialog
        student={resetting ? { userId, fullName: student.fullName, studentId: student.studentId } : null}
        onClose={() => setResetting(false)}
        returnFocus={() => trigger.current}
      />
      <StatusDialog
        student={statusFor}
        onClose={() => setStatusFor(null)}
        onDone={record.reload}
        returnFocus={() => trigger.current}
      />
      <MoveDialog
        students={moving}
        sections={data.sections ?? []}
        onClose={() => setMoving(null)}
        onDone={record.reload}
        returnFocus={() => trigger.current}
      />
    </div>
  );
}

/** The page's shape before the page: a header, then attempt rows beside a progress column. */
function RecordSkeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton="" aria-busy="true" aria-label="Loading this student" className="record min-h-[32rem]">
      {slow ? (
        <p role="status" className="mb-3 text-sm text-ink-muted">
          Still loading. If the API has been asleep it can take up to a minute to wake.
        </p>
      ) : null}
      <div className="record-head">
        <span className="skeleton-bar record-skel-back" />
        <span className="skeleton-bar record-skel-title" />
        <span className="skeleton-bar record-skel-facts" />
      </div>
      <div className="record-body">
        <div className="record-card p-4">
          {Array.from({ length: 5 }, (_, r) => (
            <div key={r} className="record-skel-row"><span className="skeleton-bar" /></div>
          ))}
        </div>
        <div className="record-card p-4">
          {Array.from({ length: 7 }, (_, r) => (
            <div key={r} className="record-skel-row"><span className="skeleton-bar" /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

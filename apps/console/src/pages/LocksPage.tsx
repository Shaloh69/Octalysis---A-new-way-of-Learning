import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type LockCell, type SetLockInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn, pct } from "@/lib/utils";
import { nextLockState } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * The lock matrix — students × stages.
 *
 * TWO RULES SHAPE THIS WHOLE PAGE.
 *
 * 1. **The console never computes a lock.** Every cell's `unlocked` comes from
 *    `is_stage_unlocked()`, the same function the student app reads. CLAUDE.md
 *    hard rule 4. If this page decided for itself, a teacher could be looking at
 *    a green cell while the student sees a locked one, and the teacher would be
 *    the one who is wrong.
 *
 * 2. **A reason is mandatory.** The server rejects an override under 3
 *    characters and INV-22 checks for it in the database, so this dialog is not
 *    the enforcement — it is the part that makes the enforcement humane, by
 *    asking before the request fails. In December, when a grade is challenged,
 *    `audit_log` is the evidence and "why" is the column that matters.
 *
 * Three states per cell, and they are genuinely different things:
 *   auto      — the curriculum decides. No person has intervened.
 *   unlocked  — a person opened it early, and said why.
 *   locked    — a person closed it, and said why.
 */

interface PendingChange {
  userId: string;
  studentName: string;
  stageId: string;
  stageTitle: string;
  next: "locked" | "unlocked" | "auto";
  current: LockCell | undefined;
}

export function LocksPage() {
  const { data, error, loading, reload } = useAsync(() => api.locks(), []);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading) return <Loading what="the lock matrix" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  if (data.students.length === 0) {
    return (
      <>
        <Header />
        <Empty
          title="No students have registered yet"
          hint="The matrix fills in as students claim their roster entry. Import a roster first, then students register with their student ID."
          action={
            <Button asChild variant="outline">
              <Link to="/students">Go to the roster</Link>
            </Button>
          }
        />
      </>
    );
  }

  const cellFor = (userId: string, stageId: string): LockCell | undefined =>
    data.cells.find((c) => c.userId === userId && c.stageId === stageId);

  async function commit() {
    if (!pending) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input: SetLockInput = {
        scope: "user",
        stageId: pending.stageId,
        state: pending.next,
        userId: pending.userId,
        reason: reason.trim(),
      };
      await api.setLock(input);
      setPending(null);
      setReason("");
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "That change was not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />

      <div className="table-scroll rounded-lg border border-line bg-surface-1">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Lock state for every student and stage. Each button opens a dialog to change one cell.
          </caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface-1 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                Student
              </th>
              {data.stages.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  title={s.title}
                  className="px-1 py-2 text-center text-xs font-semibold text-ink-muted"
                >
                  <span className="num">{s.id}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.students.map((st) => (
              <tr key={st.userId} className="border-b border-line last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface-1 px-3 py-1.5 text-left font-normal"
                >
                  <Link
                    to={`/students/${st.userId}`}
                    className="text-ink hover:text-accent hover:underline"
                  >
                    {st.fullName}
                  </Link>
                  <span className="num ml-2 text-xs text-ink-faint">{st.studentId}</span>
                </th>

                {data.stages.map((s) => {
                  const c = cellFor(st.userId, s.id);
                  const overridden = c?.override != null;
                  return (
                    <td key={s.id} className="p-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setPending({
                            userId: st.userId,
                            studentName: st.fullName,
                            stageId: s.id,
                            stageTitle: s.title,
                            next: nextLockState(c?.override),
                            current: c,
                          });
                          setReason("");
                          setSaveError(null);
                        }}
                        aria-label={
                          `${st.fullName}, stage ${s.id} ${s.title}: ` +
                          `${c?.unlocked ? "unlocked" : "locked"}` +
                          `${overridden ? `, overridden to ${c?.override}` : ", automatic"}` +
                          `, mastery ${pct(c?.mastery ?? 0)}. Change.`
                        }
                        title={
                          overridden
                            ? `Override: ${c?.override}\n${c?.reason ?? ""}`
                            : `Automatic · mastery ${pct(c?.mastery ?? 0)}`
                        }
                        className={cn(
                          "h-7 w-8 rounded-sm border text-xs transition-colors duration-fast",
                          c?.unlocked
                            ? "border-success bg-success-bg text-success"
                            : "border-locked bg-locked-bg text-locked",
                          // An override is a PERSON's decision and must look
                          // different from the curriculum's. Colour alone would
                          // fail for a colour-blind teacher, so it also carries
                          // a glyph and a thicker border.
                          overridden && "border-accent border-2 text-accent",
                        )}
                      >
                        {overridden ? "●" : c?.unlocked ? "○" : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Legend />

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.next === "auto"
                ? "Return this stage to automatic"
                : pending?.next === "unlocked"
                  ? "Open this stage early"
                  : "Close this stage"}
            </DialogTitle>
            <DialogDescription>
              {pending?.studentName} · Stage {pending?.stageId} {pending?.stageTitle}
            </DialogDescription>
          </DialogHeader>

          {pending?.next === "auto" ? (
            <p className="mb-3 text-sm text-ink-muted">
              The prerequisite rule takes over again. Whether the stage is open then depends on the
              student&apos;s mastery, not on this setting.
            </p>
          ) : null}

          <Label htmlFor="lock-reason">Reason (required)</Label>
          <Textarea
            id="lock-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Missed the 12 Sept lab for a medical appointment"
          />
          <p className="mt-1.5 text-xs text-ink-faint">
            Recorded in the audit log with your name and the time. This is what answers the question
            months later, so write it for someone who was not in the room.
          </p>

          {saveError ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {saveError}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={() => void commit()} disabled={reason.trim().length < 3 || saving}>
              {saving ? "Saving…" : "Save change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Header() {
  return (
    <header className="mb-4">
      <h1 className="mb-1 font-display text-2xl">Locks</h1>
      <p className="max-w-2xl text-sm text-ink-muted">
        Every cell is resolved by the database, not by this page — the same answer the student
        sees. Changing one always asks why, and the answer goes to the audit log.
      </p>
    </header>
  );
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
      <li>
        <span className="num text-success">○</span> open, by the curriculum
      </li>
      <li>
        <span className="num text-locked">·</span> not yet open
      </li>
      <li>
        <span className="num text-accent">●</span> overridden by a person — hover for the reason
      </li>
      <li>
        <Badge tone="neutral">Cycle</Badge> auto → open → closed → auto
      </li>
    </ul>
  );
}

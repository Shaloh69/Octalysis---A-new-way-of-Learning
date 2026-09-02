import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn, pct, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AttemptDetail } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";

/**
 * One student: progress per stage, and every attempt they have made.
 *
 * The attempt link is the point of this page. `apps/console/CLAUDE.md` puts it
 * first in the list of pages by real use, because "what did this student
 * actually see?" is the question a grade dispute turns on -- and OCTA can answer
 * it exactly, months later, from the stored seed.
 */
/**
 * One attempt's regenerated paper, revealed in place.
 *
 * `CONSOLE-DATA-AND-TEMPLATES.md` §2 asks for TanStack's expanding-rows pattern
 * here, "for the attempt-history table where expanding a row reveals the
 * regenerated exact variant". The point is not the widget — it is that a
 * teacher marking a class scans the list, checks one paper, and carries on.
 * Navigating to `/attempts/:id` answers the same question and costs them their
 * place in the list, which for the page `STATUS.md` calls "the page you'll use
 * most" is the wrong trade.
 *
 * So this is a SUMMARY, not a second copy of `AttemptPage`. Per item: ordinal,
 * the stem, what the student answered, and the key. The full page still exists
 * and is still linked, because a disputed mark deserves the whole thing.
 *
 * IT SHOWS THE ANSWER KEY, and that is allowed here for the same reason it is
 * allowed on `AttemptPage`: this is the console, the reader is staff, and
 * `ai_after_submit` grants that read at the database level once the attempt is
 * submitted. This file must never be imported by `apps/web` —
 * `scripts/scan-bundle.mjs` searches the student bundle for exactly these field
 * names, with a live value from the database so the check cannot pass
 * vacuously.
 */
function PaperSummary({ paper }: { paper: AttemptDetail }): JSX.Element {
  return (
    <ol className="m-0 list-none space-y-2 p-0">
      {paper.items.map((item) => (
        <li key={item.ordinal} className="rounded-sm border border-line bg-surface-2 p-2">
          <div className="flex items-baseline gap-2">
            <span className="num text-xs text-ink-faint">{item.ordinal}</span>
            <span className="text-sm">{item.stem}</span>
          </div>
          <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div className="flex gap-1">
              <dt className="text-ink-faint">Answered</dt>
              {/*
                Neutral, never red. Root CLAUDE.md: an incorrect answer gets a
                neutral response, and that rule does not stop applying because
                a teacher is the one reading it -- these screens get projected.
              */}
              <dd className={cn("num", item.isCorrect === false && "text-ink-muted")}>
                {item.studentAnswer ?? "—"}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-ink-faint">Key</dt>
              <dd className="num text-success">{item.correctValue}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-ink-faint">Stage</dt>
              <dd className="num">{item.stageId}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

export function StudentDetailPage() {
  /*
   * One open at a time. A teacher compares a paper against the roster, not two
   * papers against each other -- and stacking several open papers turns a scan
   * list into a scroll.
   */
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);
  const [papers, setPapers] = useState<Record<string, AttemptDetail>>({});
  const [loadingPaper, setLoadingPaper] = useState<string | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);

  async function toggleAttempt(attemptId: string): Promise<void> {
    if (openAttempt === attemptId) {
      setOpenAttempt(null);
      return;
    }
    setOpenAttempt(attemptId);
    setPaperError(null);
    if (papers[attemptId]) return; // fetched once, kept

    setLoadingPaper(attemptId);
    try {
      const paper = await api.attempt(attemptId);
      setPapers((prev) => ({ ...prev, [attemptId]: paper }));
    } catch {
      // Says what happened and what to do, per the gate's error-copy rule.
      setPaperError("That paper could not be loaded. Open it on its own page instead.");
    } finally {
      setLoadingPaper(null);
    }
  }

  const { userId = "" } = useParams();
  const { data, error, loading } = useAsync(() => api.student(userId), [userId]);

  if (loading) return <Loading what="this student" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const { student, attempts, progress } = data;
  const submitted = attempts.filter((a) => a.status === "submitted");

  return (
    <>
      <header className="mb-5">
        <Link to="/students" className="text-xs text-ink-muted hover:text-accent">
          &larr; All students
        </Link>
        <h1 className="mt-1 font-display text-2xl">{student.fullName}</h1>
        <p className="text-sm text-ink-muted">
          <span className="num">{student.studentId}</span>
          {student.sectionCode ? <> &middot; {student.sectionCode}</> : null}
          {student.deactivated ? <> &middot; <Badge tone="danger">Deactivated</Badge></> : null}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progress by stage</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing recorded yet. Progress appears once this student opens a stage.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {progress.map((p) => (
                  <li key={p.stageId} className="flex items-center gap-3">
                    <span className="num w-6 text-xs text-ink-faint">{p.stageId}</span>
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
                      role="img"
                      aria-label={`Stage ${p.stageId}: ${pct(p.mastery)} mastery`}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.round(p.mastery * 100)}%` }}
                      />
                    </div>
                    <span className="num w-10 text-right text-xs text-ink-muted">
                      {pct(p.mastery)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <Empty title="No attempts yet" hint="Assessments this student has started will appear here." />
            ) : (
              <div className="table-scroll">
                <Table>
                  <THead>
                    <TR>
                      <TH>Assessment</TH>
                      <TH>#</TH>
                      <TH>Score</TH>
                      <TH>Status</TH>
                      <TH>Submitted</TH>
                      <TH><span className="sr-only">Open</span></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {attempts.map((a) => {
                      const open = openAttempt === a.attemptId;
                      const rowId = `paper-${a.attemptId}`;
                      return (
                      <Fragment key={a.attemptId}>
                      <TR>
                        <TD>
                          <button
                            type="button"
                            className="-my-1 inline-flex h-8 items-center gap-1 text-left hover:text-ink"
                            aria-expanded={open}
                            aria-controls={rowId}
                            onClick={() => void toggleAttempt(a.attemptId)}
                          >
                            {open ? (
                              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                            )}
                            {a.assessmentTitle}
                          </button>
                        </TD>
                        <TD><span className="num">{a.attemptNo}</span></TD>
                        <TD>
                          <span className="num">
                            {a.score === null ? "—" : `${a.score}/${a.maxScore ?? "?"}`}
                          </span>
                        </TD>
                        <TD>
                          {a.status === "submitted" ? (
                            <Badge tone="success">Submitted</Badge>
                          ) : a.status === "in_progress" ? (
                            <Badge tone="info">In progress</Badge>
                          ) : a.status === "voided" ? (
                            <Badge tone="danger">Voided</Badge>
                          ) : (
                            <Badge tone="neutral">Abandoned</Badge>
                          )}
                        </TD>
                        <TD className="text-xs text-ink-muted">{shortDate(a.submittedAt)}</TD>
                        <TD>
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/attempts/${a.attemptId}`}>Open paper</Link>
                          </Button>
                        </TD>
                      </TR>
                      {open && (
                        <TR id={rowId}>
                          {/*
                            `colSpan` spans the whole table: this is one
                            attempt's detail, not another row of the same shape,
                            and a screen reader reading it as six empty cells
                            plus one full one would be a lie about the structure.
                          */}
                          <TD colSpan={6} className="bg-surface-1 p-3">
                            {loadingPaper === a.attemptId ? (
                              <p className="text-xs text-ink-muted">Regenerating this paper…</p>
                            ) : paperError ? (
                              <p className="text-xs text-ink-muted">{paperError}</p>
                            ) : papers[a.attemptId] ? (
                              <PaperSummary paper={papers[a.attemptId]!} />
                            ) : null}
                          </TD>
                        </TR>
                      )}
                      </Fragment>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
            {submitted.length > 0 ? (
              <p className="mt-3 text-xs text-ink-faint">
                Opening a paper regenerates it from this student&apos;s stored seed — the exact
                variant they sat, not a fresh one.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { pct, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
export function StudentDetailPage() {
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
                    {attempts.map((a) => (
                      <TR key={a.attemptId}>
                        <TD>{a.assessmentTitle}</TD>
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
                    ))}
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

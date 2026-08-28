import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ErrorNote, Loading } from "@/components/ui/empty";

/**
 * Content status — the honest answer to "is the course ready?"
 *
 * The answer is per-chapter, and an aggregate hides it. A progress bar reading
 * "72% complete" would be true and useless; what a teacher needs before Monday
 * is *which chapter* has no teaching text yet.
 *
 * Three states, and they are genuinely different things:
 *
 *   authored  real prose exists, written from the chapter's references
 *   planned   objectives and the syllabus topic outline, no teaching text yet
 *   empty     nothing synced at all
 *
 * **Planned is not a bug.** `scripts/gen-stages.mjs` transcribes what the
 * syllabus contains and refuses to invent the rest — hard rule 5, and
 * `content/stages/README.md` explains why. A stage that shows its shape is
 * honest; a stage filled with plausible-sounding paragraphs nobody vetted is
 * how a wrong definition reaches a student with the platform's authority
 * behind it.
 */
const ACT_NAMES = ["", "Prelim", "Midterm", "Semi-finals", "Finals"];

export function ContentPage() {
  const { data, error, loading } = useAsync(() => api.content(), []);

  if (loading) return <Loading what="content status" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const { stages, summary } = data;
  const itemPct =
    summary.itemTarget === 0 ? 0 : Math.round((summary.liveItems / summary.itemTarget) * 100);

  return (
    <>
      <header className="mb-4">
        <h1 className="mb-1 font-display text-2xl">Content</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Where each chapter stands. Objectives come from the syllabus; teaching text is written
          from the references in <span className="num">docs/CPE412-CURRICULUM.md</span> §4.
        </p>
      </header>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Chapters authored" value={`${summary.authored}/${summary.total}`}
              note={summary.authored === 0 ? "None yet" : undefined} />
        <Stat label="Planned" value={String(summary.planned)}
              note="Objectives and outline ready; prose to come" />
        <Stat label="Objectives" value={String(summary.objectives)}
              note="Transcribed from the syllabus" />
        <Stat
          label="Live items"
          value={`${summary.liveItems}/${summary.itemTarget}`}
          note={`${itemPct}% of the target bank`}
          tone={itemPct < 25 ? "warning" : undefined}
        />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>The item bank is the schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-muted">
            The target is roughly 40 live items per gradeable chapter — about{" "}
            <span className="num">{summary.itemTarget}</span> in total. Code is finite; the bank is
            continuous, and no amount of code substitutes for it. Author eight to ten per chapter by
            hand to set the style, then draft the rest with assistance and approve every one before
            it goes live. A wrong answer key in a live bank is a grading incident, not a bug.
          </p>
        </CardContent>
      </Card>

      <div className="table-scroll rounded-lg border border-line bg-surface-1">
        <Table>
          <caption className="sr-only">Authoring status for every stage</caption>
          <THead>
            <TR>
              <TH>Stage</TH>
              <TH>Chapter</TH>
              <TH>Period</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH>Objectives</TH>
              <TH>Blocks</TH>
              <TH>Live items</TH>
            </TR>
          </THead>
          <TBody>
            {stages.map((s) => (
              <TR key={s.id}>
                <TD><span className="num text-xs">{s.id}</span></TD>
                <TD>
                  {s.title}
                  {!s.gradeable ? (
                    <span className="ml-2 text-xs text-ink-faint">not graded</span>
                  ) : null}
                </TD>
                <TD className="text-xs text-ink-muted">{ACT_NAMES[s.act] ?? s.act}</TD>
                <TD>
                  <span className="num text-xs" title={archetypeName(s.archetype)}>
                    {s.archetype}
                  </span>
                  <span className="num ml-2 text-xs text-ink-faint">
                    L{s.levels.join(",")}
                  </span>
                </TD>
                <TD>
                  {s.authoring === "authored" ? (
                    <Badge tone="success">Authored</Badge>
                  ) : s.authoring === "planned" ? (
                    <Badge tone="info">Planned</Badge>
                  ) : (
                    <Badge tone="neutral">Empty</Badge>
                  )}
                </TD>
                <TD><span className="num">{s.objectives}</span></TD>
                <TD><span className="num">{s.blocks}</span></TD>
                <TD>
                  <span className={s.liveItems === 0 ? "num text-ink-faint" : "num"}>
                    {s.liveItems}
                  </span>
                  {s.draftItems > 0 ? (
                    <span className="num ml-1 text-xs text-ink-faint">+{s.draftItems} draft</span>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <p className="mt-3 max-w-2xl text-xs text-ink-faint">
        Editing content needs no redeploy — the database is the runtime source of truth. The
        markdown under <span className="num">content/stages/</span> is the authoring source, so
        changes stay reviewable in git.
      </p>
    </>
  );
}

function archetypeName(a: string): string {
  return a === "A" ? "concept" : a === "B" ? "computation" : a === "C" ? "artifact" : "simulator";
}

function Stat({
  label, value, note, tone,
}: { label: string; value: string; note?: string | undefined; tone?: "warning" | undefined }) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={tone === "warning" ? "num text-2xl text-warning" : "num text-2xl text-ink"}>
        {value}
      </p>
      {note ? <p className="mt-0.5 text-xs text-ink-faint">{note}</p> : null}
    </div>
  );
}

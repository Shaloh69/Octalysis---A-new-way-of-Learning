import { useState } from "react";
import { api, type FeedbackEntry } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";

/**
 * Feedback — reports from students, and the SUS score.
 *
 * TWO THINGS MAKE THIS PAGE WORTH HAVING.
 *
 * 1. **A content report carries the exact variant.** Every student gets
 *    different numbers, so "question 7 is wrong" is unactionable. The server
 *    attaches the resolved instance — the numbers that student actually saw —
 *    reconstructed from their attempt rather than taken from the client.
 *
 * 2. **SUS is one number, and it is comparable.** 68 is the published average
 *    across hundreds of systems, which is what makes a score meaningful rather
 *    than a vanity metric. It is scored in the database by `sus_score()`, hand-
 *    verified at both ends of the scale.
 */
const STATUSES = ["new", "triaged", "in_progress", "shipped", "wont_fix"] as const;

const STATUS_TONE = {
  new: "accent",
  triaged: "info",
  in_progress: "warning",
  shipped: "success",
  wont_fix: "neutral",
} as const;

export function FeedbackPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(
    () => api.feedback(filter ?? undefined),
    [filter],
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: (typeof STATUSES)[number]) {
    setBusy(id);
    try {
      await api.triageFeedback(id, { status });
      reload();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading what="feedback" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const reports = data.entries.filter((e) => e.channel !== "sus");

  return (
    <>
      <header className="mb-4">
        <h1 className="mb-1 font-display text-2xl">Feedback</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Flags, content reports, and the usability survey. A report about a question arrives with
          the exact numbers that student saw.
        </p>
      </header>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Usability (SUS)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.sus.n === 0 ? (
            <p className="text-sm text-ink-muted">
              No responses yet. The survey appears only after a student has used the system for
              three sessions and finished at least one assessment — it does not nag, and a
              dismissal is remembered.
            </p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-4">
              <p className="num text-3xl text-ink">{data.sus.mean ?? "—"}</p>
              <p className="text-sm text-ink-muted">
                from <span className="num">{data.sus.n}</span> response
                {data.sus.n === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-ink-muted">
                {data.sus.mean !== null && data.sus.mean >= 68 ? (
                  <>Above the published average of 68.</>
                ) : (
                  <>The published average across systems is 68.</>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={filter === null ? "default" : "outline"}
          onClick={() => setFilter(null)}
        >
          All
        </Button>
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s.replace("_", " ")}
          </Button>
        ))}
      </div>

      {reports.length === 0 ? (
        <Empty
          title={filter ? `Nothing with status “${filter.replace("_", " ")}”` : "No reports yet"}
          hint={
            filter
              ? undefined
              : "Students can flag a question or report confusing content from inside a stage. Reports land here with the variant attached."
          }
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((e) => (
            <li key={e.id}>
              <Card>
                <CardContent className="pt-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[e.status]}>{e.status.replace("_", " ")}</Badge>
                    <Badge tone="neutral">{e.channel.replace("_", " ")}</Badge>
                    {e.category ? <Badge tone="neutral">{e.category}</Badge> : null}
                    {e.itemSlug ? (
                      <span className="num text-xs text-ink-faint">{e.itemSlug}</span>
                    ) : null}
                    <time className="num ml-auto text-xs text-ink-faint" dateTime={e.createdAt}>
                      {shortDate(e.createdAt)}
                    </time>
                  </div>

                  {e.body ? (
                    <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{e.body}</p>
                  ) : null}

                  <Variant entry={e} />

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                    <span className="mr-1 text-xs text-ink-muted">
                      {e.reporterName ?? "Anonymous"} · {e.role}
                    </span>
                    {STATUSES.filter((s) => s !== e.status).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="ghost"
                        disabled={busy === e.id}
                        onClick={() => void setStatus(e.id, s)}
                      >
                        {s.replace("_", " ")}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The exact instance the reporter saw.
 *
 * This is the difference between a complaint and a bug report, so it is shown
 * inline rather than behind a disclosure.
 */
function Variant({ entry }: { entry: FeedbackEntry }) {
  const v = entry.resolvedVariant as
    | { ordinal?: number; params?: Record<string, unknown>; stem?: string; options?: string[] }
    | null;
  if (!v) return null;

  return (
    <div className="rounded-md border border-line bg-surface-0 p-3">
      <p className="mb-1.5 text-xs uppercase tracking-wide text-ink-muted">
        The variant this student saw
      </p>
      {v.stem ? <p className="mb-2 whitespace-pre-wrap text-sm text-ink">{v.stem}</p> : null}
      {v.options && v.options.length > 0 ? (
        <ul className="mb-2 space-y-0.5">
          {v.options.map((o, i) => (
            <li key={i} className="text-sm text-ink-muted">
              <span className="num text-xs">{String.fromCharCode(65 + i)}</span> {o}
            </li>
          ))}
        </ul>
      ) : null}
      {v.params && Object.keys(v.params).length > 0 ? (
        <p className="num text-xs text-ink-faint">
          {Object.entries(v.params)
            .map(([k, val]) => `${k}=${String(val)}`)
            .join("  ")}
        </p>
      ) : null}
    </div>
  );
}

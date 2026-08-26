import { Link, useParams } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn, ms } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNote, Loading } from "@/components/ui/empty";

/**
 * The paper a student actually sat — regenerated, not stored.
 *
 * This is the single most useful page in the console, and the reason
 * `attempts.seed` and `attempts.engine_version` exist at all. From those two
 * columns the server replays the exact variant: same numbers, same distractors,
 * same order. `test/console.spec.ts` asserts it byte-identical to what the
 * student saw.
 *
 * IT SHOWS THE ANSWER KEY, AND ONLY HERE. `ai_after_submit` grants staff that
 * read at the database level. This component must never be imported by
 * apps/web; `scripts/scan-bundle.mjs` searches the student bundle for exactly
 * these field names, with a live value pulled from the database so the check
 * cannot pass vacuously.
 */
export function AttemptPage() {
  const { attemptId = "" } = useParams();
  const { data, error, loading } = useAsync(() => api.attempt(attemptId), [attemptId]);

  if (loading) return <Loading what="this paper" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const answered = data.items.filter((i) => i.studentAnswer !== null);
  const correct = data.items.filter((i) => i.isCorrect === true).length;

  return (
    <>
      <header className="mb-5">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="text-xs text-ink-muted hover:text-accent"
        >
          &larr; Back
        </button>
        <h1 className="mt-1 font-display text-2xl">Paper</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span className="num text-xs">{data.attemptId}</span>
          <Badge tone={data.status === "submitted" ? "success" : "info"}>{data.status}</Badge>
          <span>
            engine <span className="num">{data.engineVersion}</span>
          </span>
          <span>
            <span className="num">{correct}</span>/<span className="num">{data.items.length}</span>{" "}
            correct
          </span>
          <span>
            <span className="num">{answered.length}</span> answered
          </span>
        </p>
      </header>

      <p className="mb-4 max-w-2xl rounded-md border border-info bg-info-bg px-4 py-2.5 text-sm text-info">
        Regenerated from this student&apos;s stored seed. These are the exact numbers and options
        they saw — not a fresh draw.
      </p>

      <ol className="space-y-3">
        {data.items.map((i) => {
          const unanswered = i.studentAnswer === null;
          return (
            <li key={i.ordinal}>
              <Card>
                <CardContent className="pt-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="num text-xs text-ink-faint">
                      {String(i.ordinal).padStart(2, "0")}
                    </span>
                    <Badge tone="neutral">Stage {i.stageId}</Badge>
                    {i.objectiveId ? <Badge tone="neutral">{i.objectiveId}</Badge> : null}
                    <Badge tone="neutral">
                      {i.type === "S" ? "static" : i.type === "P" ? "parameterized" : "generated"}
                    </Badge>
                    {unanswered ? (
                      <Badge tone="warning">Not answered</Badge>
                    ) : i.isCorrect ? (
                      <Badge tone="success">
                        <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                        Correct
                      </Badge>
                    ) : (
                      /*
                       * NOT red, and no cross. CLAUDE.md: an incorrect answer
                       * gets a neutral response -- never red, never a buzzer.
                       * The teacher needs to see which ones missed; nobody
                       * needs it shouted, and this view is often on a projector.
                       */
                      <Badge tone="neutral">
                        <Minus className="mr-1 h-3 w-3" aria-hidden="true" />
                        Missed
                      </Badge>
                    )}
                    {i.timeMs !== null ? (
                      <span className="num ml-auto text-xs text-ink-faint">{ms(i.timeMs)}</span>
                    ) : null}
                  </div>

                  <p className="mb-3 whitespace-pre-wrap text-ink">{i.stem}</p>

                  {i.options.length > 0 ? (
                    <ul className="mb-3 space-y-1">
                      {i.options.map((o, k) => {
                        const isKey = o === i.correctValue;
                        const chose = o === i.studentAnswer;
                        return (
                          <li
                            key={`${i.ordinal}-${k}`}
                            className={cn(
                              "flex items-start gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
                              isKey
                                ? "border-success bg-success-bg text-success"
                                : chose
                                  ? "border-line-strong bg-surface-2 text-ink"
                                  : "border-transparent text-ink-muted",
                            )}
                          >
                            <span className="num text-xs">{String.fromCharCode(65 + k)}</span>
                            <span className="flex-1">{o}</span>
                            {isKey ? <span className="text-xs">key</span> : null}
                            {chose && !isKey ? <span className="text-xs">chose</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-ink-muted">Answered</dt>
                      <dd className="num">{i.studentAnswer ?? "—"}</dd>
                      <dt className="text-ink-muted">Key</dt>
                      <dd className="num text-success">{i.correctValue}</dd>
                    </dl>
                  )}

                  {i.rationale ? (
                    <p className="border-t border-line pt-2.5 text-sm text-ink-muted">
                      {i.rationale}
                    </p>
                  ) : null}

                  {i.resolvedParams && Object.keys(i.resolvedParams).length > 0 ? (
                    <p className="num mt-2 text-xs text-ink-faint">
                      {Object.entries(i.resolvedParams)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join("  ")}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-xs text-ink-faint">
        <Link to="/audit" className="hover:text-accent">
          Every change a teacher makes to this student is in the audit log.
        </Link>
      </p>
    </>
  );
}

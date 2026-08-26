import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorNote, Loading } from "@/components/ui/empty";

/**
 * System health — `run_invariants()`, live, on demand.
 *
 * These are the rules a constraint cannot express: an item with no correct
 * option, a lock override with no reason, a blueprint whose cells cannot be
 * filled from the live bank. `db/CLAUDE.md` is explicit that anything a unique
 * index already guarantees does NOT belong here.
 *
 * The page shows notices as notices. On a database with an empty item bank the
 * bank-health checks legitimately have nothing to check, and dressing that up as
 * a failure trains the reader to ignore the page — which is the one outcome that
 * makes an invariant suite worthless.
 */
export function SystemPage() {
  const { data, error, loading, reload } = useAsync(() => api.systemAudit(), []);

  if (loading) return <Loading what="system health" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const failing = data.results.filter((r) => r.severity === "fail" && r.offendingCount > 0);
  const warning = data.results.filter((r) => r.severity === "warn" && r.offendingCount > 0);
  const notices = data.results.filter((r) => r.severity === "notice" && r.offendingCount > 0);
  const clean = data.results.filter((r) => r.offendingCount === 0);

  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl">System health</h1>
          <p className="text-sm text-ink-muted">
            {data.results.length} invariants, run just now against the live database.
          </p>
        </div>
        <Button variant="outline" onClick={reload}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Run again
        </Button>
      </header>

      <div
        className={
          failing.length === 0
            ? "mb-5 rounded-lg border border-success bg-success-bg px-4 py-3 text-success"
            : "mb-5 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-danger"
        }
        role="status"
      >
        <p className="font-display text-base">
          {failing.length === 0
            ? "The database is in a legal state."
            : `${failing.length} invariant(s) failing.`}
        </p>
        <p className="mt-0.5 text-sm">
          <span className="num">{clean.length}</span> clean ·{" "}
          <span className="num">{warning.length}</span> warning ·{" "}
          <span className="num">{notices.length}</span> notice · checked {shortDate(data.ranAt)}
        </p>
      </div>

      {[
        { list: failing, title: "Failing", tone: "danger" as const, note: "Fix these before a class uses the system." },
        { list: warning, title: "Warnings", tone: "warning" as const, note: "Not wrong yet, but heading that way." },
        {
          list: notices,
          title: "Notices",
          tone: "info" as const,
          note: "Expected while the item bank is still being authored — there is nothing yet for these to check.",
        },
      ]
        .filter((g) => g.list.length > 0)
        .map((g) => (
          <section key={g.title} className="mb-5">
            <h2 className="mb-1 font-display text-lg">{g.title}</h2>
            <p className="mb-2 text-sm text-ink-muted">{g.note}</p>
            <ul className="space-y-2">
              {g.list.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-line bg-surface-1 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-xs text-ink-faint">{r.id}</span>
                    <span className="text-ink">{r.name}</span>
                    <Badge tone={g.tone} className="ml-auto">
                      {r.offendingCount} row(s)
                    </Badge>
                  </div>
                  {r.sample ? (
                    <pre className="num mt-2 overflow-x-auto rounded-sm bg-surface-0 p-2 text-xs text-ink-muted">
                      {JSON.stringify(r.sample, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}

      <details className="rounded-md border border-line bg-surface-1 px-4 py-3">
        <summary className="cursor-pointer text-sm text-ink-muted">
          {clean.length} passing invariants
        </summary>
        <ul className="mt-3 space-y-1">
          {clean.map((r) => (
            <li key={r.id} className="flex gap-3 text-sm">
              <span className="num w-16 text-xs text-ink-faint">{r.id}</span>
              <span className="text-ink-muted">{r.name}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

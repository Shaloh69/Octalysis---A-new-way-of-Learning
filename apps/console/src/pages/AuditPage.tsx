import { useMemo, useState } from "react";
import { api, type AuditEntry } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";

/**
 * The audit log.
 *
 * Every write that changes student-visible state lands here with an actor, a
 * target, and a reason. That is a rule enforced on the server, not a habit
 * observed by this page — the console cannot skip it.
 *
 * The log is APPEND-ONLY and this view is read-only, deliberately. There is no
 * delete control and there must never be: a log a teacher can tidy is a log that
 * proves nothing at the one moment it matters.
 */
const TONE: Record<string, "accent" | "info" | "warning" | "danger" | "neutral"> = {
  "lock.set": "warning",
  "auth.register": "info",
  "roster.import": "accent",
  "attempt.void": "danger",
};

export function AuditPage() {
  const { data, error, loading } = useAsync(() => api.audit(300), []);
  const [q, setQ] = useState("");

  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((e) =>
      [e.action, e.actor_name, e.target_type, e.target_id, JSON.stringify(e.payload)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [data, q]);

  if (loading) return <Loading what="the audit log" />;
  if (error) return <ErrorNote message={error} />;

  return (
    <>
      <header className="mb-4">
        <h1 className="mb-1 font-display text-2xl">Audit log</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Who changed what, when, and why. Append-only — entries cannot be edited or removed, by
          anyone, including from here.
        </p>
      </header>

      <div className="mb-3 max-w-xs">
        <Label htmlFor="audit-filter">Filter</Label>
        <Input
          id="audit-filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Action, name, or stage"
        />
      </div>

      {entries.length === 0 ? (
        <Empty
          title={q ? `Nothing matches “${q}”` : "Nothing recorded yet"}
          hint={
            q
              ? undefined
              : "Entries appear as soon as a roster is imported or a lock is changed."
          }
        />
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md border border-line bg-surface-1 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Badge tone={TONE[e.action] ?? "neutral"}>{e.action}</Badge>
                <span className="text-sm text-ink">{e.actor_name ?? "system"}</span>
                {e.target_type ? (
                  <span className="num text-xs text-ink-faint">
                    {e.target_type}
                    {e.target_id ? ` ${e.target_id}` : ""}
                  </span>
                ) : null}
                <time className="num ml-auto text-xs text-ink-faint" dateTime={e.at}>
                  {shortDate(e.at)}
                </time>
              </div>
              <Payload payload={e.payload} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/**
 * The reason gets its own line, in full.
 *
 * It is the field a grade dispute actually turns on, so it is not truncated and
 * not hidden behind a disclosure. Everything else in the payload is detail.
 */
function Payload({ payload }: { payload: AuditEntry["payload"] }) {
  if (!payload || Object.keys(payload).length === 0) return null;
  const { reason, ...rest } = payload as { reason?: unknown } & Record<string, unknown>;

  return (
    <>
      {typeof reason === "string" && reason.length > 0 ? (
        <p className="mt-1.5 border-l-2 border-accent pl-3 text-sm text-ink">{reason}</p>
      ) : null}
      {Object.keys(rest).length > 0 ? (
        <p className="num mt-1.5 break-all text-xs text-ink-faint">
          {Object.entries(rest)
            .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
            .join("  ")}
        </p>
      ) : null}
    </>
  );
}

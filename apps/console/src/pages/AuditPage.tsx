import { useMemo, useState } from "react";
import { api, type AuditEntry } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
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
 *
 * ══ TABLE FIRST, TIMELINE SECOND — and it used to be the other way round ══
 *
 * This page rendered only the card list below. Measured with 24 real entries it
 * cost **109 pixels each**, and the page asks the API for 300 — about 32,600
 * pixels, or 33 screens, to scan a log whose whole purpose is being scanned.
 *
 * `DESIGN-REVIEW-01` D-4 already taught this lesson on the submissions queue
 * (3,436px → 1,219px), and `CONSOLE-DATA-AND-TEMPLATES.md` §2 says so directly
 * for this page: "most admins will want the table by default and the timeline
 * as an alternate view, not the reverse — dense-first, same lesson as the
 * submissions-queue fix."
 *
 * So the table is the default and the timeline is kept, not deleted: reading a
 * sequence of events in order, with the reason prominent, is genuinely better
 * for reconstructing one incident. It is the wrong default for finding it.
 *
 * The toggle passes the mandate's four tests — it changes what you can SEE, its
 * labels say which is which, it is instantly reversible, and it is a real
 * preference rather than a number.
 *
 * THE REASON IS NEVER TRUNCATED, in either view. It is the field a grade
 * dispute actually turns on; density is not allowed to cost it.
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
  const [view, setView] = useState<"table" | "timeline">("table");

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

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xs flex-1">
          <Label htmlFor="audit-filter">Filter</Label>
          <Input
            id="audit-filter"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Action, name, or stage"
          />
        </div>

        {/*
          Two views of one log. `aria-pressed` rather than a tab set: these are
          not panels of different content, they are two renderings of the same
          rows, and calling them tabs would tell a screen-reader user that
          switching moves them somewhere else.
        */}
        <div className="flex gap-1" role="group" aria-label="How to show the log">
          {(["table", "timeline"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={cn(
                "h-9 rounded-sm border px-3 text-sm capitalize transition-colors duration-fast",
                view === mode
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-muted hover:text-ink",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
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
      ) : view === "table" ? (
        <div className="table-scroll rounded-lg border border-line bg-surface-1">
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Who</TH>
                <TH>Target</TH>
                <TH>Reason</TH>
              </TR>
            </THead>
            <TBody>
              {entries.map((e) => {
                const reason = (e.payload as { reason?: unknown } | null)?.reason;
                return (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap">
                      <time className="num text-xs text-ink-faint" dateTime={e.at}>
                        {shortDate(e.at)}
                      </time>
                    </TD>
                    <TD>
                      <Badge tone={TONE[e.action] ?? "neutral"}>{e.action}</Badge>
                    </TD>
                    <TD className="text-sm">{e.actor_name ?? "system"}</TD>
                    <TD className="num text-xs text-ink-faint">
                      {e.target_type ? `${e.target_type}${e.target_id ? ` ${e.target_id}` : ""}` : "—"}
                    </TD>
                    {/*
                      Wraps, never truncates. This is the field a dispute turns
                      on, and the whole point of making the page dense was to
                      make it findable -- clipping it here would trade the thing
                      being looked for against the looking.
                    */}
                    <TD className="max-w-md text-sm">
                      {typeof reason === "string" && reason.length > 0 ? reason : "—"}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
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

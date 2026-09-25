import { useState } from "react";
import { api, type LockMatrix, type ScopeLock } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  localToIso, scopeLabel, scopeToast, when, windowError, windowLine,
} from "@/lib/locks-view";
import type { ReasonRequest } from "./ReasonDialog";

/**
 * Course-wide and section overrides, with their windows. `PAGE-SPECS.md`:
 * "Section-level and scheduled (`unlock_at`) overrides get their own tab."
 *
 * The window is printed as stored. This page never says a window is "active
 * now": `is_stage_unlocked()` decides that (hard rule 4), and its answer is on
 * the matrix, cell by cell.
 */
export function ScopeTab({
  data, reload, ask,
}: {
  data: LockMatrix;
  reload: () => void;
  ask: (r: ReasonRequest) => void;
}) {
  return (
    <div className="grid gap-6">
      <section aria-labelledby="scope-list-h" className="lock-card">
        <header className="lock-card-head">
          <div>
            <h2 id="scope-list-h" className="text-base">Course-wide and section overrides</h2>
            <p className="text-xs text-ink-muted">
              These apply to many students at once. A per-student change on the matrix still wins
              over them.
            </p>
          </div>
        </header>
        {data.scopeLocks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted">
            None. Every stage follows the curriculum, apart from the per-student changes on the
            matrix.
          </p>
        ) : (
          <table className="scope-table">
            <thead>
              <tr>
                <th scope="col">Applies to</th>
                <th scope="col">Stage</th>
                <th scope="col">Set to</th>
                <th scope="col">Window</th>
                <th scope="col">Set by</th>
                <th scope="col">Reason</th>
                <th scope="col"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {data.scopeLocks.map((l) => (
                <ScopeRow key={l.id} l={l} data={data} reload={reload} ask={ask} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AddOverride data={data} reload={reload} />
    </div>
  );
}

function ScopeRow({
  l, data, reload, ask,
}: {
  l: ScopeLock;
  data: LockMatrix;
  reload: () => void;
  ask: (r: ReasonRequest) => void;
}) {
  const stage = data.stages.find((s) => s.id === l.stageId);
  const who = scopeLabel(l);
  const target = l.scope === "global" ? "every student" : `section ${l.sectionCode ?? ""}`;
  return (
    <tr>
      <td data-label="Applies to">{who}</td>
      <td data-label="Stage">
        <span className="num">{l.stageId}</span> {stage?.title}
      </td>
      <td data-label="Set to">{l.state === "unlocked" ? "Open" : "Closed"}</td>
      <td data-label="Window">{windowLine(l) || <span className="text-ink-muted">No window</span>}</td>
      <td data-label="Set by">
        {l.setBy}
        {l.setAt ? <span className="block text-xs text-ink-muted">{when(l.setAt)}</span> : null}
      </td>
      <td data-label="Reason" className="c-reason">{l.reason}</td>
      <td className="c-act">
        <Button
          size="sm"
          variant="outline"
          aria-label={`Return stage ${l.stageId} to automatic for ${target}`}
          onClick={() =>
            ask({
              title: "Return this stage to automatic",
              subject: `${who} · Stage ${l.stageId} ${stage?.title ?? ""}`,
              now: `Now: ${l.state === "unlocked" ? "open" : "closed"} for ${target}, set by ${l.setBy}.`,
              choices: [{ value: "auto", label: "Return to automatic" }],
              initial: "auto",
              note: () =>
                "The override is removed. Each student's stage then follows the curriculum, or any per-student change on the matrix.",
              save: async (_next, reason) => {
                await api.setLock({
                  scope: l.scope,
                  stageId: l.stageId,
                  state: "auto",
                  ...(l.sectionId ? { sectionId: l.sectionId } : {}),
                  reason,
                });
                toast.success(scopeToast(l.stageId, "auto", who));
                reload();
              },
            })
          }
        >
          Return to automatic
        </Button>
      </td>
    </tr>
  );
}

const EVERY = "__every__";

function AddOverride({ data, reload }: { data: LockMatrix; reload: () => void }) {
  const [scope, setScope] = useState<string>(data.sections[0]?.id ?? EVERY);
  const [stageId, setStageId] = useState<string>(data.stages[1]?.id ?? data.stages[0]!.id);
  const [state, setState] = useState<"unlocked" | "locked">("unlocked");
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windowErr = windowError(opens, closes);
  const every = scope === EVERY;
  const section = data.sections.find((s) => s.id === scope);
  const who = every ? "Every student" : `Section ${section?.code ?? ""}`;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const unlockAt = localToIso(opens);
      const lockAt = localToIso(closes);
      await api.setLock({
        scope: every ? "global" : "section",
        stageId,
        state,
        ...(every ? {} : { sectionId: scope }),
        reason: reason.trim(),
        ...(unlockAt ? { unlockAt } : {}),
        ...(lockAt ? { lockAt } : {}),
      });
      toast.success(scopeToast(stageId, state, who));
      setReason("");
      setOpens("");
      setCloses("");
      reload();
    } catch (e) {
      const m = e instanceof Error ? e.message : "Try again.";
      setError(m);
      toast.error(`Stage ${stageId} was not changed`, m);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="scope-add-h" className="lock-card">
      <header className="lock-card-head">
        <div>
          <h2 id="scope-add-h" className="text-base">Add an override</h2>
          <p className="text-xs text-ink-muted">
            For a whole section, or for every student. A window is optional; without one the
            override holds until it is returned to automatic.
          </p>
        </div>
      </header>
      <form
        className="scope-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div>
          <Label htmlFor="scope-to">Applies to</Label>
          <select
            id="scope-to"
            className="h-control-md w-full rounded-md border border-line bg-surface-0 px-2 text-sm text-ink"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            {data.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
            <option value={EVERY}>Every student</option>
          </select>
        </div>
        <div>
          <Label htmlFor="scope-stage">Stage</Label>
          <select
            id="scope-stage"
            className="h-control-md w-full rounded-md border border-line bg-surface-0 px-2 text-sm text-ink"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
          >
            {data.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.title}
              </option>
            ))}
          </select>
        </div>
        {/*
          Two pressed/unpressed buttons rather than a radio pair: only the
          checked radio of a group is in the Tab order, and the gate (rightly)
          counts the other as unreachable from Tab alone.
        */}
        <div className="scope-state">
          <p id="scope-state-l" className="mb-1 text-xs font-medium text-ink-muted">Set it to</p>
          <div role="group" aria-labelledby="scope-state-l" className="flex gap-2">
            {(["unlocked", "locked"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={state === v}
                onClick={() => setState(v)}
                className={
                  "lock-choice h-control-md rounded-md border px-4 text-sm transition-colors duration-fast " +
                  (state === v ? "border-accent bg-accent-muted text-ink" : "border-line bg-surface-0 text-ink")
                }
              >
                {v === "unlocked" ? "Open" : "Closed"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="scope-opens">Opens at</Label>
          <Input id="scope-opens" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="scope-closes">Closes at</Label>
          <Input id="scope-closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
        </div>
        <div className="scope-wide">
          <Label htmlFor="scope-reason">Reason (required)</Label>
          <Textarea id="scope-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div className="scope-wide grid gap-2">
          {every ? (
            <p className="rounded-md border border-warning bg-warning-bg px-3 py-2 text-sm text-ink">
              This changes this stage for every student in the course, in every section.
            </p>
          ) : null}
          {windowErr ? <p className="text-sm text-ink">{windowErr}</p> : null}
          {error ? (
            <p role="alert" className="gate-fault rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink">
              Not saved. {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || reason.trim().length < 3 || windowErr !== null}>
              {saving ? "Saving…" : "Save override"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

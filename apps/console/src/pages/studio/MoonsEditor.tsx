import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Circle, CircleDashed, PenLine, Plus } from "lucide-react";
import { MOON_MIN_QUESTIONS, type MoonsPublishResult, type StudioMoon } from "@octa/contracts";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { GateNote, useApprovalGate } from "@/lib/approval-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * A chapter's MOONS, as an editor (docs/STUDIO-EDITOR-PLAN.md "E2 -- the moons
 * plan"; instructor approval, 8 Oct 2026; design/templates/console/studio-moons/).
 *
 * A moon is an objective: it places a ring on the map and a cell on the
 * competency grid, and the planet after this one opens when every LIVE moon of
 * this one is mastered. So:
 *  - typing is free: a new moon is a DRAFT the lock does not count, an edit or a
 *    retirement waits as an unpublished change; students see none of it;
 *  - Publish names the moons, says who would see a planet close (the lock's own
 *    answer, by a dry run) and which minigame leaves the map, and asks a reason;
 *  - a draft goes live only with enough live questions to fill its journey;
 *  - Retire removes a moon for students and the lock's count; its questions and
 *    every student's record of it stay.
 * What the page decides is what to render. The server decides everything else.
 */

const BLOOMS = ["remember", "understand", "apply", "analyze"] as const;
const COMPETENCIES = ["read", "trace", "build"] as const;
const LEVELS = [0, 1, 2, 3, 4, 5, 6] as const;

interface Fields {
  description: string;
  bloom: (typeof BLOOMS)[number];
  level: number;
  competency: (typeof COMPETENCIES)[number];
}

const fieldsOf = (m: StudioMoon): Fields => ({
  description: m.pending?.action === "edit" ? (m.pending.description ?? m.description) : m.description,
  bloom: (m.pending?.action === "edit" ? m.pending.bloom : null) ?? m.bloom,
  level: (m.pending?.action === "edit" ? m.pending.level : null) ?? m.level ?? 0,
  competency: (m.pending?.action === "edit" ? m.pending.competency : null) ?? m.competency ?? "read",
});

export function MoonsEditor({ stageId, onChanged }: { stageId: string; onChanged?: (() => void) | undefined }) {
  const q = useAsync(() => api.moons(stageId), [stageId]);
  const slow = useDelayed(q.loading && !q.data, 400);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const gate = useApprovalGate(null);
  const data = q.data;

  const reload = () => {
    q.reload();
    onChanged?.();
  };

  if (!data) {
    return (
      <section className="ct-card st-card" aria-labelledby="ob-title" data-moons data-objectives>
        <h2 id="ob-title" className="ct-h2">Moons</h2>
        {q.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-ink">The moons could not be loaded. <span className="text-ink-muted">{q.error}</span></p>
            <Button size="sm" variant="outline" onClick={q.reload}>Try again</Button>
          </div>
        ) : slow ? (
          <div data-skeleton aria-busy="true" aria-label="Loading the moons"><div className="ct-card ct-skel ct-skel-table" /></div>
        ) : <div className="min-h-[12rem]" aria-busy="true" />}
      </section>
    );
  }

  const live = data.moons.filter((m) => m.status === "live").length;
  const waiting = data.moons.filter((m) => m.status !== "retired" && (m.pending || m.status === "draft")).length;

  return (
    <section className="ct-card st-card" aria-labelledby="ob-title" data-moons data-objectives>
      <div className="mn-head">
        <div className="st-head-col">
          <h2 id="ob-title" className="ct-h2">Moons <span className="num text-ink-muted">{live}</span></h2>
          <p className="ct-faint">
            Each moon is something a student must show they can do; the planet after this one opens when every live moon is
            mastered. Typing here changes nothing students see: a change waits until you publish it.
          </p>
        </div>
        {data.gradeable ? (
          <div className="mn-head-actions">
            <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)} aria-expanded={adding} data-moon-add-toggle>
              <Plus aria-hidden="true" className="size-4" /> Add a moon
            </Button>
            <Button size="sm" onClick={() => setPublishing(true)} disabled={waiting === 0 || !gate.allowed} data-moons-publish>
              Review moon changes{waiting > 0 ? <span className="num"> ({waiting})</span> : null}
            </Button>
          </div>
        ) : null}
      </div>
      {!gate.allowed ? <GateNote id="moons-gate" gate={gate} /> : null}

      {!data.gradeable ? (
        <p className="ct-group-empty">This chapter is not graded (orientation), so it has no questions and no moons to master.</p>
      ) : null}

      {adding && data.gradeable ? (
        <MoonForm
          key="add"
          legend="A new moon"
          submitLabel="Add moon"
          note="It starts as a draft. Students never see it, and it does not hold the next planet shut, until it has at least three live questions and you publish it."
          initial={{ description: "", bloom: "understand", level: 3, competency: "read" }}
          onCancel={() => setAdding(false)}
          onSubmit={async (f) => {
            const r = await api.addMoon(stageId, { description: f.description, bloom: f.bloom, level: f.level, competency: f.competency });
            toast.success(`Moon ${r.id} added as a draft`, "Students see nothing yet. Write its questions in Items, then publish it.");
            setAdding(false);
            reload();
          }}
        />
      ) : null}

      {data.moons.length === 0 ? (
        data.gradeable ? <p className="ct-group-empty">This chapter has no moons yet. Add one above.</p> : null
      ) : (
        <ol className="mn-list">
          {data.moons.map((m) => (
            <MoonRow
              key={m.id}
              m={m}
              minQuestions={data.minQuestions}
              editing={editing === m.id}
              onEdit={() => setEditing(m.id)}
              onCancel={() => setEditing(null)}
              onChanged={() => {
                setEditing(null);
                reload();
              }}
            />
          ))}
        </ol>
      )}

      <PublishMoonsDialog
        open={publishing}
        stageId={stageId}
        moons={data.moons}
        hash={data.hash}
        onClose={() => setPublishing(false)}
        onDone={() => {
          setPublishing(false);
          reload();
        }}
      />
    </section>
  );
}

/* --------------------------------------------------------------------- row */

function Status({ m }: { m: StudioMoon }) {
  if (m.status === "retired") return <Badge tone="neutral"><Archive aria-hidden="true" className="mr-1 size-3" />Retired</Badge>;
  if (m.pending?.action === "retire") return <Badge tone="warning"><Archive aria-hidden="true" className="mr-1 size-3" />Retirement waiting to publish</Badge>;
  if (m.pending?.action === "edit") return <Badge tone="info"><PenLine aria-hidden="true" className="mr-1 size-3" />Edit waiting to publish</Badge>;
  if (m.status === "draft") return <Badge tone="neutral"><CircleDashed aria-hidden="true" className="mr-1 size-3" />Draft</Badge>;
  return <Badge tone="success"><Circle aria-hidden="true" className="mr-1 size-3" />Live</Badge>;
}

function MoonRow({ m, minQuestions, editing, onEdit, onCancel, onChanged }: {
  m: StudioMoon;
  minQuestions: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const retired = m.status === "retired";
  const f = fieldsOf(m);

  async function run(label: string, done: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label, done);
      onChanged();
    } catch (e) {
      toast.error(`${label} did not happen`, e instanceof Error ? e.message : "Nothing changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li data-moon={m.id} data-status={m.status} data-pending={m.pending?.action ?? ""} data-objective={m.id} className={retired ? "mn-retired" : undefined}>
      <span className="num st-ob-code">{m.id}</span>
      <div className="min-w-0">
        <div className="mn-line">
          <Status m={m} />
          {m.game ? <Badge tone="info" title="A minigame this moon carries">Game: {m.game}</Badge> : null}
        </div>

        {editing ? (
          <MoonForm
            legend={`Edit moon ${m.id}`}
            submitLabel="Save change"
            note="Saved as a change waiting to publish. Students keep reading the live wording until you publish."
            initial={f}
            onCancel={onCancel}
            onSubmit={async (next) => {
              await api.saveMoonPending(m.id, {
                action: "edit", version: m.pending?.version ?? 0,
                description: next.description, bloom: next.bloom, level: next.level, competency: next.competency,
              });
              toast.success(`Moon ${m.id} change saved`, "Students see it when you publish.");
              onChanged();
            }}
          />
        ) : (
          <>
            <p className={retired ? "text-sm text-ink-muted" : "text-sm text-ink"}>{m.description}</p>
            {m.pending?.action === "edit" ? (
              <p className="mn-change" data-moon-proposed>
                <span className="font-medium">Proposed:</span> {m.pending.description}
                {m.pending.editedBy ? <span className="text-ink-muted"> ({m.pending.editedBy})</span> : null}
              </p>
            ) : null}
            <p className="ct-faint" data-moon-facts>
              {f.bloom} · {f.competency} · ring <span className="num">{f.level}</span>
              {" · "}
              {m.status === "draft" ? (
                <>
                  <span className="num">{m.questions}</span> of <span className="num">{minQuestions}</span> live questions needed
                </>
              ) : (
                <>
                  <span className="num">{m.questions}</span> live {m.questions === 1 ? "question" : "questions"}
                </>
              )}
              {m.notLive > 0 ? <> · <span className="num">{m.notLive}</span> waiting for review</> : null}
              {!retired ? <> · <Link className="ct-link" to="/items">Items</Link></> : null}
            </p>
            {!retired ? (
              <div className="mn-actions">
                <Button size="sm" variant="outline" onClick={onEdit} disabled={busy} aria-label={`Edit moon ${m.id}`}>Edit</Button>
                {m.pending ? (
                  <Button
                    size="sm" variant="ghost" disabled={busy}
                    aria-label={`Discard the change to moon ${m.id}`}
                    onClick={() => void run(`Moon ${m.id} change discarded`, "It reads as it did. Students saw no change.", () => api.discardMoonPending(m.id))}
                  >
                    {m.pending.action === "retire" ? "Keep this moon" : "Discard change"}
                  </Button>
                ) : null}
                {m.pending?.action !== "retire" ? (
                  <Button
                    size="sm" variant="ghost" disabled={busy}
                    aria-label={`Retire moon ${m.id}`}
                    onClick={() => void run(
                      `Moon ${m.id} marked to retire`,
                      m.game
                        ? `It leaves the map when you publish, and takes ${m.game} with it. Nothing is deleted.`
                        : "It leaves the map when you publish. Its questions and every student's record are kept.",
                      () => api.saveMoonPending(m.id, { action: "retire", version: m.pending?.version ?? 0 }),
                    )}
                  >
                    Retire
                  </Button>
                ) : null}
                {m.removable ? (
                  <Button
                    size="sm" variant="ghost" disabled={busy}
                    aria-label={`Delete draft moon ${m.id}`}
                    onClick={() => void run(`Moon ${m.id} deleted`, "It was a draft with no questions and no record.", () => api.deleteMoon(m.id))}
                  >
                    Delete draft
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------- form */

function MoonForm({ legend, submitLabel, note, initial, onSubmit, onCancel }: {
  legend: string;
  submitLabel: string;
  note: string;
  initial: Fields;
  onSubmit: (f: Fields) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Fields>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useMemo(() => legend.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), [legend]);
  const short = f.description.trim().length < 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...f, description: f.description.trim() });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "It was not saved.");
      setBusy(false);
    }
  }

  return (
    <form className="mn-form" onSubmit={(e) => void submit(e)} aria-label={legend} data-moon-form>
      <Label htmlFor={`${id}-text`}>{legend}: what a student must be able to do</Label>
      <Textarea
        id={`${id}-text`} rows={2} value={f.description} autoFocus
        onChange={(e) => setF({ ...f, description: e.target.value })}
        placeholder="e.g. Explain how a direct-mapped cache finds a block"
      />
      <div className="mn-selects">
        <div className="assess-field">
          <Label htmlFor={`${id}-bloom`}>Bloom level</Label>
          <select id={`${id}-bloom`} className="assess-select" value={f.bloom} onChange={(e) => setF({ ...f, bloom: e.target.value as Fields["bloom"] })}>
            {BLOOMS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="assess-field">
          <Label htmlFor={`${id}-level`}>Level (ring)</Label>
          <select id={`${id}-level`} className="assess-select" value={f.level} onChange={(e) => setF({ ...f, level: Number(e.target.value) })}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="assess-field">
          <Label htmlFor={`${id}-comp`}>Competency</Label>
          <select id={`${id}-comp`} className="assess-select" value={f.competency} onChange={(e) => setF({ ...f, competency: e.target.value as Fields["competency"] })}>
            {COMPETENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <p className="ct-faint">{note}</p>
      {error ? <p className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">Not saved. {error}</p> : null}
      <div className="mn-actions">
        <Button type="submit" size="sm" disabled={busy || short}>{busy ? "Saving…" : submitLabel}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- publish */

function PublishMoonsDialog({ open, stageId, moons, hash, onClose, onDone }: {
  open: boolean;
  stageId: string;
  moons: readonly StudioMoon[];
  hash: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const candidates = useMemo(() => moons.filter((m) => m.status !== "retired" && (m.pending || m.status === "draft")), [moons]);
  const ready = (m: StudioMoon) => m.pending?.action === "retire" || m.status !== "draft" || m.publishable;
  const [chosen, setChosen] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MoonsPublishResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChosen(candidates.filter(ready).map((m) => m.id));
    setReason("");
    setBusy(false);
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // What would happen, asked of the server and rolled back: who sees a planet close, which game leaves.
  useEffect(() => {
    if (!open || chosen.length === 0) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let live = true;
    setLooking(true);
    api.publishMoons(stageId, { hash, reason: "preview", ids: chosen, dryRun: true })
      .then((r) => { if (live) { setPreview(r); setPreviewError(null); } })
      .catch((e) => { if (live) { setPreview(null); setPreviewError(e instanceof Error ? e.message : "It could not be previewed."); } })
      .finally(() => { if (live) setLooking(false); });
    return () => { live = false; };
  }, [open, chosen, stageId, hash]);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.publishMoons(stageId, { hash, reason: reason.trim(), ids: chosen, dryRun: false });
      toast.success(
        `${r.applied.length} moon${r.applied.length === 1 ? "" : "s"} published`,
        r.impact.relocked > 0
          ? `${r.impact.relocked} student${r.impact.relocked === 1 ? "" : "s"} will see a planet close until they master the new moon.`
          : "Students read the change now.",
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not published.");
      toast.error("Moons were not published", "The dialog is still open with your reason in it.");
      setBusy(false);
    }
  }

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="ease-dialog max-w-lg max-sm:top-3 max-sm:translate-y-0" data-moons-dialog>
        <DialogHeader>
          <DialogTitle>Publish moons of stage {stageId}?</DialogTitle>
          <DialogDescription>Students see the change from now on. Moons you leave out stay as they are.</DialogDescription>
        </DialogHeader>

        <fieldset className="mn-pick">
          <legend className="sr-only">Moons to publish</legend>
          {candidates.map((m) => {
            const verb = m.pending?.action === "retire" ? "retire" : m.status === "draft" ? "go live" : "change wording";
            const ok = ready(m);
            return (
              <label key={m.id} className="mn-pick-row">
                <input type="checkbox" checked={chosen.includes(m.id)} disabled={!ok || busy} onChange={() => toggle(m.id)} />
                <span className="min-w-0">
                  <span className="num font-medium">{m.id}</span> will {verb}
                  {!ok ? (
                    <span className="ct-faint block">
                      Not ready: <span className="num">{m.questions}</span> of <span className="num">{MOON_MIN_QUESTIONS}</span> live questions. A moon without them would keep its planet shut.
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="mn-summary" data-moons-summary aria-live="polite">
          <p className="mb-1 font-medium">What changes</p>
          {chosen.length === 0 ? <p>Choose at least one moon.</p> : null}
          {looking && !preview ? <p>Working out the effect…</p> : null}
          {previewError ? <p role="alert">Cannot publish yet. {previewError}</p> : null}
          {preview ? (
            <ul className="list-disc space-y-1 pl-5">
              {preview.applied.map((a) => (
                <li key={a.id}><span className="num">{a.id}</span>: {a.moves.length > 0 ? a.moves.join("; ") : a.change}</li>
              ))}
              {preview.impact.relocked > 0 ? (
                <li data-relock>
                  <span className="num">{preview.impact.relocked}</span> student{preview.impact.relocked === 1 ? "" : "s"} who {preview.impact.relocked === 1 ? "has" : "have"} the next
                  planet open ({preview.impact.stages.map((s) => `stage ${s.stageId}`).join(", ")}) would see it close until they master the new moon.
                  You can open it by hand on Locks.
                </li>
              ) : (
                <li>No student loses a planet they have open.</li>
              )}
              {preview.gamesRemoved.map((g) => (
                <li key={g.id}>The minigame <span className="font-medium">{g.name}</span> leaves the map with moon <span className="num">{g.id}</span>. Its code stays.</li>
              ))}
            </ul>
          ) : null}
        </div>

        <Label htmlFor="moons-reason">What changed (required)</Label>
        <Textarea id="moons-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Added a moon for cache write policies" />
        {error ? <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">Not published. {error}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void go()} disabled={reason.trim().length < 3 || busy || chosen.length === 0 || !preview}>
            {busy ? "Publishing…" : "Publish moons"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

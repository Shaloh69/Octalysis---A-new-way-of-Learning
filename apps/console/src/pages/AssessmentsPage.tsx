import { useState } from "react";
import { CalendarClock, Plus, AlertTriangle, Check } from "lucide-react";
import { api, type Blueprint, type Feasibility } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Assessments — the thing a student actually opens.
 *
 * This page closes the gap that made the whole engine unreachable. Blueprints
 * were seeded and papers could be generated, but nothing could CREATE an
 * assessment, so a student had nothing to sit.
 *
 * **THE FEASIBILITY CHECK IS THE POINT.** A blueprint asking for 8 `apply`
 * items from a bank holding 3 cannot be filled, and the engine will say so by
 * throwing — at the moment forty students press Start. This page asks the
 * question first and names the shortfall cell by cell, so the failure happens
 * while there is still time to author items.
 */
export function AssessmentsPage() {
  const { data, error, loading, reload } = useAsync(() => api.assessments(), []);
  const [creating, setCreating] = useState(false);

  if (loading) return <Loading what="assessments" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl">Assessments</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            What a student can open. Each one draws its paper from a blueprint, generated per
            student from their own seed.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New assessment
        </Button>
      </header>

      {data.assessments.length === 0 ? (
        <Empty
          title="No assessments yet"
          hint="Until one exists, a student has nothing to sit — the stage reader shows the material and no check. Create one from a blueprint."
          action={<Button onClick={() => setCreating(true)}>Create the first one</Button>}
        />
      ) : (
        /*
          A TABLE, not a card list — the fourth of these to be converted and the
          last one in the console.

          `/audit` went 109px -> 41px per entry, `/items` 122px -> 72px, and
          `/submissions` 3,436px -> 1,219px (DESIGN-REVIEW-01 D-4). This page had
          the same shape for the same reason: two fixture rows look fine as
          cards, and the real page is one assessment per gradeable chapter plus
          finals, which is a scroll.

          Every field the cards carried is still here. The one thing dropped is
          the REPEATED TITLE: each card printed `a.title` in the heading and
          `a.blueprintName` underneath, and for every fixture row those are the
          same string, so the second line said nothing twice.
        */
        <div className="table-scroll rounded-lg border border-line bg-surface-1">
          <Table>
            <THead>
              <TR>
                <TH>Status</TH>
                <TH>Assessment</TH>
                <TH>Scope</TH>
                <TH className="text-right">Items</TH>
                <TH className="text-right">Attempts</TH>
                <TH>Section</TH>
                <TH>Window</TH>
                <TH className="text-right">Submitted</TH>
              </TR>
            </THead>
            <TBody>
              {data.assessments.map((a) => {
                const closed = a.closesAt ? new Date(a.closesAt) < new Date() : false;
                const pending = a.opensAt ? new Date(a.opensAt) > new Date() : false;
                return (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap">
                      {closed ? (
                        <Badge tone="locked">closed</Badge>
                      ) : pending ? (
                        <Badge tone="info">not open yet</Badge>
                      ) : (
                        <Badge tone="success">open</Badge>
                      )}
                    </TD>
                    <TD className="font-medium text-ink">
                      {a.title}
                      {/*
                        Only when it differs. On the fixtures it never does, and
                        printing it anyway is what made the card's second line
                        redundant.
                      */}
                      {a.blueprintName && a.blueprintName !== a.title ? (
                        <div className="text-xs font-normal text-ink-faint">{a.blueprintName}</div>
                      ) : null}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Badge tone="neutral">
                        {a.scope === "stage" ? `stage ${a.stageId}` : "final"}
                      </Badge>
                    </TD>
                    <TD className="num text-right">{a.totalItems}</TD>
                    <TD className="num whitespace-nowrap text-right">{a.attemptsAllowed}</TD>
                    <TD className="whitespace-nowrap text-xs text-ink-muted">
                      {a.sectionCode ?? "every section"}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-ink-muted">
                      {a.opensAt || a.closesAt ? (
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {a.opensAt ? `opens ${shortDate(a.opensAt)}` : "open now"}
                          {a.closesAt ? ` · closes ${shortDate(a.closesAt)}` : ""}
                        </span>
                      ) : (
                        <span className="text-ink-faint">no window</span>
                      )}
                    </TD>
                    <TD className="num whitespace-nowrap text-right">
                      {a.submitted}/{a.attempts}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}

      {creating && (
        <CreateDialog
          blueprints={data.blueprints}
          onClose={() => setCreating(false)}
          onCreated={reload}
        />
      )}
    </>
  );
}

function CreateDialog({
  blueprints, onClose, onCreated,
}: { blueprints: Blueprint[]; onClose: () => void; onCreated: () => void }) {
  const [blueprintId, setBlueprintId] = useState(blueprints[0]?.id ?? "");
  const [title, setTitle] = useState(blueprints[0]?.name ?? "");
  const [attempts, setAttempts] = useState(5);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const feas = useAsync<Feasibility | null>(
    () => (blueprintId ? api.blueprintFeasibility(blueprintId) : Promise.resolve(null)),
    [blueprintId],
  );

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      await api.createAssessment({
        blueprintId,
        title: title.trim(),
        attemptsAllowed: attempts,
        ...(opensAt ? { opensAt: new Date(opensAt).toISOString() } : {}),
        ...(closesAt ? { closesAt: new Date(closesAt).toISOString() } : {}),
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That was not created.");
    } finally {
      setBusy(false);
    }
  }

  const f = feas.data;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New assessment</DialogTitle>
          <DialogDescription>
            Every student gets a different paper from the same blueprint — same shape, same
            difficulty, different numbers.
          </DialogDescription>
        </DialogHeader>

        <Label htmlFor="bp">Blueprint</Label>
        <select
          id="bp"
          className="mb-4 h-9 w-full rounded-md border border-line bg-surface-0 px-2 text-sm text-ink"
          value={blueprintId}
          onChange={(e) => {
            setBlueprintId(e.target.value);
            const b = blueprints.find((x) => x.id === e.target.value);
            if (b) setTitle(b.name);
          }}
        >
          {blueprints.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.totalItems} items
              {b.stageId ? ` · stage ${b.stageId}` : ""}
            </option>
          ))}
        </select>

        {/*
         * The feasibility check, before anything is created. A blueprint that
         * cannot be filled fails at Start otherwise -- in front of the class.
         */}
        {feas.loading ? (
          <p className="mb-4 text-xs text-ink-muted">Checking the bank…</p>
        ) : f ? (
          <div
            className={
              "mb-4 rounded-md border px-3 py-2.5 text-sm " +
              (f.satisfiable
                ? "border-success bg-success-bg text-success"
                : "border-danger bg-danger-bg text-danger")
            }
          >
            {f.satisfiable ? (
              <p className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                The bank can fill this. <span className="num">{f.poolSize}</span> live items
                available for <span className="num">{f.totalItems}</span> needed.
              </p>
            ) : (
              <>
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  This blueprint cannot be filled yet.
                </p>
                {!f.enoughItems && (
                  <p className="text-xs">
                    Only <span className="num">{f.poolSize}</span> live items exist and{" "}
                    <span className="num">{f.totalItems}</span> are needed.
                  </p>
                )}
                {f.shortfalls.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {f.shortfalls.map((s) => (
                      <li key={`${s.dimension}-${s.cell}`}>
                        <span className="num">{s.dimension}</span> · {s.cell}: needs{" "}
                        <span className="num">{s.need}</span>, bank has{" "}
                        <span className="num">{s.have}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-xs">
                  You can still create it — but it will fail when a student presses Start, which
                  is a worse place to find out.
                </p>
              </>
            )}
          </div>
        ) : null}

        <Label htmlFor="t">Title, as the student sees it</Label>
        <Input id="t" className="mb-4" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="n">Attempts allowed</Label>
            <Input
              id="n"
              type="number"
              min={1}
              max={10}
              value={attempts}
              onChange={(e) => setAttempts(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="o">Opens (optional)</Label>
            <Input id="o" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c">Closes (optional)</Label>
            <Input id="c" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </div>

        {err ? (
          <p className="mb-2 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !title.trim() || !blueprintId} onClick={() => void create()}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { api, type Blueprint, type Feasibility, type Section } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { fromLocalInput, windowSentence } from "@/lib/assessments-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { BankBox } from "./Bank";

/**
 * New assessment: the template's form beside what it produces
 * (`design/templates/console/assessments/SPEC.md`).
 *
 * Left, the fields. Right, what a student will be offered and WHETHER THE LIVE
 * BANK CAN FILL IT, asked again every time the blueprint changes. A blueprint
 * that cannot be filled can still be created (items get approved later), but
 * the teacher reads the verdict before the Create button: at 380 the footer
 * comes after the preview, not before it.
 *
 * Creating one mints the exam salt, server side. This dialog says so and can
 * never show it.
 */
export function CreateDialog({
  open, blueprints, sections, onClose, onCreated, returnFocus,
}: {
  open: boolean;
  blueprints: Blueprint[];
  sections: Section[];
  onClose: () => void;
  onCreated: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const first = blueprints[0];
  const [blueprintId, setBlueprintId] = useState(first?.id ?? "");
  const [title, setTitle] = useState(first?.name ?? "");
  const [sectionId, setSectionId] = useState("");
  const [attempts, setAttempts] = useState("5");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form every time it opens.
  useEffect(() => {
    if (!open) return;
    setBlueprintId(first?.id ?? "");
    setTitle(first?.name ?? "");
    setSectionId("");
    setAttempts("5");
    setOpensAt("");
    setClosesAt("");
    setSaving(false);
    setError(null);
  }, [open, first]);

  const feas = useAsync<Feasibility | null>(
    () => (open && blueprintId ? api.blueprintFeasibility(blueprintId) : Promise.resolve(null)),
    [open, blueprintId],
  );

  const blueprint = blueprints.find((b) => b.id === blueprintId) ?? null;
  const section = sections.find((s) => s.id === sectionId) ?? null;
  const n = Number(attempts);
  const attemptsOk = Number.isInteger(n) && n >= 1 && n <= 10;
  const opensIso = fromLocalInput(opensAt);
  const closesIso = fromLocalInput(closesAt);
  const backwards = opensIso !== null && closesIso !== null && closesIso <= opensIso;
  const ready = Boolean(blueprintId) && title.trim().length >= 3 && attemptsOk && !saving;

  function pick(id: string) {
    const prev = blueprint;
    const next = blueprints.find((b) => b.id === id);
    setBlueprintId(id);
    // The title follows the blueprint until the teacher has written their own.
    if (next && (!title.trim() || title === prev?.name)) setTitle(next.name);
  }

  async function create() {
    setSaving(true);
    setError(null);
    const name = title.trim();
    try {
      await api.createAssessment({
        blueprintId,
        title: name,
        attemptsAllowed: n,
        sectionId: sectionId || null,
        opensAt: opensIso,
        closesAt: closesIso,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "That was not created.";
      setError(message);
      toast.error(`${name} was not created`, "The form is still open with everything you entered.");
      setSaving(false);
      return;
    }
    const f = feas.data;
    toast.success(
      `${name} created`,
      f && !f.satisfiable
        ? `The bank cannot fill it yet: ${f.poolSize} of ${f.totalItems} questions are live. Approve items before students press Start.`
        : "Students can start it as soon as its window opens.",
    );
    setSaving(false);
    onClose();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      {/* Shorter than the shared 85vh: a toast raised while it is open lands
          bottom-right and must not cover Create (design.md). */}
      <DialogContent
        className="ease-dialog assess-create max-h-[calc(100vh-12rem)] max-w-[60rem] max-sm:top-3 max-sm:translate-y-0"
        onCloseAutoFocus={(e) => {
          const el = returnFocus();
          if (el && el.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>New assessment</DialogTitle>
          <DialogDescription>
            Every student gets their own paper from the blueprint: the same shape and difficulty,
            different numbers.
          </DialogDescription>
        </DialogHeader>

        <div className="assess-split">
          {/* ---- the form ---- */}
          <div className="assess-half">
            <h3 className="assess-half-title">Assessment details</h3>

            <div className="assess-field">
              <Label htmlFor="as-blueprint">Blueprint</Label>
              <select id="as-blueprint" className="assess-select" value={blueprintId} onChange={(e) => pick(e.target.value)}>
                {blueprints.map((b) => (
                  // Names only: an <option> cannot set its numbers in mono, and the
                  // preview beside it shows the count where it can.
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="assess-field">
              <Label htmlFor="as-title">Title, as the student sees it</Label>
              <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="assess-field">
              <Label htmlFor="as-section">Who can see it</Label>
              <select id="as-section" className="assess-select" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">Every section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="assess-field">
              <Label htmlFor="as-attempts">Attempts allowed</Label>
              <Input
                id="as-attempts"
                className="num w-24"
                type="number"
                min={1}
                max={10}
                value={attempts}
                onChange={(e) => setAttempts(e.target.value)}
                aria-describedby="as-attempts-hint"
              />
              <p id="as-attempts-hint" className="assess-hint">
                From <span className="num">1</span> to <span className="num">10</span>. Each attempt is a
                different paper.
              </p>
            </div>

            <div className="assess-dates">
              <div className="assess-field">
                <Label htmlFor="as-opens">Opens</Label>
                <Input id="as-opens" className="num" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
              </div>
              <div className="assess-field">
                <Label htmlFor="as-closes">Closes</Label>
                <Input id="as-closes" className="num" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              </div>
            </div>
            {backwards ? (
              <p className="assess-hint text-ink">It closes before it opens; the server will refuse that.</p>
            ) : !opensAt && !closesAt ? (
              <p className="assess-hint">Leave both empty and it is open now, and stays open.</p>
            ) : null}
          </div>

          {/* ---- the preview ---- */}
          <div className="assess-half">
            <h3 className="assess-half-title">Before you create</h3>

            <div className="assess-preview" data-preview="" aria-label="What a student is offered">
              <p className="assess-preview-kicker">What a student is offered</p>
              <div className="assess-preview-head">
                <span className="assess-title">{title.trim() || "Untitled"}</span>
                {blueprint ? (
                  <Badge tone="neutral">
                    {blueprint.scope === "stage" ? (
                      <>
                        stage&nbsp;<span className="num">{blueprint.stageId}</span>
                      </>
                    ) : (
                      "final"
                    )}
                  </Badge>
                ) : null}
              </div>
              <ul className="assess-preview-lines">
                <li>
                  <span className="num">{blueprint?.totalItems ?? 0}</span> questions, drawn for each student from
                  their own seed
                </li>
                <li>
                  <span className="num">{attemptsOk ? n : "?"}</span> {n === 1 ? "attempt" : "attempts"}, a
                  different paper each time
                </li>
                <li>{windowSentence(opensIso, closesIso)}</li>
                <li>{section ? `Only ${section.code} can see it.` : "Every section can see it."}</li>
              </ul>
            </div>

            <BankBox bank={feas.data} loading={feas.loading} error={feas.error} />

            <p className="assess-note">
              Creating it mints this assessment&apos;s exam salt. The salt stays on the server: this
              page can say when it was set, never what it is.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not created. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={!ready}>
            {saving ? "Creating…" : "Create assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

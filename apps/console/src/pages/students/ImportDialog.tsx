import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { api, type RosterImportPlan, type RosterSection } from "@/lib/api";
import { parseRoster } from "@/lib/csv";
import { importToast, needsLook, planOutcome, plural } from "@/lib/roster-view";

/**
 * Import a roster. TWO STEPS, and nothing is written in the first.
 *
 * 1. Paste, pick the section.
 * 2. The plan: every line with its outcome in words (new, unchanged, will
 *    change with the old value beside the new, not imported and why), from the
 *    SERVER's dry run, which is the same computation the apply runs.
 *    `template-preview.png` supplied the shape: every row before commit, a
 *    filter to the rows that need a look, one commit button.
 *
 * A registered row is never overwritten. It is shown as "not imported" with
 * the way to do what the teacher probably meant (Move to section).
 */

const NEW_SECTION = "__new__";
const OUTCOME_TONE = {
  insert: "success", unchanged: "neutral", update: "info", conflict: "warning",
} as const;

export function ImportDialog({
  open, sections, onClose, onDone, returnFocus,
}: {
  open: boolean;
  sections: RosterSection[];
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [choice, setChoice] = useState<string>("");
  const [newCode, setNewCode] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [csv, setCsv] = useState("");
  const [plan, setPlan] = useState<RosterImportPlan | null>(null);
  const [onlyLook, setOnlyLook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The section defaults to the one real section when there is only one.
  useEffect(() => {
    if (!open) return;
    setChoice((c) => c || sections[0]?.code || NEW_SECTION);
    setError(null);
  }, [open, sections]);

  const isNew = choice === NEW_SECTION;
  const sectionCode = isNew ? newCode.trim() : choice;
  const term = isNew ? newTerm.trim() : sections.find((s) => s.code === choice)?.term ?? "";
  const codes = useMemo(() => sections.map((s) => s.code), [sections]);
  const parsed = useMemo(() => parseRoster(csv, codes), [csv, codes]);
  const canPreview = parsed.rows.length > 0 && sectionCode.length > 0 && term.length > 0 && !busy;

  function reset() {
    setCsv("");
    setPlan(null);
    setOnlyLook(false);
    setError(null);
  }

  async function run(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.importRoster({ sectionCode, term, rows: parsed.rows, apply });
      if (!apply) {
        setPlan(res);
        setOnlyLook(false);
      } else {
        toast.success(importToast(res.summary, sectionCode));
        reset();
        onClose();
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
      if (apply) toast.error("The roster was not imported", "Nothing was written. The plan is still open; try again.");
    } finally {
      setBusy(false);
    }
  }

  const rows = plan?.plan ?? [];
  const shown = onlyLook ? rows.filter(needsLook) : rows;
  const writes = plan ? plan.summary.insert + plan.summary.update : 0;
  const look = rows.filter(needsLook).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        className="ease-dialog max-w-2xl max-sm:top-3 max-sm:translate-y-0"
        onCloseAutoFocus={(e) => {
          const el = returnFocus();
          if (el && el.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Import roster</DialogTitle>
          <DialogDescription>
            {plan
              ? "Step 2 of 2: the plan. Nothing has been written yet."
              : "Step 1 of 2: paste the class list. Nothing is written until you have read the plan."}
          </DialogDescription>
        </DialogHeader>

        {!plan ? (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="import-section">Section</Label>
                <select
                  id="import-section"
                  className="roster-select w-full"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code}
                    </option>
                  ))}
                  <option value={NEW_SECTION}>A new section…</option>
                </select>
              </div>
              <p className="self-end text-xs text-ink-muted">
                For every line that does not name its own section.
                {!isNew && term ? <> Term: {term}.</> : null}
              </p>
              {isNew ? (
                <>
                  <div>
                    <Label htmlFor="import-new-code">New section code</Label>
                    <Input id="import-new-code" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="BSCPE - 4B" />
                  </div>
                  <div>
                    <Label htmlFor="import-new-term">Term</Label>
                    <Input id="import-new-term" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="2026-2027 First Semester" />
                  </div>
                </>
              ) : null}
            </div>

            <Label htmlFor="import-csv">Roster</Label>
            <Textarea
              id="import-csv"
              rows={8}
              className="num text-xs"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"232129001,Dela Cruz, Juan Miguel\n232129002  Santos, Maria Clara"}
              aria-describedby="import-csv-help"
            />
            <p id="import-csv-help" className="mt-1.5 text-xs text-ink-muted">
              One student per line: the ID, then the full name, by comma or by spaces.
              &ldquo;Dela Cruz, Juan Miguel&rdquo; is read as one name. A third column,{" "}
              <span className="num">section_code</span>, is used when it names a section that exists.
            </p>
            <p className="mt-1 text-xs text-ink" role="status">
              <span className="num">{parsed.rows.length}</span> {parsed.rows.length === 1 ? "line" : "lines"} read
              {parsed.bad > 0 ? (
                <>
                  {" "}· <span className="num">{parsed.bad}</span> could not be read (no ID or no name)
                </>
              ) : null}
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink" data-plan-summary="">
                <span className="num">{plan.summary.insert}</span> new ·{" "}
                <span className="num">{plan.summary.update}</span> will change ·{" "}
                <span className="num">{plan.summary.unchanged}</span> unchanged ·{" "}
                <span className="num">{plan.summary.conflict}</span> not imported
              </p>
              <Button
                size="sm"
                variant="outline"
                aria-pressed={onlyLook}
                onClick={() => setOnlyLook((v) => !v)}
                disabled={look === 0}
              >
                <span>Only rows that need a look</span>
                <span className="num">({look})</span>
              </Button>
            </div>
            <ul className="roster-plan" aria-label="The plan, line by line">
              {shown.map((p, i) => {
                const o = planOutcome(p);
                return (
                  <li key={`${p.studentId}-${i}`} data-plan-row={p.studentId} data-action={p.action}>
                    <span className="num text-xs text-ink-muted">{p.studentId}</span>
                    <span className="min-w-0 text-sm text-ink">
                      {p.fullName}
                      <span className="text-ink-muted"> · {p.sectionCode}</span>
                    </span>
                    <Badge tone={OUTCOME_TONE[p.action]}>{o.label}</Badge>
                    {o.detail ? <span className="roster-plan-detail text-xs text-ink-muted">{o.detail}</span> : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {error ? (
          <p className="gate-fault mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {plan ? (
            <>
              <Button variant="ghost" onClick={() => setPlan(null)} disabled={busy}>
                Back
              </Button>
              <Button onClick={() => void run(true)} disabled={busy || writes === 0}>
                {busy ? "Importing…" : writes === 0 ? "Nothing to import" : `Import ${plural(writes, "row")}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void run(false)} disabled={!canPreview}>
                {busy ? "Checking…" : "Preview"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

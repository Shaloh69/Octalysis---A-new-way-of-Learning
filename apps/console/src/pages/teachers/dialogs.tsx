import { useEffect, useMemo, useState } from "react";
import type { Subject, TeacherRow } from "@octa/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { assignClass, importTeachers, setTeacherStatus, updateClass, type TeacherImportResult } from "@/lib/api";
import {
  confirmWord, importToast, needsLook, parseTeacherRoster, planOutcome, plural,
} from "@/lib/teachers-view";

/** Focus back to what opened the dialog (NEXT-SESSION §0c.4), as /students does. */
function backTo(returnFocus: () => HTMLElement | null) {
  return (e: Event) => {
    const el = returnFocus();
    if (el && el.isConnected) {
      e.preventDefault();
      el.focus();
    }
  };
}

function Fault({ text }: { text: string | null }) {
  return text ? (
    <p className="gate-fault mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
      {text}
    </p>
  ) : null;
}

const OUTCOME_TONE = { insert: "success", unchanged: "neutral", update: "info", conflict: "warning" } as const;

/** Import the teacher roster: paste, read the plan, then apply. Nothing is written in step 1. */
export function TeacherImportDialog({
  open, onClose, onDone, returnFocus,
}: { open: boolean; onClose: () => void; onDone: () => void; returnFocus: () => HTMLElement | null }) {
  const [csv, setCsv] = useState("");
  const [plan, setPlan] = useState<TeacherImportResult | null>(null);
  const [onlyLook, setOnlyLook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parseTeacherRoster(csv), [csv]);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function run(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await importTeachers({ rows: parsed.rows, apply });
      if (!apply) {
        setPlan(res);
        setOnlyLook(false);
      } else {
        toast.success(importToast(res.summary));
        setCsv("");
        setPlan(null);
        onClose();
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
      if (apply) toast.error("The teacher roster was not imported", "Nothing was written. The plan is still open; try again.");
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
      <DialogContent className="ease-dialog max-w-2xl max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={backTo(returnFocus)}>
        <DialogHeader>
          <DialogTitle>Import the teacher roster</DialogTitle>
          <DialogDescription>
            {plan
              ? "Step 2 of 2: the plan. Nothing has been written yet."
              : "Step 1 of 2: paste the list. Nothing is written until you have read the plan."}
          </DialogDescription>
        </DialogHeader>

        {!plan ? (
          <>
            <Label htmlFor="teacher-csv">Teachers</Label>
            <Textarea
              id="teacher-csv"
              rows={8}
              className="num text-xs"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"EMP-0101, Santos, Maria Clara, maria.santos@uc.edu.ph\nEMP-0102, Juan Dela Cruz, juan@uc.edu.ph, admin"}
              aria-describedby="teacher-csv-help"
            />
            <p id="teacher-csv-help" className="mt-1.5 text-xs text-ink-muted">
              One teacher per line: the employee ID, then the full name, and optionally an email and the
              word <span className="num">admin</span>. By commas or tabs. A teacher claims the account
              themselves at the console&apos;s Claim page; nothing is sent.
            </p>
            <p className="mt-1 text-xs text-ink" role="status">
              <span className="num">{parsed.rows.length}</span> {parsed.rows.length === 1 ? "line" : "lines"} read
              {parsed.bad > 0 ? <> · <span className="num">{parsed.bad}</span> could not be read (no employee ID or no name)</> : null}
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink" data-plan-summary="">
                <span className="num">{plan.summary.insert}</span> new · <span className="num">{plan.summary.update}</span> will change ·{" "}
                <span className="num">{plan.summary.unchanged}</span> unchanged · <span className="num">{plan.summary.conflict}</span> not imported
              </p>
              <Button size="sm" variant="outline" aria-pressed={onlyLook} onClick={() => setOnlyLook((v) => !v)} disabled={look === 0}>
                <span>Only rows that need a look</span>
                <span className="num">({look})</span>
              </Button>
            </div>
            <ul className="roster-plan" aria-label="The plan, line by line">
              {shown.map((p, i) => {
                const o = planOutcome(p);
                return (
                  <li key={`${p.employeeId}-${i}`} data-plan-row={p.employeeId} data-action={p.action}>
                    <span className="num text-xs text-ink-muted">{p.employeeId}</span>
                    <span className="min-w-0 text-sm text-ink">
                      {p.fullName}
                      <span className="text-ink-muted"> · {p.role === "admin" ? "Admin" : "Teacher"}</span>
                    </span>
                    <Badge tone={OUTCOME_TONE[p.action]}>{o.label}</Badge>
                    {o.detail ? <span className="roster-plan-detail text-xs text-ink-muted">{o.detail}</span> : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Fault text={error} />

        <DialogFooter>
          {plan ? (
            <>
              <Button variant="ghost" onClick={() => setPlan(null)} disabled={busy}>Back</Button>
              <Button onClick={() => void run(true)} disabled={busy || writes === 0}>
                {busy ? "Importing…" : writes === 0 ? "Nothing to import" : `Import ${plural(writes, "row")}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={() => void run(false)} disabled={parsed.rows.length === 0 || busy}>
                {busy ? "Checking…" : "Preview"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Disable or re-enable one teacher: a reason, and the employee ID typed back to disable. */
export function TeacherStatusDialog({
  teacher, onClose, onDone, returnFocus,
}: { teacher: TeacherRow | null; onClose: () => void; onDone: () => void; returnFocus: () => HTMLElement | null }) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teacher) return;
    setReason("");
    setTyped("");
    setError(null);
    setSaving(false);
  }, [teacher]);

  const disabling = teacher ? teacher.status !== "disabled" : true;
  const word = teacher ? confirmWord(teacher) : "";
  const claimed = teacher?.userId !== null && teacher?.userId !== undefined;
  const name = teacher?.fullName ?? "";
  const ready = reason.trim().length >= 3 && (!disabling || typed.trim() === word);

  async function commit() {
    if (!teacher) return;
    setSaving(true);
    setError(null);
    try {
      await setTeacherStatus(teacher.key, { active: !disabling, reason: reason.trim(), confirm: disabling ? typed.trim() : word });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change was not saved.");
      toast.error(`${name} was not ${disabling ? "disabled" : "re-enabled"}`, "The dialog is still open with your reason in it. Try again.");
      setSaving(false);
      return;
    }
    toast.success(`${name} ${disabling ? "disabled" : "re-enabled"}`);
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={teacher !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={backTo(returnFocus)}>
        <DialogHeader>
          <DialogTitle>{disabling ? `Disable ${name}?` : `Re-enable ${name}?`}</DialogTitle>
          <DialogDescription>
            <span className="num">{teacher?.employeeId ?? "no employee ID"}</span> · {claimed ? "account claimed" : "not claimed yet"}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            {disabling && claimed ? (
              <>
                <li>They are refused on every request from now on, and their sign-in is blocked.</li>
                <li>Their classes, and everything recorded under their name, are kept.</li>
              </>
            ) : disabling ? (
              <li>Their employee ID can no longer be used to claim an account.</li>
            ) : claimed ? (
              <li>They can sign in again, with their classes as they were.</li>
            ) : (
              <li>Their employee ID can be claimed again.</li>
            )}
            {disabling ? <li>You can re-enable them from this page. That needs a reason too.</li> : null}
          </ul>
        </div>

        <Label htmlFor="teacher-status-reason">Reason (required)</Label>
        <Textarea
          id="teacher-status-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={disabling ? "e.g. Left the department on 30 September" : "e.g. Returned from leave"}
        />
        <p className="mt-1.5 text-xs text-ink-muted">Recorded in the audit log with your name and the time.</p>

        {disabling ? (
          <div className="mt-4">
            <Label htmlFor="teacher-status-confirm">Type {teacher?.employeeId ? "the employee ID" : "their full name"} to confirm</Label>
            <Input
              id="teacher-status-confirm"
              className="num"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-describedby="teacher-status-confirm-hint"
            />
            <p id="teacher-status-confirm-hint" className="mt-1.5 text-xs text-ink-muted">
              Type <span className="num text-ink">{word}</span> exactly.
            </p>
          </div>
        ) : null}

        <Fault text={error ? `Not saved. ${error}` : null} />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant={disabling ? "danger" : "default"} onClick={() => void commit()} disabled={!ready || saving}>
            {saving ? "Saving…" : `${disabling ? "Disable" : "Re-enable"} ${name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface AssignPreset {
  teacher: TeacherRow | null;
  sectionId?: string;
  subjectCode?: string;
  term?: string;
}

/**
 * Assign a class: a section, a subject, a term, a teacher, and one of the
 * subject's books (or its default). The same section, subject and term again
 * re-assigns that class rather than making a second one (the API's rule).
 */
export function AssignClassDialog({
  preset, teachers, sections, subjects, onClose, onDone, returnFocus,
}: {
  preset: AssignPreset | null;
  teachers: TeacherRow[];
  sections: { id: string; code: string; term: string }[];
  subjects: Subject[];
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [sectionId, setSectionId] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [term, setTerm] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [bookId, setBookId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const holders = teachers.filter((t) => t.userId && t.status === "active");

  useEffect(() => {
    if (!preset) return;
    const section = sections.find((s) => s.id === preset.sectionId) ?? sections[0];
    setSectionId(section?.id ?? "");
    setSubjectCode(preset.subjectCode ?? subjects[0]?.code ?? "");
    setTerm(preset.term ?? section?.term ?? "");
    setTeacherId(preset.teacher?.userId ?? holders[0]?.userId ?? "");
    setBookId("");
    setReason("");
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opening a preset is the trigger
  }, [preset]);

  const books = subjects.find((s) => s.code === subjectCode)?.books ?? [];
  const section = sections.find((s) => s.id === sectionId);
  const teacher = holders.find((t) => t.userId === teacherId);
  const ready = sectionId !== "" && subjectCode !== "" && term.trim() !== "" && teacherId !== "" && reason.trim().length >= 3;

  async function commit() {
    setSaving(true);
    setError(null);
    try {
      await assignClass({ sectionId, subjectCode, term: term.trim(), teacherId, bookId: bookId || null, reason: reason.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The class was not assigned.");
      toast.error("The class was not assigned", "The dialog is still open. Try again.");
      setSaving(false);
      return;
    }
    toast.success(`${section?.code ?? "The section"} · ${subjectCode} assigned to ${teacher?.fullName ?? "the teacher"}`);
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={preset !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="ease-dialog max-w-lg max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={backTo(returnFocus)}>
        <DialogHeader>
          <DialogTitle>Assign a class</DialogTitle>
          <DialogDescription>One section taking one subject in a term, held by one teacher.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="class-section">Section</Label>
            <select id="class-section" className="roster-select w-full" value={sectionId} onChange={(e) => {
              setSectionId(e.target.value);
              const s = sections.find((x) => x.id === e.target.value);
              if (s) setTerm(s.term);
            }}>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="class-subject">Subject</Label>
            <select id="class-subject" className="roster-select w-full" value={subjectCode} aria-describedby="class-subject-title" onChange={(e) => { setSubjectCode(e.target.value); setBookId(""); }}>
              {subjects.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
            </select>
            <p id="class-subject-title" className="mt-1 text-xs text-ink-muted">{subjects.find((s) => s.code === subjectCode)?.title}</p>
          </div>
          <div>
            <Label htmlFor="class-term">Term</Label>
            <Input id="class-term" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="class-teacher">Teacher</Label>
            <select id="class-teacher" className="roster-select w-full" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              {holders.map((t) => <option key={t.key} value={t.userId ?? ""}>{t.fullName}{t.role === "admin" ? " (admin)" : ""}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="class-book">Book</Label>
            <select id="class-book" className="roster-select w-full" value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">The subject&apos;s default{books.find((b) => b.isDefault) ? ` (${books.find((b) => b.isDefault)!.edition ?? ""} ed.)` : ""}</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}{b.edition ? `, ${b.edition} ed.` : ""}{b.isDefault ? " (default)" : ""}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="class-reason">Reason (required)</Label>
          <Textarea id="class-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. First semester load" />
          <p className="mt-1.5 text-xs text-ink-muted">
            If this section already takes this subject this term, its class is re-assigned, not doubled.
          </p>
        </div>

        <Fault text={error} />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void commit()} disabled={!ready || saving}>{saving ? "Assigning…" : "Assign class"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ClassChange {
  kind: "book" | "end" | "reopen";
  cls: { id: string; sectionCode: string; subjectCode: string; term: string; bookId: string | null };
}

/** Change a class's book, end it, or re-open it: each with a reason, each audited. */
export function ClassChangeDialog({
  change, subjects, onClose, onDone, returnFocus,
}: {
  change: ClassChange | null;
  subjects: Subject[];
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [bookId, setBookId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!change) return;
    setBookId(change.cls.bookId ?? "");
    setReason("");
    setError(null);
    setSaving(false);
  }, [change]);

  const books = subjects.find((s) => s.code === change?.cls.subjectCode)?.books ?? [];
  const label = change ? `${change.cls.sectionCode} · ${change.cls.subjectCode}, ${change.cls.term}` : "";
  const title = change?.kind === "book" ? `Change the book for ${label}` : change?.kind === "end" ? `End ${label}?` : `Re-open ${label}?`;
  const changed = change?.kind !== "book" || bookId !== (change?.cls.bookId ?? "");
  const ready = reason.trim().length >= 3 && changed;

  async function commit() {
    if (!change) return;
    setSaving(true);
    setError(null);
    try {
      await updateClass(change.cls.id, {
        reason: reason.trim(),
        ...(change.kind === "book" ? { bookId: bookId || null } : { ended: change.kind === "end" }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change was not saved.");
      toast.error(`${label} was not changed`, "The dialog is still open with your reason in it. Try again.");
      setSaving(false);
      return;
    }
    toast.success(change.kind === "book" ? `${label}: book changed` : change.kind === "end" ? `${label} ended` : `${label} re-opened`);
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={change !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={backTo(returnFocus)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {change?.kind === "end"
              ? "The class is kept, with the date it ended; the teacher no longer holds it."
              : change?.kind === "reopen"
                ? "The teacher holds the class again."
                : "Any of the subject's books, or its default."}
          </DialogDescription>
        </DialogHeader>

        {change?.kind === "book" ? (
          <div className="mb-3">
            <Label htmlFor="change-book">Book</Label>
            <select id="change-book" className="roster-select w-full" value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">The subject&apos;s default</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}{b.edition ? `, ${b.edition} ed.` : ""}{b.isDefault ? " (default)" : ""}</option>
              ))}
            </select>
          </div>
        ) : null}

        <Label htmlFor="change-reason">Reason (required)</Label>
        <Textarea id="change-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <p className="mt-1.5 text-xs text-ink-muted">Recorded in the audit log with your name and the time.</p>

        <Fault text={error ? `Not saved. ${error}` : null} />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant={change?.kind === "end" ? "danger" : "default"} onClick={() => void commit()} disabled={!ready || saving}>
            {saving ? "Saving…" : change?.kind === "book" ? "Change book" : change?.kind === "end" ? "End class" : "Re-open class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SubjectBook, StudioSubject } from "@octa/contracts";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Course Studio's writes on subjects and books (SPEC.md, "Controls"): add a
 * subject, rename it, add or edit a book, make a book the default. Every one
 * needs a reason (the audit log's), keeps what was typed when the API
 * refuses, and says so with an error toast that stays. Nothing is deleted.
 */

const COURSE_CODE = /^[A-Z]{2,6} [0-9]{2,4}[A-Z]?$/;

function useForm<T extends Record<string, string>>(open: boolean, initial: T) {
  const [v, setV] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setV(initial);
    setSaving(false);
    setError(null);
    // The form is re-seeded each time its dialog opens, never while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { v, set: (p: Partial<T>) => setV((x) => ({ ...x, ...p })), saving, setSaving, error, setError };
}

function Failure({ error }: { error: string | null }) {
  return error ? (
    <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
      Not saved. {error}
    </p>
  ) : null;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="st-field">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="ct-faint">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- subject */

export function SubjectDialog({
  open, subject, onClose, onSaved,
}: {
  open: boolean;
  /** Present: rename it. Absent: add a subject. */
  subject: StudioSubject | null;
  onClose: () => void;
  onSaved: (code: string, created: boolean) => void;
}) {
  const adding = subject === null;
  const f = useForm(open, { code: "", title: subject?.title ?? "", reason: "" });
  const code = adding ? f.v.code.trim().toUpperCase() : subject.code;
  const codeOk = !adding || COURSE_CODE.test(code);
  const changed = adding || f.v.title.trim() !== subject.title;
  const ready = codeOk && f.v.title.trim().length > 0 && changed && f.v.reason.trim().length >= 3 && !f.saving;

  async function save() {
    f.setSaving(true);
    f.setError(null);
    try {
      if (adding) await api.createSubject({ code, title: f.v.title.trim(), reason: f.v.reason.trim() });
      else await api.renameSubject(subject.code, { title: f.v.title.trim(), reason: f.v.reason.trim() });
    } catch (e) {
      const m = e instanceof Error ? e.message : "It was not saved.";
      f.setError(m);
      toast.error(adding ? `${code} was not added` : `${subject.code} was not renamed`, "The dialog is still open with what you typed.");
      f.setSaving(false);
      return;
    }
    toast.success(adding ? `${code} added` : `${code} renamed`, adding ? "Give it a book next." : "The new title shows everywhere the subject does.");
    f.setSaving(false);
    onClose();
    onSaved(code, adding);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !f.saving && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0">
        <DialogHeader>
          <DialogTitle>{adding ? "Add a subject" : `Rename ${subject.code}`}</DialogTitle>
          <DialogDescription>
            {adding
              ? "A course, like CPE 413. It has no chapters until its own star system is built (CS2); books and classes can be added now."
              : `Its code, ${subject.code}, is what classes refer to and never changes.`}
          </DialogDescription>
        </DialogHeader>
        {adding ? (
          <Field id="subject-code" label="Course code" hint="Letters, a space, then the number: CPE 413.">
            <Input id="subject-code" className="num" value={f.v.code} autoComplete="off" onChange={(e) => f.set({ code: e.target.value })} />
          </Field>
        ) : null}
        <Field id="subject-title" label="Title">
          <Input id="subject-title" value={f.v.title} autoComplete="off" onChange={(e) => f.set({ title: e.target.value })} />
        </Field>
        {!adding ? <p className="ct-faint">Now: <span>{subject.title}</span></p> : null}
        <Field id="subject-reason" label="Reason (required)">
          <Textarea id="subject-reason" rows={2} value={f.v.reason} onChange={(e) => f.set({ reason: e.target.value })}
                    placeholder={adding ? "e.g. Second-term course" : "e.g. The syllabus's own title"} />
        </Field>
        <Failure error={f.error} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={f.saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={!ready}>
            {f.saving ? "Saving…" : adding ? "Add subject" : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------- book */

export function BookDialog({
  open, subject, book, onClose, onSaved,
}: {
  open: boolean;
  subject: StudioSubject;
  /** Present: edit it. Absent: add a book. */
  book: SubjectBook | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const adding = book === null;
  const f = useForm(open, {
    title: book?.title ?? "", author: book?.author ?? "", edition: book?.edition ?? "", reason: "", makeDefault: "",
  });
  const t = f.v.title.trim();
  const same = !adding && t === book.title && f.v.author.trim() === (book.author ?? "") && f.v.edition.trim() === (book.edition ?? "");
  const ready = t.length > 0 && !same && f.v.reason.trim().length >= 3 && !f.saving;

  async function save() {
    f.setSaving(true);
    f.setError(null);
    const author = f.v.author.trim() || null;
    const edition = f.v.edition.trim() || null;
    try {
      if (adding) {
        await api.createBook(subject.code, {
          title: t, author, edition, isDefault: f.v.makeDefault === "yes", reason: f.v.reason.trim(),
        });
      } else {
        await api.updateBook(book.id, { title: t, author, edition, reason: f.v.reason.trim() });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "It was not saved.";
      f.setError(m);
      toast.error(`The book was not ${adding ? "added" : "saved"}`, "The dialog is still open with what you typed.");
      f.setSaving(false);
      return;
    }
    toast.success(adding ? `${t} added to ${subject.code}` : `${t} saved`, adding ? "Classes can read it now." : undefined);
    f.setSaving(false);
    onClose();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !f.saving && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0">
        <DialogHeader>
          <DialogTitle>{adding ? `Add a book to ${subject.code}` : `Edit ${book.title}`}</DialogTitle>
          <DialogDescription>
            A subject may have two or more books; a class reads the subject&apos;s default unless it chooses another.
          </DialogDescription>
        </DialogHeader>
        <Field id="book-title" label="Title">
          <Input id="book-title" value={f.v.title} autoComplete="off" onChange={(e) => f.set({ title: e.target.value })} />
        </Field>
        <Field id="book-author" label="Author (optional)">
          <Input id="book-author" value={f.v.author} autoComplete="off" onChange={(e) => f.set({ author: e.target.value })} />
        </Field>
        <Field id="book-edition" label="Edition (optional)" hint="As printed: 9th, 2nd.">
          <Input id="book-edition" className="num" value={f.v.edition} autoComplete="off" onChange={(e) => f.set({ edition: e.target.value })} />
        </Field>
        {adding && subject.books.length > 0 ? (
          <label className="st-check">
            <input type="checkbox" checked={f.v.makeDefault === "yes"} onChange={(e) => f.set({ makeDefault: e.target.checked ? "yes" : "" })} />
            <span>Make it the default book</span>
          </label>
        ) : null}
        {adding && subject.books.length === 0 ? <p className="ct-faint">It is the subject&apos;s first book, so it is the default.</p> : null}
        <Field id="book-reason" label="Reason (required)">
          <Textarea id="book-reason" rows={2} value={f.v.reason} onChange={(e) => f.set({ reason: e.target.value })}
                    placeholder={adding ? "e.g. The syllabus's book" : "e.g. A newer edition"} />
        </Field>
        <Failure error={f.error} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={f.saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={!ready}>{f.saving ? "Saving…" : adding ? "Add book" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- default */

export function DefaultBookDialog({
  open, subject, book, onClose, onSaved,
}: {
  open: boolean;
  subject: StudioSubject;
  book: SubjectBook | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const f = useForm(open, { reason: "" });
  const was = subject.books.find((b) => b.isDefault);
  const label = (b: SubjectBook) => `${b.title}${b.edition ? `, ${b.edition} ed.` : ""}`;

  async function save() {
    if (!book) return;
    f.setSaving(true);
    f.setError(null);
    try {
      await api.defaultBook(book.id, { reason: f.v.reason.trim() });
    } catch (e) {
      f.setError(e instanceof Error ? e.message : "It was not saved.");
      toast.error("The default book was not changed", "The dialog is still open with your reason in it.");
      f.setSaving(false);
      return;
    }
    toast.success(`${label(book)} is now the default`, `Classes of ${subject.code} with no book of their own read it.`);
    f.setSaving(false);
    onClose();
    onSaved();
  }

  return (
    <Dialog open={open && book !== null} onOpenChange={(o) => !o && !f.saving && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0">
        <DialogHeader>
          <DialogTitle>Make this the default book?</DialogTitle>
          <DialogDescription>{book ? label(book) : ""}</DialogDescription>
        </DialogHeader>
        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Classes of {subject.code} that have not chosen a book of their own now read this one.</li>
            {was ? <li>{label(was)} stops being the default; it stays one of the subject&apos;s books.</li> : null}
            <li>Your reason is kept in the audit log with your name and the time.</li>
          </ul>
        </div>
        <Field id="default-reason" label="Reason (required)">
          <Textarea id="default-reason" rows={2} value={f.v.reason} onChange={(e) => f.set({ reason: e.target.value })}
                    placeholder="e.g. The 10th edition this term" />
        </Field>
        <Failure error={f.error} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={f.saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={f.v.reason.trim().length < 3 || f.saving}>
            {f.saving ? "Saving…" : "Make default"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

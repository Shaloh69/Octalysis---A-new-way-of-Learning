import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SubjectBook } from "@octa/contracts";
import { subjectFromSlug } from "@/lib/studio-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookDialog, DefaultBookDialog, SubjectDialog } from "./dialogs";
import { NotFound } from "./NotFound";
import { useStudio } from "./context";

/**
 * `/studio/:subject`: one subject, its books and its classes
 * (`design/templates/console/studio/SPEC.md`). Every teacher may rename it and
 * add, edit or default its books (ruling 3, 7 Oct 2026, night), each with a
 * reason, audited. Nothing is deleted and a code never changes. The classes
 * are only counted: assigning them is the admin's, on Teachers.
 */
export function SubjectView() {
  const { subject: slug = "" } = useParams();
  const { subjects, subjectsError, reloadSubjects } = useStudio();
  const [renaming, setRenaming] = useState(false);
  const [bookFor, setBookFor] = useState<{ book: SubjectBook | null } | null>(null);
  const [defaulting, setDefaulting] = useState<SubjectBook | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  if (subjectsError && !subjects) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-ink">
          The subjects could not be loaded. <span className="text-ink-muted">{subjectsError}</span>
        </p>
        <Button size="sm" variant="outline" onClick={reloadSubjects}>Try again</Button>
      </div>
    );
  }
  if (!subjects) {
    return <div className="ct-card ct-skel ct-skel-table" data-skeleton aria-busy="true" aria-label="Loading the subject" />;
  }
  const code = subjectFromSlug(slug, subjects.subjects.map((s) => s.code));
  const subject = subjects.subjects.find((s) => s.code === code);
  if (!subject) return <NotFound what={`No subject ${slug}.`} />;

  const label = (b: SubjectBook) => `${b.title}${b.edition ? `, ${b.edition} ed.` : ""}`;
  const remember = (el: HTMLElement) => { opener.current = el; };

  return (
    <div className="ct">
      <header className="ct-head">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>
            <span className="num">{subject.code}</span> · {subject.title}
          </h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            A subject, its books, and the classes that take it.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={(e) => { remember(e.currentTarget); setRenaming(true); }}>
          Rename
        </Button>
      </header>

      <section className="ct-card st-card" aria-labelledby="sv-books" data-books>
        <div className="st-head">
          <h2 id="sv-books" className="ct-h2">Books <span className="num text-ink-muted">{subject.books.length}</span></h2>
          <Button size="sm" onClick={(e) => { remember(e.currentTarget); setBookFor({ book: null }); }}>Add book</Button>
        </div>
        {subject.books.length === 0 ? (
          <p className="ct-group-empty">No books yet. Add the one the syllabus names; it becomes the default.</p>
        ) : (
          <ul className="st-books">
            {subject.books.map((b) => (
              <li key={b.id} data-book={b.id}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {b.title} {b.isDefault ? <Badge tone="success">Default</Badge> : null}
                  </p>
                  <p className="ct-faint">
                    {b.author ?? "No author recorded"}
                    {b.edition ? <> · <span className="num">{b.edition}</span> edition</> : null}
                  </p>
                </div>
                <div className="st-book-actions">
                  <Button size="sm" variant="outline" aria-label={`Edit ${label(b)}`}
                          onClick={(e) => { remember(e.currentTarget); setBookFor({ book: b }); }}>
                    Edit
                  </Button>
                  {!b.isDefault ? (
                    <Button size="sm" variant="outline" aria-label={`Make ${label(b)} the default`}
                            onClick={(e) => { remember(e.currentTarget); setDefaulting(b); }}>
                      Make default
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="ct-faint">
          A class reads the subject&apos;s default unless it chooses another of these. Books are never deleted: classes refer
          to them, so a wrong one is edited.
        </p>
      </section>

      <section className="ct-card st-card" aria-labelledby="sv-classes" data-classes>
        <h2 id="sv-classes" className="ct-h2">Classes</h2>
        <p className="text-sm text-ink">
          <span className="num">{subject.classes.total}</span> {subject.classes.total === 1 ? "class takes" : "classes take"} this
          subject; <span className="num">{subject.classes.assigned}</span> {subject.classes.assigned === 1 ? "has" : "have"} a teacher.
        </p>
        <p className="ct-faint">
          Classes are assigned on <Link className="ct-link" to="/teachers">Teachers</Link>, the admin&apos;s page.
        </p>
      </section>

      {!subject.hasChapters ? (
        <section className="ct-card st-card" aria-labelledby="sv-chapters">
          <h2 id="sv-chapters" className="ct-h2">Chapters</h2>
          <p className="text-sm text-ink">
            No chapters yet. A new subject becomes its own star system, with its own planets, questions, checks and
            grades, in the next phase (CS2). Until then it can have books and classes.
          </p>
        </section>
      ) : null}

      <SubjectDialog open={renaming} subject={subject} onClose={() => setRenaming(false)} onSaved={() => reloadSubjects()} />
      <BookDialog open={bookFor !== null} subject={subject} book={bookFor?.book ?? null}
                  onClose={() => setBookFor(null)} onSaved={reloadSubjects} />
      <DefaultBookDialog open={defaulting !== null} subject={subject} book={defaulting}
                         onClose={() => setDefaulting(null)} onSaved={reloadSubjects} />
    </div>
  );
}

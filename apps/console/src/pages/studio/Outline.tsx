import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { StudioSubject } from "@octa/contracts";
import type { ContentStage } from "@/lib/api";
import { chapterPath, outlineNote, subjectFromSlug, subjectPath, subjectSlug } from "@/lib/studio-view";
import { cn } from "@/lib/utils";

/**
 * The course outline, the Studio's left pane and (below 60rem) its left sheet:
 * Overview, To review, then every subject with its books and chapters.
 * `design/templates/console/studio/SPEC.md`, "The outline". It navigates and
 * decides nothing: what a subject holds is the API's.
 */

export function Outline({
  subjects, stages, reviewing, onAdd, onNavigate,
}: {
  subjects: readonly StudioSubject[] | undefined;
  stages: readonly ContentStage[] | undefined;
  reviewing: number | undefined;
  onAdd: () => void;
  /** A sheet closes when a choice is made in it. */
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const here = subjectFromSlug(pathname.split("/")[2] ?? "", (subjects ?? []).map((s) => s.code));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // The subject you are in is open; so is the only one there is.
  useEffect(() => {
    if (!subjects) return;
    setOpen((o) => {
      const next = { ...o };
      for (const s of subjects) if (next[s.code] === undefined) next[s.code] = s.code === here || subjects.length === 1;
      if (here) next[here] = true;
      return next;
    });
  }, [subjects, here]);

  const link = "st-outline-link";
  return (
    <nav className="st-outline" aria-label="Course outline">
      <ul className="st-outline-top">
        <li>
          <NavLink to="/studio" end className={({ isActive }) => cn(link, isActive && "is-current")} onClick={onNavigate}>
            Overview
          </NavLink>
        </li>
        <li>
          <NavLink to="/studio/review" className={({ isActive }) => cn(link, isActive && "is-current")} onClick={onNavigate}>
            To review
            {reviewing !== undefined && reviewing > 0 ? <span className="num st-count">{reviewing}</span> : null}
          </NavLink>
        </li>
      </ul>

      <div className="st-outline-head">
        <h2 className="st-outline-h2">Subjects</h2>
        <button type="button" className="st-icon-btn" aria-label="Add subject" title="Add subject" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {!subjects ? (
        <div className="st-skel st-skel-outline" data-skeleton aria-busy="true" aria-label="Loading the outline" />
      ) : (
        <ul className="st-subjects">
          {subjects.map((s) => {
            const expanded = open[s.code] ?? false;
            const id = `st-sub-${subjectSlug(s.code)}`;
            return (
              <li key={s.code} data-subject={s.code}>
                <button
                  type="button"
                  className="st-subject-btn"
                  aria-expanded={expanded}
                  aria-controls={id}
                  onClick={() => setOpen((o) => ({ ...o, [s.code]: !expanded }))}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  <span className="st-subject-text">
                    <span className="num st-subject-code">{s.code}</span>
                    <span className="st-subject-title">{s.title}</span>
                  </span>
                </button>
                {expanded ? (
                  <div id={id} className="st-subject-body">
                    <NavLink
                      to={subjectPath(s.code)}
                      end
                      className={({ isActive }) => cn(link, isActive && "is-current")}
                      onClick={onNavigate}
                    >
                      Books <span className="num st-count">{s.books.length}</span>
                    </NavLink>
                    {s.hasChapters ? (
                      stages ? (
                        <ul className="st-chapters" aria-label={`${s.code} chapters`}>
                          {stages.map((c) => {
                            const note = outlineNote(c);
                            return (
                              <li key={c.id}>
                                <NavLink
                                  to={chapterPath(c.id, s.code)}
                                  className={({ isActive }) => cn(link, "st-chapter", isActive && "is-current")}
                                  onClick={onNavigate}
                                >
                                  <span className="num st-chapter-id">{c.id}</span>
                                  <span className="st-chapter-title">{c.title}</span>
                                  {note ? <span className="st-note">{note}</span> : null}
                                </NavLink>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="st-skel st-skel-chapters" data-skeleton aria-busy="true" />
                      )
                    ) : (
                      <p className="ct-faint st-nochap">
                        No chapters yet. A subject&apos;s own star system arrives with CS2.
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="ct-faint st-outline-foot">
        Classes are assigned on <Link className="ct-link" to="/teachers" onClick={onNavigate}>Teachers</Link>, the admin&apos;s page.
      </p>
    </nav>
  );
}

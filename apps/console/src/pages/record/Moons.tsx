import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { RecordMoonStage } from "@/lib/api";
import { moonWords } from "@/lib/record-view";

/**
 * The record's moons (instructor, 30 Sep 2026): each stage's moon mastery for
 * this student, as the map and the lock count it (WEB-REVAMP 3.7a). A stage is
 * a row that expands in place to its moons, one stage open at a time, the
 * page's own TanStack *Expanding* reference (`template-subrows.png`).
 *
 * Every state is a word, never a colour (the page's rule): Mastered, "1 of 3
 * right", Not started, No questions yet. The numbers are the API's.
 */

export function MoonsCard({ moons }: { moons: RecordMoonStage[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="record-card" aria-labelledby="moons-h" data-moons="">
      <div className="record-card-head">
        <h2 id="moons-h" className="font-display text-lg text-ink">
          Moons by stage
        </h2>
        <p className="text-xs text-ink-muted">
          A moon is mastered at two different questions right, in practice or on a stage check. Every moon of a stage
          mastered opens the next stage.
        </p>
      </div>
      {moons.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-muted">No stage has moons published yet.</p>
      ) : (
        <ul className="record-moons">
          {moons.map((s) => {
            const isOpen = open === s.stageId;
            return (
              <li key={s.stageId} data-moon-stage={s.stageId}>
                <button
                  type="button"
                  className="record-moons-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`moons-${s.stageId}`}
                  onClick={() => setOpen(isOpen ? null : s.stageId)}
                >
                  <ChevronDown className="record-moons-chevron" aria-hidden="true" />
                  <span className="num text-xs text-ink-muted">{s.stageId}</span>
                  <span className="record-moons-title">{s.title}</span>
                  <span className="record-moons-count" data-moons-count="">
                    <span className="num">{s.mastered}</span> of <span className="num">{s.total}</span>
                  </span>
                </button>
                {isOpen ? (
                  <ul id={`moons-${s.stageId}`} className="record-moons-sub" aria-label={`Stage ${s.stageId} moons`}>
                    {s.objectives.map((m) => (
                      <li key={m.id} data-moon={m.id}>
                        <span className="num text-xs text-ink-muted">{m.id}</span>
                        <span className="record-moon-text">{m.description}</span>
                        <span className="record-moon-state">{moonWords(m)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

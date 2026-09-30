import { useMemo, useRef, useState } from "react";
import { COLUMN_RULE, COLUMN_WORD, type Card, type Column } from "./two-columns";
import "../styles/encounter.css";

/**
 * A Sort: a moon's classification encounter (GAME-DESIGN.md §10.3, archetype A;
 * template `design/templates/web/encounter-sort/`, Stardew Valley's chest).
 *
 * Two framed columns over the planet's world, and the cards still to sort
 * beneath them, as the chest sits over the inventory. Every move is a BUTTON,
 * so the whole thing works by keyboard and by tap; there is no drag to need a
 * fallback. Nothing happens until **Compare with the book**, and then each card
 * says where the book puts it, in the book's own words.
 *
 * IT GRADES NOTHING (apps/web/CLAUDE.md: no client-side scoring). There is no
 * score, no count of right and wrong, no verdict word, nothing recorded and
 * nothing sent: it places the student's sort beside the book's and lets them
 * read the difference. The moon's mastery comes only from its questions,
 * graded by the server (WEB-REVAMP 3.7a); this is a warm-up beside them.
 */

const COLUMNS: Column[] = ["architecture", "organization"];

export function SortEncounter({
  title,
  intro,
  cards,
}: {
  title: string;
  intro: string;
  cards: readonly Card[];
}): JSX.Element {
  const [placed, setPlaced] = useState<Record<string, Column>>({});
  const [compared, setCompared] = useState(false);
  const [said, setSaid] = useState("");
  const compareRef = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  const left = useMemo(() => cards.filter((c) => !placed[c.id]), [cards, placed]);
  const inColumn = (col: Column) => cards.filter((c) => placed[c.id] === col);

  const put = (card: Card, col: Column | null) => {
    setPlaced((p) => {
      const next = { ...p };
      if (col) next[card.id] = col;
      else delete next[card.id];
      const remaining = cards.filter((c) => !next[c.id]).length;
      setSaid(
        col
          ? `"${card.text}" is under ${COLUMN_WORD[col]}. ${remaining === 0 ? "Every card is sorted." : `${remaining} left to sort.`}`
          : `"${card.text}" is back with the cards to sort.`,
      );
      if (col && remaining === 0) window.setTimeout(() => compareRef.current?.focus(), 0);
      return next;
    });
  };

  const again = () => {
    setPlaced({});
    setCompared(false);
    setSaid("The cards are back, unsorted.");
    window.setTimeout(() => headRef.current?.focus(), 0);
  };

  return (
    <div className="sort" data-sort="" data-compared={compared ? "yes" : "no"}>
      <header className="sort-head">
        <p className="sort-eyebrow">Sort · a warm-up, never graded</p>
        <h2 ref={headRef} tabIndex={-1}>
          {title}
        </h2>
        <p className="sort-intro">{intro}</p>
      </header>

      <div className="sort-columns">
        {COLUMNS.map((col) => {
          const rule = COLUMN_RULE[col];
          const here = inColumn(col);
          return (
            <section key={col} className="sort-column sprite-panel" aria-labelledby={`sort-col-${col}`} data-column={col}>
              <h3 id={`sort-col-${col}`}>{COLUMN_WORD[col]}</h3>
              <p className="sort-rule">
                “{rule.text}” <cite>{rule.source.cite}</cite>
              </p>
              {here.length === 0 ? (
                <p className="sort-empty">Nothing here yet.</p>
              ) : (
                <ul className="sort-cards">
                  {here.map((card) => (
                    <li key={card.id} className="sort-card" data-card={card.id}>
                      <span className="sort-card-text">{card.text}</span>
                      {compared ? (
                        <span className="sort-book" data-book={card.column}>
                          {/* The same sentence wherever the card sits: no verdict word. */}
                          <span className="sort-book-where">The book puts it under {COLUMN_WORD[card.column]}.</span>
                          <q className="sort-book-why">{card.why}</q>
                          <cite>{card.source.cite}</cite>
                        </span>
                      ) : (
                        <span className="sort-moves">
                          <button type="button" className="sprite-button sort-move" onClick={() => put(card, null)}>
                            Unsort
                          </button>
                          <button
                            type="button"
                            className="sprite-button sort-move"
                            onClick={() => put(card, col === "architecture" ? "organization" : "architecture")}
                          >
                            To {COLUMN_WORD[col === "architecture" ? "organization" : "architecture"]}
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {!compared && (
        <section className="sort-tray sprite-panel" aria-labelledby="sort-tray-h">
          <h3 id="sort-tray-h">
            To sort <span className="mono">({left.length})</span>
          </h3>
          {left.length === 0 ? (
            <p className="sort-empty">Every card is in a column. Compare it with the book when you are ready.</p>
          ) : (
            <ul className="sort-cards">
              {left.map((card) => (
                <li key={card.id} className="sort-card" data-card={card.id}>
                  <span className="sort-card-text">{card.text}</span>
                  <span className="sort-moves">
                    {COLUMNS.map((col) => (
                      <button key={col} type="button" className="sprite-button sort-move" onClick={() => put(card, col)}>
                        {COLUMN_WORD[col]}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="sort-actions">
        {compared ? (
          <button type="button" className="sprite-button" onClick={again}>
            Sort again
          </button>
        ) : (
          <button
            ref={compareRef}
            type="button"
            className="sprite-button"
            disabled={left.length > 0}
            onClick={() => {
              setCompared(true);
              setSaid("Each card now says where the book puts it, and why.");
            }}
          >
            Compare with the book
          </button>
        )}
        <p className="sort-note">
          {compared
            ? "Nothing here was recorded. This moon is mastered by its questions above."
            : left.length > 0
              ? "Sort every card first. Nothing is recorded, and nothing is marked."
              : "Nothing is recorded, and nothing is marked."}
        </p>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

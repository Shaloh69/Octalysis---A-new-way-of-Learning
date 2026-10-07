import data from "../generated/changelog.json";

/**
 * `/app/changelog`, "What's new" (instructor, 7 Oct 2026, night): the
 * changes made to the student app, newest first, and one line of how far its
 * redesign is. `design/templates/web/changelog/SPEC.md`, against Linear's
 * changelog (a date rail beside each update); worn in the star HUD.
 *
 * Students see THEIR changes only (the instructor's answer): the written
 * highlights' `students` lists, never the commit list, the console's pages or
 * the phase names. Written at build time by `scripts/changelog.mjs`; nothing
 * here is fetched, so nothing here can fail to load.
 */

interface WebChangelog {
  madeAt: { commit: string; date: string };
  progress: { done: number; total: number; pct: number };
  updates: Array<{ date: string; title: string; items: string[] }>;
}

const LOG = data as WebChangelog;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-07` -> `7 Oct 2026`, a calendar date read without a time zone. */
function day(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function WhatsNewPage(): JSX.Element {
  const { done, total, pct } = LOG.progress;
  return (
    <section className="news" data-news="" aria-labelledby="news-title">
      <header className="news-head">
        <h1 id="news-title" className="news-title">What&apos;s new</h1>
        <p className="news-sub">What changed in OCTA for you, newest first.</p>
      </header>

      <section className="hud-panel news-progress" aria-labelledby="news-progress-title">
        <h2 id="news-progress-title" className="hud-caption">How far it is</h2>
        <div className="news-progress-body">
          <p className="news-progress-line">
            The student app&apos;s redesign: <span className="mono">{done}</span> of <span className="mono">{total}</span> steps
            done (<span className="mono">{pct}%</span>).
          </p>
          <span className="news-bar" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
                aria-label={`The redesign: ${done} of ${total} steps done`}>
            <span className="news-bar-fill" style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
          </span>
        </div>
      </section>

      <ol className="news-rail" aria-label="Updates">
        {LOG.updates.map((u) => (
          <li key={u.date} className="news-update" data-update={u.date}>
            <p className="news-date">
              <span className="news-dot" aria-hidden="true" />
              <time className="mono" dateTime={u.date}>{day(u.date)}</time>
            </p>
            <article className="hud-panel news-card" aria-labelledby={`news-${u.date}`}>
              <h2 id={`news-${u.date}`} className="news-card-title">{u.title}</h2>
              <ul className="news-items">
                {u.items.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

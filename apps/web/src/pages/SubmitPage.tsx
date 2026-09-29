import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { toast } from "../lib/toast";
import { useDelayed } from "../lib/useDelayed";
import { useWide } from "../map/body";

/**
 * `/app/work`: labs, project milestones and participation, 40% of the grade.
 * Starfield's inventory (`design/templates/web/work/template.png`,
 * WEB-REMAKE.md §8 row 8): the list of what the student has handed in or
 * drafted on the left, the chosen one's card on the right, a summary box
 * under the list.
 *
 * Two things carried over from the first page, deliberately:
 *
 * **THE WRITE-UP IS THE FIELD.** Every lab's rubric puts a full point on
 * stated reasoning and caps an unexplained right answer at 3 of 4, so the box
 * a student types their reasoning into is the largest thing in the card. The
 * server refuses a hand-in without one, and says why.
 *
 * **A DRAFT IS SAFE.** Saving a draft has no minimum and no deadline
 * pressure.
 *
 * The rows are one radio group (the stages list's pattern); the choice is
 * `?item=<id>`, or `?item=new` for a new hand-in. Under 900px the card opens
 * under its row.
 */

interface Sub {
  id: string;
  kind: string;
  slug: string;
  title: string;
  bodyMd: string;
  status: "draft" | "submitted" | "returned" | "graded" | "voided";
  submittedAt: string | null;
  dueAt?: string | null;
  score: number | null;
  maxScore: number | null;
  feedbackMd: string | null;
  isLate: boolean;
}

const STATUS_WORD: Record<Sub["status"], string> = {
  draft: "Draft",
  submitted: "Handed in",
  returned: "Returned to you",
  graded: "Marked",
  voided: "Voided",
};
const KIND_WORD: Record<string, string> = { lab: "Lab", project: "Project milestone", participation: "Participation" };

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export function SubmitPage(): JSX.Element {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = !subs && !error;
  const skeleton = useDelayed(loading, 400);
  const slow = useDelayed(loading, 3000);

  const load = useCallback(() => {
    setError(null);
    void api
      .mySubmissions()
      .then((r) => setSubs(r.submissions as Sub[]))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not reach the server. Check your connection and try again."));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <section className="work state-error hud-panel" data-work="error" role="alert">
        <h1 className="hud-caption">Your work did not load</h1>
        <div className="work-state-body">
          <p>{error}</p>
          <button type="button" className="button hud-button button-primary" onClick={load}>
            Try again
          </button>
        </div>
      </section>
    );
  }
  if (!subs) {
    if (!skeleton) return <section className="work" data-work="loading" aria-busy="true" />;
    return (
      <section className="work" data-work="loading" aria-busy="true" aria-labelledby="work-title">
        <WorkHead />
        {slow && <p className="work-slow">Still loading your work. The server may be waking up, which can take up to a minute.</p>}
        <div className="work-body" data-skeleton="">
          <div className="hud-panel work-list">
            <p className="hud-caption">Handed in and drafts</p>
            <div className="work-skel">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>
    );
  }
  return <Work subs={subs} reload={load} />;
}

function WorkHead(): JSX.Element {
  return (
    <header className="work-head">
      <h1 id="work-title" className="work-title">
        Your work
      </h1>
      <p className="work-intro">
        Labs <span className="mono">10%</span>, the project <span className="mono">20%</span>, participation{" "}
        <span className="mono">10%</span>: together <strong>40% of your grade</strong>. A draft saves without handing in.
      </p>
    </header>
  );
}

function Work({ subs, reload }: { subs: Sub[]; reload: () => void }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const wide = useWide(900);
  const want = params.get("item");
  const chosen: Sub | "new" | null = useMemo(() => {
    if (want === "new") return "new";
    return subs.find((s) => s.id === want) ?? subs[0] ?? "new";
  }, [want, subs]);
  const choose = (id: string) => setParams({ item: id }, { replace: !!want });

  const handed = subs.filter((s) => s.status !== "draft" && s.status !== "voided").length;
  const drafts = subs.filter((s) => s.status === "draft").length;
  const marked = subs.filter((s) => s.status === "graded").length;

  const card =
    chosen === "new" ? (
      <section className={`hud-panel work-card${wide ? "" : " is-inline"}`} data-card="new" aria-labelledby="work-card-title">
        <header className="work-card-head">
          <h2 id="work-card-title">Hand in something new</h2>
          <p className="work-card-sub">A lab, a project milestone, or participation evidence</p>
        </header>
        <SubmitForm onSaved={(id) => { reload(); if (id) choose(id); }} />
      </section>
    ) : chosen ? (
      <section className={`hud-panel work-card${wide ? "" : " is-inline"}`} data-card={chosen.id} aria-labelledby="work-card-title">
        <header className="work-card-head">
          <h2 id="work-card-title">{chosen.title}</h2>
          <p className="work-card-sub mono">{chosen.slug.toUpperCase()}</p>
        </header>
        <dl className="work-stats">
          <div>
            <dt>Kind</dt>
            <dd>{KIND_WORD[chosen.kind] ?? chosen.kind}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{STATUS_WORD[chosen.status]}</dd>
          </div>
          <div>
            <dt>Handed in</dt>
            <dd className="mono">{day(chosen.submittedAt)}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd className="mono">{day(chosen.dueAt)}</dd>
          </div>
          <div>
            <dt>Score</dt>
            <dd className="mono">{chosen.score !== null ? `${chosen.score}/${chosen.maxScore}` : "—"}</dd>
          </div>
        </dl>
        {chosen.isLate && <p className="work-note">Handed in after the deadline.</p>}
        {chosen.status === "graded" ? (
          <div className="work-read">
            <p className="work-note">
              Marked <span className="mono">{chosen.score}/{chosen.maxScore}</span>. This is now frozen: ask your
              instructor to return it if something is wrong.
            </p>
            {chosen.feedbackMd && (
              <>
                <h3 className="work-h3">Feedback</h3>
                <p className="work-text">{chosen.feedbackMd}</p>
              </>
            )}
            <h3 className="work-h3">What you wrote</h3>
            <p className="work-text">{chosen.bodyMd}</p>
          </div>
        ) : chosen.status === "voided" ? (
          <p className="work-note">Voided by your instructor. It does not count; what you wrote is kept.</p>
        ) : (
          <SubmitForm key={chosen.id} existing={chosen} onSaved={() => reload()} />
        )}
      </section>
    ) : null;

  return (
    <section className="work" data-work="" aria-labelledby="work-title">
      <WorkHead />
      <div className="work-body">
        <div className="work-side">
          <section className="hud-panel work-list" aria-labelledby="work-list-title">
            <h2 id="work-list-title" className="hud-caption work-list-caption">
              <span>Handed in and drafts</span>
              <span aria-hidden="true">Score</span>
            </h2>
            <button
              type="button"
              className={`work-new${chosen === "new" ? " is-on" : ""}`}
              aria-pressed={chosen === "new"}
              onClick={() => choose("new")}
            >
              + Hand in something new
            </button>
            {!wide && chosen === "new" && card}
            {subs.length === 0 ? (
              <p className="work-empty" data-empty="">
                Nothing handed in yet. Your instructor names the first lab; open <strong>Hand in something new</strong>{" "}
                when you are ready, and save a draft any time.
              </p>
            ) : (
              <fieldset className="work-items">
                <legend className="sr-only">Your hand-ins. Choose one to see it.</legend>
                {subs.map((s) => (
                  <div key={s.id} className="work-row">
                    <label className="work-item" data-item={s.id} data-status={s.status}>
                      <input
                        type="radio"
                        name="work-item"
                        className="sr-only"
                        checked={chosen !== "new" && chosen?.id === s.id}
                        onChange={() => choose(s.id)}
                      />
                      <span className="work-item-main">
                        <span className="work-item-title">{s.title}</span>
                        <span className="work-item-meta">
                          <span className="mono">{s.slug.toUpperCase()}</span> · {STATUS_WORD[s.status]}
                          {s.isLate && " · late"}
                        </span>
                      </span>
                      <span className="work-item-score mono">
                        {s.score !== null ? `${s.score}/${s.maxScore}` : "—"}
                      </span>
                    </label>
                    {!wide && chosen !== "new" && chosen?.id === s.id && card}
                  </div>
                ))}
              </fieldset>
            )}
          </section>
          <dl className="hud-panel work-sum">
            <div>
              <dt>Handed in</dt>
              <dd className="mono">{handed}</dd>
            </div>
            <div>
              <dt>Drafts</dt>
              <dd className="mono">{drafts}</dd>
            </div>
            <div>
              <dt>Marked</dt>
              <dd className="mono">{marked}</dd>
            </div>
          </dl>
        </div>
        {wide && card}
      </div>
    </section>
  );
}

function SubmitForm({ existing, onSaved }: { existing?: Sub; onSaved: (id?: string) => void }): JSX.Element {
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState(existing?.kind ?? "lab");
  const [body, setBody] = useState(existing?.bodyMd ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(submit: boolean) {
    setBusy(true);
    setErr(null);
    const code = slug.trim();
    try {
      const r = await api.saveSubmission(code, { kind, title: title.trim(), bodyMd: body, submit });
      toast.success(
        submit ? `${code.toUpperCase()} handed in` : `${code.toUpperCase()} draft saved`,
        submit && r.isLate ? "After the deadline, which your instructor will see." : undefined,
      );
      onSaved(r.id);
    } catch (e) {
      const why = e instanceof ApiError ? e.message : "Could not reach the server. Nothing was lost: try again.";
      setErr(why);
      toast.error(submit ? `${code.toUpperCase()} was not handed in` : `${code.toUpperCase()} draft was not saved`, why);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="work-form" onSubmit={(e) => e.preventDefault()} aria-busy={busy}>
      {!existing && (
        <div className="work-fields">
          <div>
            <label className="field-label" htmlFor="w-kind">
              What is it?
            </label>
            <select id="w-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="lab">A lab</option>
              <option value="project">A project milestone</option>
              <option value="participation">Participation</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="w-slug">
              Which one?
            </label>
            <input
              id="w-slug"
              className="field mono"
              placeholder="LAB-04"
              aria-describedby="w-slug-hint"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toUpperCase())}
            />
            <p className="note" id="w-slug-hint">
              The code from the lab manual, e.g. <span className="mono">LAB-04</span>.
            </p>
          </div>
          <div className="work-fields-wide">
            <label className="field-label" htmlFor="w-title">
              Title
            </label>
            <input id="w-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
      )}

      <label className="field-label" htmlFor="w-body">
        Your reasoning
      </label>
      <textarea
        id="w-body"
        className="field work-body-field"
        rows={10}
        aria-describedby="w-body-hint"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What you did, what you found, and why you did it that way."
      />
      <p className="note" id="w-body-hint">
        Worth a <strong>full point</strong> on the rubric: a correct answer with no explanation cannot score above{" "}
        <span className="mono">3</span> of <span className="mono">4</span>.
      </p>

      {err && (
        <p className="work-err" role="alert">
          {err}
        </p>
      )}

      <div className="work-actions">
        <button type="button" className="button hud-button" onClick={() => void save(false)} disabled={busy || !slug}>
          Save draft
        </button>
        <button
          type="button"
          className="button hud-button button-primary"
          onClick={() => void save(true)}
          disabled={busy || !slug || !title}
        >
          {busy ? "Saving…" : "Hand in"}
        </button>
      </div>
    </form>
  );
}

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

/**
 * Handing in a lab, a project milestone, or participation evidence.
 *
 * 40% of the grade goes through this page, and two things about it are
 * deliberate.
 *
 * **THE WRITE-UP IS THE FIELD.** Not an afterthought under a file upload. Every
 * lab's rubric puts a full point on stated reasoning and caps an unexplained
 * right answer at 3 of 4, so the box a student types their reasoning into is
 * the largest thing here. The server refuses a hand-in without one, and says
 * why rather than accepting it and marking it down later.
 *
 * **A DRAFT IS SAFE.** Saving a draft has no minimum and no deadline pressure.
 * A student mid-thought should never be choosing between losing it and handing
 * in something they are not ready to defend.
 */

interface Sub {
  id: string;
  kind: string;
  slug: string;
  title: string;
  bodyMd: string;
  status: "draft" | "submitted" | "returned" | "graded" | "voided";
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  feedbackMd: string | null;
  isLate: boolean;
}

export function SubmitPage(): JSX.Element {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = () => {
    void api
      .mySubmissions()
      .then((r) => setSubs(r.submissions as Sub[]))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Could not load your submissions."),
      );
  };
  useEffect(load, []);

  if (error) {
    return (
      <div className="state state-error" role="alert">
        <h2>That did not load</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (!subs) return <div className="state state-loading">Loading your work…</div>;

  return (
    <section className="submit-page">
      <p className="reader-eyebrow">Your work</p>
      <h1>Labs and the project</h1>
      <p className="submit-intro">
        Together these are <strong>40% of your grade</strong> — labs 10%, the project 20%,
        participation 10%. A draft saves without handing in.
      </p>

      {subs.length === 0 ? (
        <p className="submit-empty">
          Nothing yet. Your instructor will tell you which lab to hand in first; use the button
          below when you are ready.
        </p>
      ) : (
        <ul className="submit-list">
          {subs.map((s) => (
            <li key={s.id}>
              <div className="submit-row">
                <span className={`submit-status submit-status-${s.status}`}>{s.status}</span>
                <span className="mono submit-slug">{s.slug}</span>
                <span className="submit-title">{s.title}</span>
                {s.score !== null && (
                  <span className="mono submit-score">
                    {s.score}/{s.maxScore}
                  </span>
                )}
                <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  {s.status === "graded" ? "See feedback" : "Open"}
                </button>
              </div>

              {s.isLate && <p className="submit-late">Handed in after the deadline.</p>}

              {open === s.id && (
                <div className="submit-detail">
                  {s.status === "graded" ? (
                    <>
                      <p className="submit-graded">
                        Marked <span className="mono">{s.score}/{s.maxScore}</span>. This is now
                        frozen — ask your instructor to return it if something is wrong.
                      </p>
                      {s.feedbackMd && (
                        <>
                          <h3>Feedback</h3>
                          <p className="submit-feedback">{s.feedbackMd}</p>
                        </>
                      )}
                      <h3>What you wrote</h3>
                      <p className="submit-body">{s.bodyMd}</p>
                    </>
                  ) : (
                    <SubmitForm existing={s} onSaved={load} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="submit-new">
        <summary>Hand in something new</summary>
        <SubmitForm onSaved={load} />
      </details>
    </section>
  );
}

function SubmitForm({
  existing,
  onSaved,
}: {
  existing?: Sub;
  onSaved: () => void;
}): JSX.Element {
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState(existing?.kind ?? "lab");
  const [body, setBody] = useState(existing?.bodyMd ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(submit: boolean) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api.saveSubmission(slug.trim(), {
        kind,
        title: title.trim(),
        bodyMd: body,
        submit,
      });
      setMsg(
        submit
          ? r.isLate
            ? "Handed in — after the deadline, which your instructor will see."
            : "Handed in."
          : "Draft saved.",
      );
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="submit-form">
      {!existing && (
        <>
          <div className="field">
            <label htmlFor="s-kind">What is it?</label>
            <select
              id="s-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="submit-select"
            >
              <option value="lab">A lab</option>
              <option value="project">A project milestone</option>
              <option value="participation">Participation</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-slug">Which one?</label>
            <input
              id="s-slug"
              className="mono"
              placeholder="LAB-04"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toUpperCase())}
            />
            <p className="field-hint">The code from the lab manual, e.g. LAB-04.</p>
          </div>
          <div className="field">
            <label htmlFor="s-title">Title</label>
            <input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="s-body">Your reasoning</label>
        <textarea
          id="s-body"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What you did, what you found, and why you did it that way."
        />
        <p className="field-hint">
          This is worth a <strong>full point</strong> on the rubric. A correct answer with no
          explanation cannot score above 3 of 4.
        </p>
      </div>

      {err && (
        <p className="submit-err" role="alert">
          {err}
        </p>
      )}
      {msg && (
        <p className="submit-ok" role="status">
          {msg}
        </p>
      )}

      <div className="submit-actions">
        <button type="button" onClick={() => void save(false)} disabled={busy || !slug}>
          Save draft
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void save(true)}
          disabled={busy || !slug || !title}
        >
          {busy ? "Saving…" : "Hand in"}
        </button>
      </div>
    </div>
  );
}

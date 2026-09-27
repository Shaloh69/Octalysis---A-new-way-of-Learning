import { forwardRef, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Paperclip } from "lucide-react";
import { api, type Submission } from "@/lib/api";
import { dayTime } from "@/lib/assessments-view";
import {
  BANDS, LAB_MAX, STATUS_TONE, STATUS_WORD, bandOf, lateWords, markText, scoreProblem, scoreText, usesBands,
} from "@/lib/submissions-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

/**
 * The reading pane: who, the facts, what they wrote, and then ONE of three
 * things at its foot, by state (`SPEC.md` §The page):
 *
 *   - handed in or returned: the mark form (the manual's bands for a lab, a
 *     stated score for anything else) and Save grade;
 *   - graded: the frozen record and Return for revision…;
 *   - draft: one sentence, and nothing to press.
 */

interface PaneProps {
  s: Submission;
  /** Only below the breakpoint, where the pane replaces the queue. */
  onBack: (() => void) | null;
  onGraded: (s: Submission) => void;
  onReturn: (s: Submission, from: HTMLElement) => void;
}

export const Pane = forwardRef<HTMLHeadingElement, PaneProps>(function Pane({ s, onBack, onGraded, onReturn }, heading) {
  const markable = s.status === "submitted" || s.status === "returned";
  return (
    <section className="subs-pane" data-pane="" aria-labelledby="subs-pane-h">
      <div className="subs-pane-head">
        {onBack ? (
          <Button variant="ghost" size="sm" className="subs-back" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the queue
          </Button>
        ) : null}
        <h2 id="subs-pane-h" ref={heading} tabIndex={-1}>
          {s.studentName}
        </h2>
        <p className="subs-pane-sub">
          <span className="num whitespace-nowrap">{s.studentId}</span> · {s.title} ·{" "}
          <span className="num whitespace-nowrap" data-pane-slug="">
            {s.slug}
          </span>
        </p>
      </div>

      <Facts s={s} />

      {s.status === "draft" ? (
        <p className="subs-callout">
          This has not been handed in. A draft is the student&apos;s until they hand it in, so its content is not
          shown here and it cannot be marked.
        </p>
      ) : (
        <Work s={s} />
      )}

      {s.status === "returned" && s.feedbackMd ? (
        <div className="subs-callout" data-tone="info" data-returned-reason="">
          <p className="font-medium">Returned for revision</p>
          <p>{s.feedbackMd}</p>
        </div>
      ) : null}

      {markable ? <MarkForm key={s.id} s={s} onGraded={onGraded} /> : null}
      {s.status === "graded" ? <Record s={s} onReturn={onReturn} /> : null}
    </section>
  );
});

function Facts({ s }: { s: Submission }) {
  const late = s.isLate && s.status !== "draft";
  const handed = dayTime(s.submittedAt);
  const due = dayTime(s.dueAt);
  const mark = markText(s);
  const graded = dayTime(s.gradedAt);
  return (
    <dl className="subs-facts" data-facts="">
      <dt>State</dt>
      <dd>
        <Badge tone={STATUS_TONE[s.status]}>{STATUS_WORD[s.status]}</Badge>
      </dd>
      <dt>Handed in</dt>
      <dd>{handed ? <span className="num" data-date="">{handed}</span> : "not yet"}</dd>
      <dt>Due</dt>
      <dd>{due ? <span className="num" data-date="">{due}</span> : "no due date"}</dd>
      <dt>Late</dt>
      <dd>
        {lateWords(s)}
        {late ? <span className="subs-note">Recorded, not penalised: that is your call.</span> : null}
      </dd>
      {s.status === "graded" ? (
        <>
          <dt>Mark</dt>
          <dd>{mark ? <span className="num">{mark}</span> : "none recorded"}</dd>
          <dt>Marked by</dt>
          <dd>{s.graderName ?? "not recorded"}</dd>
          <dt>Marked on</dt>
          <dd>{graded ? <span className="num" data-date="">{graded}</span> : "not recorded"}</dd>
        </>
      ) : null}
    </dl>
  );
}

function Work({ s }: { s: Submission }) {
  const values = Object.entries(s.payload ?? {});
  return (
    <>
      <div data-body="">
        <h3 className="subs-h3">
          <FileText className="mr-1 inline h-3 w-3" aria-hidden="true" />
          What they wrote
        </h3>
        <p className="subs-body">{s.bodyMd?.trim() ? s.bodyMd : "Nothing written."}</p>
      </div>
      {s.attachments.length > 0 ? (
        <div>
          <h3 className="subs-h3">Attached</h3>
          <ul className="subs-files">
            {s.attachments.map((a) => (
              <li key={a.path}>
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                <span>{a.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {values.length > 0 ? (
        <div data-payload="">
          <h3 className="subs-h3">Recorded values</h3>
          <dl className="subs-facts">
            {values.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>{k}</dt>
                <dd>
                  <span className="num">{typeof v === "string" ? v : JSON.stringify(v)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </>
  );
}

function MarkForm({ s, onGraded }: { s: Submission; onGraded: (s: Submission) => void }) {
  const bands = usesBands(s.kind);
  const [band, setBand] = useState<number | null>(null);
  const [score, setScore] = useState("");
  const [max, setMax] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * A refused save raises an error toast, anchored to the foot of the screen;
   * at 380 it lands on this form's own alert and on Save grade (NEXT-SESSION
   * §0f.3). Scroll the actions up to the toast's clearance (their
   * `scroll-margin-bottom`, with room reserved under the pane at 380), so the
   * alert is read and Save sits clear of the toast.
   */
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) actionsRef.current?.scrollIntoView({ block: "end" });
  }, [error]);

  const problem = bands ? null : scoreProblem(score, max);
  const touched = score !== "" || max !== "";
  const ready = bands ? band !== null : problem === null;

  async function save() {
    if (!ready) return;
    const input = bands
      ? {
          score: band!,
          maxScore: LAB_MAX,
          rubric: { band: band!, criterion: BANDS.find((b) => b.score === band)?.label },
          feedbackMd: feedback.trim() || undefined,
        }
      : { score: Number(score), maxScore: Number(max), feedbackMd: feedback.trim() || undefined };
    setSaving(true);
    setError(null);
    try {
      await api.gradeSubmission(s.id, input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That grade was not saved.");
      toast.error(`The grade for ${s.studentName} was not saved`, "The form is as you left it.");
      setSaving(false);
      return;
    }
    toast.success(
      `Graded ${scoreText(input.score)}/${scoreText(input.maxScore)}: ${s.studentName}, ${s.slug}`,
    );
    setSaving(false);
    onGraded(s);
  }

  return (
    <div className="flex flex-col gap-3">
      {bands ? (
        <div>
          <p id="subs-bands-label" className="subs-h3">
            Rubric band, out of <span className="num">{LAB_MAX}</span>
          </p>
          <div role="group" aria-labelledby="subs-bands-label" className="subs-bands">
            {BANDS.map((b) => (
              <button
                key={b.score}
                type="button"
                className="subs-band"
                aria-pressed={band === b.score}
                onClick={() => setBand(b.score)}
              >
                <span className="num">{b.score}</span>
                <span className="flex-1">{b.label}</span>
              </button>
            ))}
          </div>
          <p className="subs-hint">
            Reasoning is worth a full point on every lab. A correct answer with no explanation caps at{" "}
            <span className="num">3</span>.
          </p>
        </div>
      ) : (
        <div>
          <p className="subs-h3">Mark</p>
          <div className="subs-score">
            <div>
              <Label htmlFor="subs-score">Score</Label>
              <Input id="subs-score" className="num" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="subs-max">Out of</Label>
              <Input id="subs-max" className="num" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          {touched && problem ? (
            <p className="subs-problem mt-1" data-score-problem="">
              {problem}
            </p>
          ) : (
            <p className="subs-hint">
              The manual&apos;s four bands are for labs. A {s.kind} is marked out of the maximum you state.
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="subs-feedback">Feedback</Label>
        <Textarea
          id="subs-feedback"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={bands ? "What would move this up a band?" : "What would raise this mark?"}
        />
        <p className="subs-hint">The student reads this with the mark.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
          Not saved. {error}
        </p>
      ) : null}

      <div ref={actionsRef} className="subs-actions">
        <Button onClick={() => void save()} disabled={!ready || saving}>
          {saving ? "Saving…" : "Save grade"}
        </Button>
        <span className="subs-hint">Once saved, it is frozen. Changing it means returning it, with a reason.</span>
      </div>
    </div>
  );
}

function Record({ s, onReturn }: { s: Submission; onReturn: (s: Submission, from: HTMLElement) => void }) {
  const mark = markText(s);
  const band = bandOf(s);
  return (
    <div className="subs-record" data-record="">
      <p className="subs-h3">The mark</p>
      <p className="subs-mark">
        {mark ? <span className="num">{mark}</span> : "no score recorded"}
      </p>
      {band ? (
        <p className="text-sm text-ink">
          Band <span className="num">{band.score}</span>: {band.label}
        </p>
      ) : null}
      <p className="subs-h3 mt-2">What the student reads</p>
      <p className="subs-body">{s.feedbackMd?.trim() ? s.feedbackMd : "No feedback was written."}</p>
      <p className="subs-callout mt-2">
        A graded submission is frozen: the student cannot change it, and neither can this page. To change the mark,
        return it for revision with a reason.
      </p>
      <div className="subs-actions">
        <Button variant="outline" onClick={(e) => onReturn(s, e.currentTarget)}>
          Return for revision…
        </Button>
      </div>
    </div>
  );
}

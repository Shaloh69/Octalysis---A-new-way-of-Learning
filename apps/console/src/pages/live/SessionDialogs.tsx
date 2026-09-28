import { useMemo, useState } from "react";
import type { LiveOptions, LiveSession } from "@/lib/api";
import { api } from "@/lib/api";
import { TYPE_LABEL } from "@/lib/items-view";
import { endedWords, plural, startedWords } from "@/lib/live-view";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

/*
 * Focus goes back to the question's own action when a dialog closes: End
 * question after a start, Start a question after an end, or whichever opened
 * it on Cancel. A controlled dialog with no Trigger returns focus nowhere
 * (NEXT-SESSION.md §0c.4), and the button that opened it may be gone.
 */
function backToTheQuestion(e: Event) {
  e.preventDefault();
  requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-question-action]")?.focus());
}

const REASON_MIN = 3;

/* ------------------------------------------------------------------ start */

export function StartDialog({
  open, onOpenChange, options, onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: LiveOptions;
  onStarted: (session: LiveSession) => void;
}) {
  const stages = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of options.items) if (!seen.has(i.stageId)) seen.set(i.stageId, i.stageTitle);
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [options.items]);

  const [stageId, setStageId] = useState<string | null>(stages[0]?.id ?? null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = options.items.filter((i) => i.stageId === stageId);
  const chosen = options.items.find((i) => i.id === itemId) ?? null;
  const ready = !!chosen && reason.trim().length >= REASON_MIN && !saving;

  function reset() {
    setItemId(null);
    setSectionId(null);
    setReason("");
    setError(null);
  }

  async function start() {
    if (!chosen) return;
    setSaving(true);
    setError(null);
    try {
      const { session } = await api.liveStart({ itemId: chosen.id, sectionId, reason: reason.trim() });
      toast.success(
        startedWords(session.itemSlug, session.section),
        "Students cannot answer it yet. It is on the projector, and in the audit log with your reason.",
      );
      onOpenChange(false);
      reset();
      onStarted(session);
    } catch (e) {
      const why = e instanceof Error ? e.message : "The server did not answer. Try again.";
      setError(why);
      toast.error("Question not started", why);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      {/* A column whose BODY scrolls: a refusal and the footer stay on screen
          (NEXT-SESSION.md §0m.1), and it stops short of the toast's corner. */}
      <DialogContent
        className="ease-dialog lv-dialog flex max-h-[calc(100vh-12rem)] max-w-2xl flex-col max-sm:top-3 max-sm:translate-y-0 lg:max-w-4xl"
        onCloseAutoFocus={backToTheQuestion}
      >
        <DialogHeader>
          <DialogTitle>Start a question</DialogTitle>
          <DialogDescription>
            One live item, put to the room. Students cannot answer it yet: the student side of Lecture Mode is
            not built.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5" data-start-body="">
          {/* Two columns from 64rem: what to ask on the left, who and why on the
              right, so a teacher sees the whole choice without scrolling it. */}
          <div className="lv-start-grid">
          <div className="lv-start-col">
          <div role="group" aria-label="Stage" className="lv-field">
            <p className="lv-label">Stage</p>
            <div className="lv-pills">
              {stages.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={s.id === stageId ? "default" : "outline"}
                  aria-pressed={s.id === stageId}
                  onClick={() => {
                    setStageId(s.id);
                    setItemId(null);
                  }}
                >
                  <span className="num">{s.id}</span>
                  <span className="sr-only"> {s.title}</span>
                </Button>
              ))}
            </div>
          </div>

          <div role="group" aria-label="Question" className="lv-field">
            <p className="lv-label">
              Question <span className="lv-faint">· live items in stage {stageId ?? "—"}, {plural(items.length, "item", "items")}</span>
            </p>
            <ul className="lv-choices">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="lv-choice"
                    aria-pressed={i.id === itemId}
                    onClick={() => setItemId(i.id)}
                  >
                    <span className="lv-choice-top">
                      <span className="num text-ink">{i.slug}</span>
                      <span className="lv-faint">{TYPE_LABEL[i.type]}</span>
                    </span>
                    {i.objective ? <span className="lv-choice-objective">{i.objective}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          </div>

          <div className="lv-start-col">
          <div role="group" aria-label="Who may answer" className="lv-field">
            <p className="lv-label">Who may answer</p>
            <div className="lv-pills">
              <Button
                size="sm"
                variant={sectionId === null ? "default" : "outline"}
                aria-pressed={sectionId === null}
                onClick={() => setSectionId(null)}
              >
                Everyone
              </Button>
              {options.sections.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={sectionId === s.id ? "default" : "outline"}
                  aria-pressed={sectionId === s.id}
                  onClick={() => setSectionId(s.id)}
                >
                  <span className="num">{s.code}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="lv-field">
            <Label htmlFor="lv-start-why">Why</Label>
            <Input
              id="lv-start-why"
              value={reason}
              maxLength={500}
              placeholder="For the audit log, e.g. warm-up on cache mapping"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not started. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void start()} disabled={!ready}>
            {saving ? "Starting…" : "Start question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ end */

export function EndDialog({
  open, onOpenChange, session, onEnded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: LiveSession;
  onEnded: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = reason.trim().length >= REASON_MIN && !saving;

  async function end() {
    setSaving(true);
    setError(null);
    try {
      await api.liveEnd(session.id, reason.trim());
      toast.success(endedWords(session.itemSlug, session.answered), "It takes no more answers. The audit log has your reason.");
      onOpenChange(false);
      setReason("");
      onEnded();
    } catch (e) {
      const why = e instanceof Error ? e.message : "The server did not answer. Try again.";
      setError(why);
      toast.error("Question not ended", why);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={backToTheQuestion}>
        <DialogHeader>
          <DialogTitle>End this question</DialogTitle>
          <DialogDescription>
            <span className="num text-ink">{session.itemSlug}</span>, answered by{" "}
            {plural(session.answered, "student", "students")}. Once ended it takes no more answers, and it cannot
            be reopened.
          </DialogDescription>
        </DialogHeader>
        <div className="lv-field">
          <Label htmlFor="lv-end-why">Why</Label>
          <Input
            id="lv-end-why"
            value={reason}
            maxLength={500}
            placeholder="For the audit log, e.g. discussed the answer"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not ended. {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void end()} disabled={!ready}>
            {saving ? "Ending…" : "End question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

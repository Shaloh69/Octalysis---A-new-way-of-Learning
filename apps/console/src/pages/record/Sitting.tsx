import type { AttemptDetail } from "@/lib/api";

/**
 * The sitting (instructor ruling 3, 30 Sep 2026): every time the student left
 * the paper (full screen, or the page) and came back, in order, with the
 * server's time. A fact about the sitting, never a verdict: no colour, and the
 * count is a number beside words. The student saw each leave covered on their
 * own screen as it happened.
 *
 * Ruling 4 (6 Oct 2026): leaving now HANDS THE PAPER IN. "Closed the page" and
 * "Handed in because they left" say so; the second is written by the server
 * beside the submit, so a paper the student did not submit themself is never
 * mistaken for one they did.
 */
const WORD: Record<NonNullable<AttemptDetail["events"]>[number]["kind"], string> = {
  left_fullscreen: "Left full screen",
  left_page: "Left the page",
  returned: "Came back",
  fullscreen_unavailable: "Sat without full screen (the device cannot use it)",
  closed: "Closed or reloaded the page",
  auto_submitted: "Handed in because they left (ruling 4)",
};

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function Sitting({ events }: { events: NonNullable<AttemptDetail["events"]> }) {
  const leaves = events.filter((e) => e.kind === "left_fullscreen" || e.kind === "left_page" || e.kind === "closed").length;
  const handedIn = events.some((e) => e.kind === "auto_submitted");
  return (
    <div className="sitting" data-sitting-record="">
      <p className="text-sm text-ink">
        Left the paper <span className="num">{leaves}</span> {leaves === 1 ? "time" : "times"}
        {events.length === 0 ? <span className="text-ink-muted"> · nothing recorded</span> : null}
        {handedIn ? <span className="text-ink-muted"> · handed in automatically when they left</span> : null}
      </p>
      {events.length > 0 ? (
        <ol className="sitting-list">
          {events.map((e, i) => (
            <li key={i}>
              <span className="num text-ink-muted">{clock(e.at)}</span> <span className="text-ink">{WORD[e.kind]}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

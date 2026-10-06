import type { Db } from "./db.js";
import { loadAttempt, submitAttempt, updateStageProgress, type AttemptContext } from "./repo/engine-repo.js";

/**
 * Leaving a paper submits it (instructor ruling 4, 6 Oct 2026; root CLAUDE.md
 * hard rule 9; db/addendum-sitting.sql).
 *
 * The page submits for itself when it can: on leaving full screen, after 15
 * seconds hidden, on `pagehide`, and on a reload it recognises as its own.
 * This file is the backstop for when it cannot (a closed tab whose request
 * never left, a phone that froze the page): a paper that has been LEFT is
 * submitted the next time its student touches the API (Start, the map, the
 * chat), with the answers recorded so far, and that uses the attempt.
 *
 * A moon's journey is practice (scope 'objective') and is never submitted
 * here. Nothing is ever voided: an auto-submit is a submit.
 */

/** Away longer than this is leaving (ruling 4: "15 seconds grace"). */
export const GRACE_SECONDS = 15;
/** Nothing at all for this long: the sitting is over, whatever was or was not reported. */
export const IDLE_HOURS = 2;

export type LeftBecause = "left_fullscreen" | "left_page" | "closed" | "idle";

export interface Finished {
  attemptId: string;
  alreadySubmitted: boolean;
  score: number;
  maxScore: number;
  mastery: number;
  result: Awaited<ReturnType<typeof submitAttempt>>;
}

/** Submit, and feed mastery to the lock (stage checks only). The submit route and the sweep share it. */
export async function finishAttempt(db: Db, attempt: AttemptContext): Promise<Finished> {
  const result = await submitAttempt(db, attempt);
  if (attempt.blueprintScope === "stage" && result.items.length > 0 && !result.alreadySubmitted) {
    await updateStageProgress(db, {
      userId: attempt.userId,
      stageId: result.items[0]!.stageId,
      mastery: result.mastery,
      score: result.score,
    });
  }
  return {
    attemptId: attempt.attemptId,
    alreadySubmitted: result.alreadySubmitted,
    score: result.score,
    maxScore: result.maxScore,
    mastery: result.mastery,
    result,
  };
}

/** Record that the paper was submitted because the student left it, and why. */
export async function recordAutoSubmit(db: Db, attemptId: string): Promise<void> {
  await db.query(`insert into attempt_events (attempt_id, kind) values ($1, 'auto_submitted')`, [attemptId]);
}

/**
 * The open papers of `userId` (checks and exams, never journeys) that have
 * been left, and why. Left: full screen was exited; the page was reported
 * closed; the last leave/return was a leave more than GRACE_SECONDS ago; or
 * nothing has happened on it for IDLE_HOURS.
 */
export async function leftPapers(db: Db, userId: string): Promise<Array<{ attemptId: string; because: LeftBecause }>> {
  const { rows } = await db.query(
    `with open as (
       select a.id, a.started_at
         from attempts a
         join assessments s on s.id = a.assessment_id
         join blueprints b on b.id = s.blueprint_id
        where a.user_id = $1 and a.status = 'in_progress' and b.scope <> 'objective'
     )
     select o.id::text as attempt_id,
            case
              when exists (select 1 from attempt_events e where e.attempt_id = o.id and e.kind = 'left_fullscreen') then 'left_fullscreen'
              when exists (select 1 from attempt_events e where e.attempt_id = o.id and e.kind = 'closed') then 'closed'
              when (select e.kind from attempt_events e
                     where e.attempt_id = o.id and e.kind in ('left_page', 'returned')
                     order by e.at desc, e.id desc limit 1) = 'left_page'
                   and (select max(e.at) from attempt_events e where e.attempt_id = o.id and e.kind = 'left_page')
                       < now() - make_interval(secs => $2)
                then 'left_page'
              when greatest(o.started_at,
                            coalesce((select max(r.answered_at) from responses r where r.attempt_id = o.id), o.started_at),
                            coalesce((select max(e.at) from attempt_events e where e.attempt_id = o.id), o.started_at))
                   < now() - make_interval(hours => $3)
                then 'idle'
            end as because
       from open o`,
    [userId, GRACE_SECONDS, IDLE_HOURS],
  );
  return rows
    .filter((r) => r.because !== null)
    .map((r) => ({ attemptId: r.attempt_id as string, because: r.because as LeftBecause }));
}

/** Submit every paper `userId` has left. Returns how many. Cheap when there are none. */
export async function submitLeftPapers(db: Db, userId: string): Promise<number> {
  const left = await leftPapers(db, userId);
  let n = 0;
  for (const { attemptId } of left) {
    const attempt = await loadAttempt(db, attemptId);
    if (!attempt || attempt.status !== "in_progress") continue;
    const done = await finishAttempt(db, attempt);
    if (!done.alreadySubmitted) {
      await recordAutoSubmit(db, attemptId);
      n++;
    }
  }
  return n;
}

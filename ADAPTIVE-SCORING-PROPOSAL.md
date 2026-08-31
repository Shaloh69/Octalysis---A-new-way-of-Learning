# ADAPTIVE-SCORING-PROPOSAL.md
### This file is deliberately OUTSIDE `docs/redesign/`. It is not part of the R0-R5 presentation track, it is not something the solar-system kickoff prompt should touch, and it should not be built in the same session as anything visual. It touches the grading engine, which means it touches the one part of this project everything else is built to protect. Treat this document as a proposal requiring its own explicit go-ahead, its own denial tests, and ideally its own conversation with whoever signs off on grading policy for the course.

---

## The idea, stated precisely

Right now, fairness means: same blueprint, different numbers, same difficulty
distribution. Two students' raw scores are directly comparable because the
thing they were scored on was engineered to be equivalent.

The idea on the table: let item difficulty vary more meaningfully — some
students draw harder configurations of a topic than others, "on purpose,"
because a little friction is part of what makes a system worth engaging with
— **and still keep grades comparable**, by scoring *ability* rather than *raw
correctness*. This is not a new idea invented for this conversation — it's
Item Response Theory (IRT), the actual statistical framework behind every
serious adaptive exam (GRE, GMAT, and most large-scale standardized testing
built in the last 40 years). The reason it's worth taking seriously here
isn't "it sounds sophisticated" — it's that it's the one way to get real
difficulty variation without the grade gap becoming noise.

## The mechanism, in plain terms

Instead of "12 out of 15 correct = 80%," an IRT-style model asks: **given the
known difficulty of the specific items this student was scored on, how far
above or below the expected performance for their estimated ability level did
they actually land?** A student who gets 8/15 on a harder-than-average draw
can legitimately score higher than a student who gets 12/15 on an
easier-than-average draw — and that's not a bug, it's the model correctly
recognizing that the second student's 12/15 required less understanding to
achieve.

The simplest version (a reasonable first step, not full 3-parameter IRT):
**difficulty-weighted scoring.** Each item's empirical difficulty (not
guessed — measured) contributes a weight to how much credit a correct answer
is worth. Harder items measured as harder are worth more. This gets you most
of the fairness benefit of full IRT with a much smaller, more auditable
implementation.

## What already exists that this builds on — don't rebuild it

**`recompute_item_stats()` (P7, already built and verified against real
submitted attempts) already computes p-value and point-biserial discrimination
per item, nightly, via `pg_cron`.** P-value is literally "empirical
difficulty" — the fraction of students who got it right. This is the exact
input an ability-adjusted scoring model needs, and it's sitting there today
being used only to flag items for review. Reusing it for scoring is
extending an existing, tested pipeline, not building a new one from scratch.

**What doesn't exist yet, and would need to be built:**
- An ability-estimation function (even the simplified difficulty-weighted
  version) — this is new code in the grading service, `services/api`
- A defensible minimum-exposure threshold before an item's p-value is trusted
  enough to weight a real grade with (P7's existing "under 30 exposures, the
  numbers mean nothing yet" rule already establishes this instinct — extend
  it, don't relitigate it)
- A student- and teacher-facing explanation of what the score now means —
  "80%" stops being a simple fraction, and `console/students/:id`'s
  grade-dispute conversation needs a clear, honest way to show *why* a score
  landed where it did, item by item, difficulty-weighted, not just
  right/wrong
- New denial tests specific to this: can a student's own client ever see or
  influence the difficulty weighting? (Answer must be no, same hard-rule
  shape as everything else — weighting is computed server-side from
  `recompute_item_stats()`'s output, never client-visible until results)

## Real-world grounding, so this isn't just an argument from first principles

Item Response Theory backs essentially every major standardized computerized
adaptive test in wide use — it's precisely the framework built to solve "two
people took different-difficulty tests, how do we compare them fairly."
That's a stronger, more established answer to "make difficulty variation feel
fun without becoming unfair" than any bespoke scoring scheme this project
could invent from scratch, and it's the kind of thing a thesis committee will
recognize by name rather than have to be sold on.

## Why this is scoped separately, explicitly

1. **It changes what a grade means**, for real students, in a system whose
   entire hard-rule culture exists to protect grading integrity. That's not
   a visual decision.
2. **It needs its own denial tests**, same discipline as every other grading
   change in this project's history (P0's six denial tests, P3's blueprint
   fairness tests, P7's "nobody approves their own item" refusal tests).
3. **It needs instructor buy-in specifically**, separate from any UI
   decision — the instructor is the one who has to be able to explain a
   grade to a student, a department, or an accreditation body, and "your
   score is difficulty-weighted via a psychometric model" is a real thing to
   explain, not a cosmetic choice.
4. **It should not be built in the same session, or even the same week, as
   anything from the solar-system redesign.** Mixing "let's make the map
   prettier" and "let's change how grades are computed" into one Claude Code
   session is exactly the kind of scope creep that makes the review of
   *either* change harder. Keep them separate artifacts, separate sessions,
   separate sign-offs.

## Suggested next step, if this moves forward

A short standalone design pass, scoped like any other phase in this project:
read `MASTER-PLAN.md`'s question-engine section and `VERIFICATION.md` in
full, write the denial tests *before* the scoring function (same discipline
as P0), and get the instructor to review a worked example — two real
students, two different-difficulty draws, the resulting scores, and a plain-
language explanation of why the gap is fair — before any of it touches a real
class.

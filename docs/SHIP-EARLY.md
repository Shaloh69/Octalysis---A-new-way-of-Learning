# SHIP-EARLY.md — what can go to production now, and what waits

**Written 14 September 2026.** Every claim here was measured; the command is
given beside it. The question this answers is the instructor's:

> *What part can we ship early that will still work in production, and what
> moves to a later update?*

---

## 1. The answer in one paragraph

**Ship the Prelim slice: stages 00–04, the Prelim examination, submissions, and
the teacher console.** Everything it needs is authored, banked and tested. The
Midterm is one authored chapter away. Semi-final and Finals are a later update
and the code already says so — `engine/scope.ts` has drawn that line since
9 September.

**But one thing must be built first, and it is not optional:** there are no
stage-scoped blueprints, so no stage check exists, so mastery never advances,
so **no student can progress past stage 00**. §3 is that finding in full. It is
small, bounded, and it blocks everything else.

---

## 2. What is genuinely production-ready

| Slice | State | Evidence |
|---|---|---|
| Auth, roster-gated registration | ready | P1 · 38 RLS denial tests |
| Bootstrap admin + forced credential change | ready | `bootstrap-admin.mjs`, 6 API cases |
| Skill tree — 3D and flat, degrading in place | ready | R1/R2 closed, 36+21 boxes |
| Stage reader, **stages 00–07** | ready | authored prose, 89–330 lines each |
| Question engine — seeded, unique per student | ready | 60 solvers, hand-computed anchors |
| Item bank — **stages 01–08, 183 items** | ready, **unapproved** | `sync-items.mjs`, feasibility spec |
| Prelim + Midterm assessments | seeded | `sync-assessments.mjs`, 5 attempts |
| Submissions — labs, project, participation (**40%**) | ready | `addendum-submissions.sql` |
| Teacher console — 15 routes | ready | P4 · review queue, exam window |
| Feedback + SUS | ready | P8 |

**Counted:** items per stage — 01:15 · 02:24 · 03:33 · 04:24 · 05:19 · 06:33 ·
07:20 · 08:15.

---

## 3. THE BLOCKER — no stage check exists, so nothing unlocks

**Measured, 14 Sep:**

```
select b.scope, count(*) from blueprints b group by b.scope;
 scope | count
-------+-------
 final |     4          <- and NOTHING with scope = 'stage'
```

Then, for a real seeded student:

```
 id | prereq | prereq_mastery | unlocked
----+--------+----------------+----------
 00 | {}     |              0 | t
 01 | {00}   |              0 | f
 02 | {01}   |          0.440 | f
 05 | {04}   |          0.300 | f
```

**The chain that breaks:**

1. `is_stage_unlocked()` step 4 requires **all prerequisites at ≥ 70% mastery**.
2. `stage_progress.mastery` is written only by `updateStageProgress`, which
   `routes/attempts.ts:142` runs **only when `blueprintScope === "stage"`**.
3. `routes/stages.ts:233` finds a stage's check as *"an `assessments` row whose
   blueprint is scoped to this stage"*.
4. **`db/schema.sql` seeds zero stage-scoped blueprints.** All four are `final`.

So no stage check can be offered, no mastery can be earned, and every stage
after 00 stays locked. The curriculum is one linear chain, so that is all 18 of
them. The only way through today is a teacher overriding each stage by hand in
`/locks`.

**Why it was invisible.** Nothing fails. The schema applies, the API starts, the
map renders, the exams exist. A teacher testing with a staff account sees
everything unlocked, because `is_stage_unlocked()` returns true for staff on its
first line. It only appears for a real student with a real profile — which is
why a staff-account walkthrough would never have caught it.

**The fix, and why it is small.** Seed one stage-scoped blueprint per gradeable
stage and let `sync-assessments.mjs` create the matching assessments. The bank
already supports it: items carry `stage_id`, and `fillBlueprint` filters the pool
to that stage for a stage-scoped blueprint. Keep the constraints loose — a total
and `max_per_objective` — because stage 01 holds no P items at all and a uniform
`by_type` requiring them would be unsatisfiable there. `bank-feasibility.spec.ts`
extends to prove every stage check fills before a student sees it.

---

## 4. The recommended ship, in order

### Ship 1 — "Prelim" · the smallest thing that is a real course

- Stages **00–04** readable, checkable, unlockable
- **Prelim examination**, 40 items from act 1, five attempts
- Submissions, console, feedback, the map
- Chapters 01–04 authored; the bank's 96 act-1 items reviewed and approved

**Blocked only by §3.** Everything else exists.

### Ship 2 — "Midterm" · one authored chapter away

Adds stages **05–08** and the Midterm. Items already exist for all four
(87 of them). **Chapter 08 is still a scaffold** — 05, 06 and 07 are authored.
So either author chapter 08, or ship the Midterm knowing one of its four
chapters has no reading behind its 15 items. The scaffold callout is honest
about that on the page, which makes the second option defensible but worse.

### Later update — Semi-final and Finals

Stages **09–18**. Solvers are written, tested and registered; items are not, and
the prose is eleven scaffolds. `engine/scope.ts` already withholds both exams,
and `scope.spec.ts` fails if the flag is widened without the bank moving with
it. **Nothing needs to change for the first two ships to be correct.**

### Also later, and not on the critical path

Simulators (P6) · the public marketing site (five routes, no phase owns them) ·
the results page · R4 moons · R5 sign-off · the five deferred minigames.

---

## 5. What "production" additionally requires

Independent of the above, from `IMPLEMENTED.md` §Deployment (measured 9 Sep):

- The live Supabase project is **21 tables where the schema defines 22** — the
  missing one is `submissions`, 40% of the grade. `db-push-supabase.mjs` omitted
  `addendum-submissions.sql`; fixed in `d98ed0d`, **not yet applied**.
- Live has **18 stages, not 19** — it predates the 18-chapter rebuild.
- Live has zero objectives, content, items, assessments and profiles.
- Re-pushing needs `--reset`, which drops the public schema. Safe today (nothing
  to lose) but **irreversible, and it needs the instructor's explicit go-ahead
  plus a fresh `--check` immediately before.**
- Whether Vercel and Render are connected and building is **unverified**.

---

## 6. The honest cost of shipping early

- **Mastery numbers will not be psychometrically meaningful.** `item_stats`
  needs ≥30 exposures per item before a p-value means anything. `DELIVERY.md`
  §3.2 already says an alpha must not be used for a real grade, and that stands.
- **183 items have not been reviewed by a human.** They are all `review` and
  nothing is examinable until the instructor approves them at `/items`.
- **Stage 00 has zero objectives**, so its "mastery" is a formality. Whatever
  stage-scoped blueprint it gets has to acknowledge that rather than pretend.

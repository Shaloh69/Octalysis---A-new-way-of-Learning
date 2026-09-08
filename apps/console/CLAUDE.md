# apps/console — teacher + admin

Vite + React 18 + TS + Tailwind + Radix. `pnpm --filter @octa/console dev` on :5174.

## Provenance
Built as **shadcn's approach, not shadcn's template**: Radix primitives with the component source
owned in-repo under `src/components/ui/`. Cloning `satnaing/shadcn-admin` would have imported a
demo app to delete, and its slate/blue palette is the thing the P4 exit criteria forbid.

Do NOT assume these components match the shadcn docs — they are ours, and they are smaller.

## The palette is `packages/tokens`, and the config enforces it
`tailwind.config.ts` **deletes** Tailwind's default palette rather than extending it. An upstream
colour utility is therefore not a rule violation that renders fine; it produces no CSS at all, and
`scripts/scan-console-palette.mjs` (`pnpm lint`) turns that into a build failure. The scanner also
rejects a literal hex and any `dark:` variant — themes are driven by `[data-theme]`, never by a
Tailwind variant, so there must be exactly one palette mechanism.

It flags a banned utility **even inside a comment**, on purpose. A rule you can document your way
around is not a rule.

## Auth
Route guards read role from JWT `app_metadata`, never from `profiles.role`. A student who edits
their profiles row must still be blocked.

`roleFromClaims()` mirrors `jwt_role()` including its failure mode: anything unknown, missing or
malformed maps to **least privilege**. Never read `user_metadata` — it is client-writable through
the Supabase auth API, and reading it instead of `app_metadata` is a privilege escalation that
looks like a one-word typo in review. There is a test for that exact substitution.

The guard decides what to RENDER and nothing more. Every console route calls `requireStaff()` on
the server and RLS denies beneath it, so deleting this file would make the app ruder, not less
secure.

## Pages
| Route | What it is for |
|---|---|
| `/locks` | students × stages. Reason mandatory on every toggle. **Never computes a lock** — `is_stage_unlocked()` decides, the same authority the student app reads |
| `/students`, `/students/:id` | roster, import (dry-run first), progress, attempt list |
| `/attempts/:id` | the exact paper, replayed from the stored seed. The only place the key is shown |
| `/gradebook` | mastery per stage + class average. **Lazy-loaded** — Recharts is ~105 KB gz and nothing else imports it |
| `/content` | per-chapter authoring status: authored / scaffold / empty |
| `/audit` | who changed what and why. Read-only, and there is no delete control by design |
| `/system` | `run_invariants()`, live |
| `/feedback` | reports with the resolved variant attached, and the SUS score |
| `/items` | the bank and its review queue. Approve, **send back with a required reason**, retire, version. A decision advances to the next item rather than closing — a seeded bank is a few hundred decisions and closing each time pushes a reviewer toward rubber-stamping. The self-approval tick is gated on AUTHORSHIP, not just status: offering it on an item the reviewer did not write records a false statement in `audit_log`. p-value and discrimination per item once `item_stats` has them |
| `/assessments` | **the route that made the engine reachable.** Creating one mints the exam salt. The feasibility check answers *"can this blueprint be filled?"* naming the shortfall cell, before a student presses Start rather than at Start |
| `/submissions` | the lab and project marking queue. A graded submission's content freezes; regrade is an explicit, audited unlock |
| `/live`, `/live/present` | Lecture Mode and the projector view |

**Not built:** `/console/analytics` — the psychometrics view. `item_stats` is computed nightly and
`/items` shows p-value and discrimination per item; what is missing is the cohort-level chart, and
it cannot say anything true until items have ≥30 exposures. `/console/settings` is also absent;
every setting it would hold is currently an environment variable.

## Rules
- Every write that changes student-visible state writes to `audit_log` with actor and reason.
- Projector view (`/console/live/present`) shows NO names, ever. Aggregates only. This is
  enforced in the **payload**, not the render: `routes/live.ts` never selects `full_name`,
  `student_id` or `user_id`, so a future component cannot leak one by accident. Below
  `MIN_COHORT = 5` responses the answer spread is `[]` — with four students in a room, a
  distribution names people.
- Editing a live item creates a new row sharing `family_id` with `version + 1`, and retires the
  old row. The confirm dialog must say that stats do not carry over, in those words.
- Tables: TanStack Table. Charts: Recharts. Do not add another table or chart library.
- `danger` styling is for destructive STAFF actions only. It is never used to tell a student they
  were wrong — incorrect answers get a neutral response, and this view goes on a projector.
- Pure logic lives in `src/lib/` and is tested. UI is not tested. `parseRoster` is there because
  `Dela Cruz, Juan Miguel` is the normal case here, not an edge case.

## The bundle carries the answer key, and that is correct
`scripts/scan-bundle.mjs` runs **two profiles**. The student bundle must not contain
`correctValue` at all; this one may, because the drill-down exists to show it and
`ai_after_submit` grants staff the same read in the database.

What is forbidden in both: `service_role`, `exam_salt`, engine internals — and **any live answer
value from the database**. A bundle is a static file, and a static file has no idea who is asking.

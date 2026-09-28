# `/feedback` — SPEC

**What students report about the course and the platform, worked down as a
queue: each report once, in words, with the exact instance it was about.**

`PAGE-SPECS.md` §4.4 is the plan: two tabs, **"My feedback"** (what this
teacher submitted, with a status and a "Released in" badge) and **"All
feedback"** (triage `new → triaged → in progress → shipped | won't fix`,
auto-dedupe by route and text, severity, filters by channel, route, role and
version, a SUS trend, Export CSV). §4.1: "show the teacher exactly what's
attached". §4.2: a content report carries "the exact resolved variant".

References: `SOURCE.md` (shadcn.io's Account Feedback History for the frame,
shadcn-admin's Tasks for the dense row, shadcn.io's Customer Feedback for a
score beside its n). Colours and type are ours.

## What was missing — 29 Sep 2026, before the rebuild

| Planned | Found |
|---|---|
| Two tabs | One list. "My feedback" could hold nothing: **the console has no way to send feedback** (§4.1's flag exists only in the student app) |
| Filters by channel, route, role, version | Status only. The API already took `channel`; the page never sent it |
| Every report | `GET` capped at **300**, with no count, so a cap would hide rows silently |
| Severity, "Released in" | The PATCH accepted both; the page offered neither |
| Auto-dedupe | None. The seed's 11 rows are three texts: "4 KB vs 8 KB" five times, each triaged on its own |
| What's attached | `route`, `app_version` and `context` never shown |
| The exact variant | Rendered nothing when absent. All 5 seeded content reports have no item and no variant (INV-25); the page said nothing about it |
| SUS, students and teachers separately | One mean, no n threshold, no split |
| Export CSV | None |
| Confirmation | A triage changed a row with no toast |
| 380 | `table-scroll`: a sideways scroller, which the gate counts as clipping |

## Instructor decisions, 29 Sep 2026

| Question | Ruling |
|---|---|
| Tabs | **One queue for all staff.** "My feedback" is deferred until the console has its own flag (§4.1, shell work, its own session); teacher and admin are one role (D4) |
| Triage | **Status, severity (low / medium / high) and "Released in"**, one toast per change |
| Scale | **The `/audit` pattern**: status and kind filtered on the server, in the address; "Showing N of M"; 100 a page and **Load older**; **Export CSV** of every match, formula-guarded |
| Duplicates, SUS | **Exact repeats are one row** (same kind, item, route, text and status), "reported 5 times", every reporter inside, **one triage for all of them** (a bulk PATCH, one audit row per report). **SUS by role** with its n, "not yet reliable" below 20 (§4.3), no trend until SUS rows carry a release |

## Structure, top to bottom

1. **Header**: *Feedback*, one line: what students report, and that a report
   about a question carries the exact numbers they saw. On the right,
   **Export CSV**
2. **Usability (SUS)**, one row (Customer Feedback): the mean and its n for
   **students** and for **staff**, each "no responses yet" when empty (never a
   0), and "fewer than 20 responses: not yet reliable" below 20. The rule that
   governs when the survey appears is said once
3. **Status**, five pressed buttons with their counts, plus **All**
   (Feedback History's counts, which are also the filter): *New 5 · Triaged 4 ·
   In progress 0 · Shipped 2 · Won't fix 0*. **Kind**: a select, *All kinds*,
   *Flags*, *Question reports*, *Satisfaction (CSAT)*. Both in the address
4. **A result line**: "Showing 3 of 3 groups · 11 reports", mono numbers
5. **Table** at **52rem** of the page's own width and up, one row per group:
   **Status** (a shape and a word) · **Kind** (a word, its category under it) ·
   **Report** (two lines, then "reported 5 times" when repeated; the full text
   is in the detail) · **About** (the item's slug, or the route, in mono) ·
   **Severity** (a word, or none) · **Last** (the date, mono) · **Triage**
   (`aria-expanded`). Under 90px a row, as the existing spec holds
6. **List** below 52rem: the same groups as cards, status and kind first, the
   text, "reported N times", the date, Triage. Nothing scrolls sideways
7. **The detail**, opening under its row, **one at a time**:
   - the **full text** when the row cut it
   - **each report** in the group: who (name and role), when (date and time),
     the route and app version it came from in mono; a CSAT's rating in words;
     for a question report **the variant that student saw** (the stem, the
     options lettered, the parameters in mono), or the sentence that none was
     attached and so the numbers are unknown (INV-25); and **what was attached
     automatically** (`context`), key by key
   - **Triage**: *Move to* the five states (pressed buttons), *Severity* none /
     low / medium / high (pressed buttons), *Released in* (a field, shown with
     Shipped), and **Save**, which applies to **every report in the group**,
     disabled until something changed. Who triaged it last, and when
8. **Foot**: **Load older** while more match, else "That is every report this
   filter matches."

## Loading, failure, feedback (`.claude/rules/design.md`)

- First load: nothing for 400ms, then a skeleton shaped like the queue; past
  3s a sentence **at its top**
- A failed first load: a `role=alert` sentence and **Try again**
- Save: one toast, what happened to which: "3 reports moved to triaged" /
  "Report moved to shipped, released in 1.4". A refusal keeps the detail and
  its choices, says why, and its toast stays
- Export: one toast naming how many reports and the filter; a refusal says why

## Controls, and the mandate's four tests

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Status (All + five) | narrows the queue to one state | a word and its count, pressed | All | shows where the work is |
| Kind | narrows to flags, question reports or CSAT | named kinds | All kinds | separates "the platform" from "a question" |
| Triage | opens one group's reports, variants and triage | `aria-expanded`, names its report | press again | the exact instance, one click from the queue |
| Move to / Severity / Released in | stage a change | pressed state, a labelled field | pick again before Save | severity and release are the loop §4.4 closes |
| Save | changes every report in the group, audited | says how many reports it moves | triage again | one decision for one complaint, however often it was sent |
| Load older | brings the next 100 older groups | says what it does | — (only adds) | nothing ages off the queue |
| Export CSV | a file of every matching report | names the filter | — (a download) | the reports leave the platform intact |

## API

`GET /api/v1/console/feedback` — staff only. Params: `status`, `kind`
(`flag`, `content_report`, `csat`), `before` (cursor), `limit` (1-200, 100).
SUS rows are never in the queue; they are the panel.

Returns `FeedbackQueue` (`packages/contracts`): `groups[]` (key, status, kind,
category, body, severity, releasedIn, item, route, count, firstAt, lastAt,
triagedBy, triagedAt, `reports[]` with each report's reporter, role, time,
route, app version, rating, context and resolved variant), `next`, `total`
(groups and reports matching), `counts` (per status, for the current kind),
`sus` (`student` and `staff`, each `{ n, mean }`).

A **group** is reports with the same kind, item, route, status and text
(trimmed, whitespace collapsed, case folded). A report with no text is its own
group.

`GET /api/v1/console/feedback.csv` — the same filters, one line per report,
with `repeats` (its group's size), up to 50,000. Cells starting `=`, `+`, `-`,
`@`, a tab or a return are prefixed with `'` (shared with `/audit`).

`PATCH /api/v1/console/feedback` — staff only. `{ ids: uuid[1..500], status,
severity?: low|medium|high|null, releasedIn?: string|null }`: one
transaction, one `audit_log` row per report (`feedback.triage`, with the state
it left). 404, and nothing written, if any id does not exist. The single-report
`PATCH /feedback/:id` stays.

## What is deliberately not built

- **"My feedback"**: waits for the console's own flag (§4.1)
- **Filters by route, role and version**: the seed has no routes and no
  versions; status and kind are what the queue is worked by
- **A SUS trend**: SUS rows carry no release, so there is nothing to plot
- **Fuzzy dedupe** ("text similarity"): only exact repeats group; a near
  match is two rows, and grouping two different complaints would triage one
  of them unread
- **A link to the item on `/items`**: `/items` has no address for one item
  (`NEXT-SESSION.md` §0m)

## Motion (`motion.md`)

The detail eases open (`--dur-fast`); groups brought in by Load older rise in
once. Under `prefers-reduced-motion` both cut.

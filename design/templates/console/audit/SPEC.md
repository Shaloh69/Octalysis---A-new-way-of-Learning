# `/audit` — SPEC

**Who changed what, when, and why — and the evidence when a grade is challenged.**

`PAGE-SPECS.md` §/console/audit: *"Every lock override, grade adjustment, item
edit, roster change. Immutable, filterable, exportable. If a grade is ever
challenged, this is the evidence."*

References: `SOURCE.md` (shadcn-admin's Tasks for the frame and the table,
shadcn.io's Activity Feed for the sentence, day headings and Load older, its
Audit Trail for the action filter and date range, its Log Viewer for Export).
Colours and type are ours.

## What was missing — 28 Sep 2026, before the rebuild

| Planned | Found |
|---|---|
| Immutable | **Not in the database.** RLS gave staff SELECT and nobody else anything, but `audit_log` had no trigger: `service_role`, the API's own connection, or a dashboard SQL editor could UPDATE or DELETE any row. The page said *"cannot be edited or removed, by anyone"* |
| Filterable | A text box over the 300 rows the page had loaded |
| Exportable | Nothing |
| The evidence | `GET /console/audit` returned the newest 100, 500 at most, and nothing older. An October dispute's rows left the page by December |
| Readable | `content.edit` showed a block's UUID as its target; `summary.approve` showed "—" in the table and its approved text only as raw `text=…` in the timeline beside a 64-character hash; `lock.set` said "stage 06" and kept the student it was for as a UUID in the payload |

## Instructor decisions, 28 Sep 2026

| Question | Ruling |
|---|---|
| Reaching old rows | **Filters run on the server over the whole log**; 100 a page, newest first, and **Load older** (a keyset cursor) extends it. The filter is in the address, so a view can be linked as evidence |
| Export | **CSV of the filtered view, every matching row**, not only what is loaded. `GET /console/audit.csv`, same filters, staff only |
| Filters | **All four**: action family, who did it (a staff member or *system*), about whom or what (a student by name or ID, a stage, an item, an assessment), and a date range |
| Immutable | **An append-only trigger, here**: `audit_log_no_update` / `audit_log_no_delete`, refusing every role including `service_role`, like `responses` |

## Structure, top to bottom

1. **Header**: *Audit log*, one line: who changed what, when and why; entries
   are never edited or removed, and the database refuses it. On the right,
   **Export CSV** (the Tasks page's Import/Create position, the Log Viewer's
   Export)
2. **Toolbar**, one row at 1440, wrapping at 380:
   - **Search** — *About whom or what*: a student's name or ID, a stage, an
     item's slug, an assessment's title, a section, or words of the reason.
     Applied on Enter or after a pause, never per keystroke to the server
   - **Action**: a select, *All actions* or one family — Locks, Roster, Items,
     Assessments, Submissions, Content & summaries, Accounts, Feedback
   - **Who**: a select, *Anyone*, *System (scheduled)*, or each person who
     appears in the log
   - **From** and **To**: two date fields, inclusive, in the teacher's time
     zone
   - **Clear filters**, only while one is set
3. **A result line**: *Showing 100 of 1,234 entries*, mono numbers, with the
   filter in words when one is set, and the view switch (**Table** /
   **Timeline**, pressed buttons, as before) on the right
4. **Table** (default, D-4's lesson: dense first), at 52rem of the page's own
   width and up. Columns: **When** (mono date, time under it) · **Who** ·
   **What happened** (the sentence; the family is a filter and a Details field, not a second line) ·
   **Reason** (in full, wrapped, never truncated) · a **Details** disclosure.
   Details opens a row under it: every recorded field in words (the approved
   summary text as a quote, a window's from → to, a return's previous mark),
   then the raw action key, entry number, actor and target ids in mono
5. **List** below 52rem: the same entries as cards — sentence, who and when,
   the reason, Details
6. **Timeline**: the same entries under **day headings** (Activity Feed), each
   with its time, the sentence, who, the reason as a quote and every field
   inline. For reconstructing one incident in order
7. **Foot**: **Load older entries** while more match, else *"That is every
   entry this filter matches."*

## Controls, and the mandate's four tests

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Search | narrows what the teacher can see to one student, stage or phrase | labelled *About whom or what*, with its scope in the placeholder | Clear filters, or empty it | tells the teacher the log can answer "everything about Juan" |
| Action | narrows to one kind of change | named families, not keys | *All actions* | the families name what the course audits |
| Who | narrows to one person, or to the scheduler | names, and *System (scheduled)* in words | *Anyone* | shows which changes no person made |
| From / To | narrows to a period | labelled dates | clear the field | — |
| Clear filters | restores the whole log | says what it does | the filters themselves | — |
| Table / Timeline | changes how the same rows are drawn | pressed state, words | the other button | the timeline reads one incident in order |
| Details | shows every recorded field of one entry | `aria-expanded`, its entry named | press again | shows what the evidence actually holds |
| Load older | brings the next 100 older matches into view | says how many remain | — (it only adds) | the log goes back to the start of the course |
| Export CSV | a file of every match | names the filter it exports | — (a download) | the evidence leaves the platform intact |

**No control edits or removes an entry, and there must never be one.**

## API

`GET /api/v1/console/audit` — staff only.

| Param | |
|---|---|
| `family` | one of the eight families |
| `actor` | a user id, or `system` (no actor: the `pg_cron` lock windows) |
| `q` | 1-100 characters, matched against the subject's name and student ID, the target and its label, and the reason |
| `from`, `to` | ISO instants; `from` inclusive, `to` exclusive (the console sends local midnights) |
| `before` | an entry id: return entries older than it (the cursor) |
| `limit` | 1-500, default 100 |

Returns `{ entries, next, total, actors }`: `next` is the cursor for Load
older or null; `total` counts every match of the filter, cursor aside;
`actors` lists everyone in the log for the Who filter. Each entry carries
`what` (the sentence, written by the API so the page and the CSV cannot
disagree), `family`, `actor`, `subject` (the student it is about, resolved
from a lock's `userId`, a roster row, a submission's owner or a profile), the
`target` with a readable `label`, `reason`, and the raw `payload`.

`GET /api/v1/console/audit.csv` — the same filters, every match, up to 50,000
(past that, a 400 whose message says how many matched and asks for a narrower range). Columns: `at` (ISO, UTC),
`action`, `what`, `who`, `who_id`, `about`, `about_student_id`,
`target_type`, `target_id`, `target`, `reason`, `payload` (JSON). A cell
starting `=`, `+`, `-` or `@` is prefixed with `'` so a spreadsheet never
runs a reason as a formula.

## What is deliberately not built

- **No edit, no delete, no "clear".** Not a missing feature
- **No numbered pages.** A log is read newest first and extended backwards
- **Relative times** ("3 weeks ago"): evidence carries the date and time
- **Colour as meaning**: families are words; no red for a normal act

## Motion (`motion.md`)

Details eases open (`--dur-fast`, height and opacity); newly loaded older
entries rise in once. Under `prefers-reduced-motion` both cut.

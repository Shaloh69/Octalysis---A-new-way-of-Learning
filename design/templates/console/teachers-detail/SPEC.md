# `/teachers/:id` — the admin's page for one teacher (T1)

Reference: `template.png` (shadcn/ui *dashboard-01*), see `SOURCE.md`. Plan:
`docs/TEACHERS-AND-SUBJECTS-PLAN.md` §2. Not built yet. Gate:
`design/specs/console-teachers-detail.spec.ts`, screenshots opened.

**Admin only**, as `/teachers` (`requireAdmin()` on every call). `:id` is the
user id of a claimed account, or `employee:<id>` for a roster row nobody has
claimed yet (no classes or use to show; its claim status and the roster's
details only).

## What it shows

- A header: name, Employee ID (mono), email, role, status in words, last
  sign-in; **← Teachers**; **Assign class** and the `⋯` (Disable / Re-enable).
- **Four stat cards:** classes held · students in them · AI tokens this month
  (mono) · AI cost this month (mono; "No AI use yet" before the app).
- **The classes table:** section · subject · term · book (the subject's
  default, or the class's own) · students · `⋯` (Change book…, End class…).
- **AI use by month:** one chart of token totals by month and by engine,
  with a 3 months / 30 days / 7 days toggle; **totals only, never a draft,
  never a prompt** (round six, ruling 2). Until the app exists the chart is
  replaced by one line saying so.
- At 380: cards stack, the table becomes a list of class cards, the chart
  keeps its axis labels legible or falls back to the table of totals.

## The controls, and the four tests

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| ← Teachers | back to the list | named | | |
| Assign class… | a new class for this teacher | dialog names section, subject, term, book | End class | |
| `⋯` on a class → Change book… | the class reads another of the subject's books | the subject's books listed, the current marked | change it back | which book a class uses |
| `⋯` on a class → End class… | the class is ended (kept, with its date), the teacher no longer holds it | reason required, the class named | Re-open, same menu | |
| Range toggle | the chart's window | pressed state, axis dates | press another | how much AI the teacher uses |
| `⋯` → Disable… / Re-enable… | as on `/teachers` (reason, type the employee ID; never an admin) | | Re-enable | |

Every write is audited. A teacher who opens this URL gets the forbidden
screen; an admin opening an id that is not staff gets "not found".

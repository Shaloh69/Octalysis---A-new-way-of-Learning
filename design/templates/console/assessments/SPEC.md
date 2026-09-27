# `/assessments` — what was taken from the template, and what was not

Reference: `template.png` / `template-380.png` (shadcn.io's *Form With
Preview* block), with `template-multi-step.png` (the named *multi-step form*
lead) kept for the record. Captured 27 Sep 2026, see `SOURCE.md`. Rebuilt
27 Sep 2026. Before: `before-desktop-1440.png`, `before-mobile-380.png`.
Implementation: `current.png` (1440), `current-380.png` (380), and the state
shots beside them. Gate: `design/specs/console-assessment-window.spec.ts`,
extended, plus `console-teaching.spec.ts`' density and column tests.

Colours and fonts are ours, always: `packages/tokens`, three themes. Nothing
below is about colour.

## Audit: what the page owed, what it had, what it has

`PAGE-SPECS.md` §`/console/assessments`: *"Create from a blueprint, scope to a
section, set open/close window and attempts allowed, rotate `exam_salt`
between terms."* `apps/console/CLAUDE.md`: *"Creating one mints the exam salt.
The feasibility check answers 'can this blueprint be filled?' naming the
shortfall cell, before a student presses Start rather than at Start."*

| Owed | Before | Now |
|---|---|---|
| Create from a blueprint | yes, a dialog | yes, the template's form + preview |
| **Scope to a section** | **no**: the API took `sectionId`, the form never sent it | a section picker, **approved 27 Sep 2026**. And `POST /attempts` now **refuses a student of another section** (404, as RLS already shows them), also approved: before, having the id was enough |
| Open/close window, attempts allowed | yes, at create and after (`Set window`) | unchanged in what it does; rebuilt |
| **Rotate the exam salt between terms** | **absent**, in the API and on the page | `POST /console/assessments/:id/rotate-salt`, staff only, a reason required, audited without the salt, **approved 27 Sep 2026**. From the row's `⋯` menu |
| Creating one mints the salt | yes, silently | said in the preview, and each row says when its salt was set or rotated. **The salt itself is never shown**: `scan-bundle.mjs` forbids it in both bundles and the API tests forbid it in every response and audit row |
| Feasibility names the shortfall cell, before Start | only inside the create dialog | in the create form **and on every row**: the list's GET now answers "can the bank fill it?" for each assessment with the same function (`feasibilityOf`) the form uses, and a row's `⋯ → Check the bank…` names its cells |
| Every row honest about Start | **no**: ten rows said `open` in green while none could be filled (0 live items) | a Bank column, and a banner above the list when an assessment students can reach cannot be filled |
| Header and body columns agree | **no**: the header ran Window · (Set window) · Submitted, the cells Window · Submitted · Set window, so `0/0` sat under the wrong heading | one column order, from one list |
| 380 | a table scrolling sideways, cut at "AT" | a list; nothing sideways |

## Taken from the template

- **Form and preview side by side, one card, split by a rule.** The create
  dialog's left half is the fields; its right half is what the fields
  produce. At 380 they stack, fields first.
- **The preview shows the thing as its reader meets it.** Here the reader is
  a student: the title, the scope, how many questions and attempts, when it
  opens and closes, who can see it.
- **The metadata box: label left, value right, one fact per row.** Here it
  answers the question the fields cannot: *can the live bank fill this?*
  Questions needed, live items in the pool, then one row per shortfall cell,
  every number mono.
- A heading and one line of description at the top of each half.

## Not taken

- **The full-width button inside the form half.** Ours is in the dialog's
  footer, under both halves, so at 380 the bank's verdict is read **before**
  the Create button is reached, not after it.
- **Vertical centring.** The template centres its card in a full-height box
  and, at 380x900, pushes its own heading to -46px where no scroll reaches
  it. Nothing here is centred vertically; the dialog scrolls inside itself.
- **A wizard** (`template-multi-step.png`): six fields do not need steps, and
  a verdict at the last step comes after the choices it depends on.
- Decorative metadata. Every row of our box is a number a teacher acts on.

## The page

- **Header:** *Assessments*, one line on what they are, a counts line in mono
  (`10 assessments · 10 open · 0 scheduled · 0 closed`), and **New
  assessment**.
- **The bank banner:** when any assessment a student can reach (open or
  scheduled) cannot be filled, one line says how many, what a student will
  meet at Start, and links to *Items* where items are approved. Warning, not
  danger: `danger` is for destructive staff actions only.
- **At 64rem of its own width and up, a table**, `table-layout: fixed`, as
  wide as its card and never wider: Status · Assessment · Scope · Items ·
  Bank · Attempts · Section · Window · Submitted · actions. Status is a word
  (*open*, *scheduled*, *closed*), decided by the same rule the engine
  enforces (a NULL bound is no bound). The Assessment cell's second line
  carries the salt's date (*salt set 27 Sep 2026* / *salt rotated …*), or
  *no exam salt: Start will fail* when the secrets row is missing.
- **Below 64rem, a list:** one assessment per item, the same facts as lines.
- **Actions per row:** **Set window** stays on the row (the one change a
  teacher makes mid-term). A `⋯` menu holds **Check the bank…** and, after a
  separator, **Rotate exam salt…**: rare, consequential, two presses away.
- **Dialogs** are opened from state, so each returns focus to its opener
  through `onCloseAutoFocus` and a remembered element (`NEXT-SESSION.md`
  §0c.4). The menu is `components/ui/dropdown-menu.tsx`, `modal={false}`.

## Rotating the salt, stated where the teacher decides

The rotate dialog says, in this order: every attempt **started after** this
gets a paper nobody has seen; papers **already started or handed in are
unchanged**, because each stores its own seed; the salt is never shown, here
or anywhere. A reason is required and recorded. It is not styled as
destructive: nothing is lost, and nothing is undone.

## Loading, failure, feedback (`.claude/rules/design.md`)

- A skeleton shaped like the table (ten rows, ten columns; one column in the
  list) after 400ms; past 3s it says the API may be waking.
- A failed load: an alert with **Try again**, never an empty page.
- The create form's bank panel reserves its height while it checks, and the
  answer fades in when it lands.
- One toast per write, naming what happened to what: *"Stage 01 Check
  created"*, *"Window saved for Prelim Examination"*, *"Exam salt rotated for
  Stage 02 Check"*. A created assessment the bank cannot fill says so in the
  toast. A refused write keeps its dialog open with the server's sentence and
  raises an error toast that stays.

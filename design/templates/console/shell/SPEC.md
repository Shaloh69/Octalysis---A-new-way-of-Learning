# SPEC: the console shell

What `AppShell.tsx` draws around every route: sidebar, nav, account block, 380
top bar and its menu. From `template.png` (shadcn-admin's sidebar), with the
380 bar's page name from `alt-with-toggle-theme.png`. `SOURCE.md` has the
captures. Colours and fonts are ours.

Gated by `design/specs/console-shell.spec.ts`, and by every other console spec,
since every route renders inside it.

## Instructor rulings, 28 Sep 2026

- **The nav is grouped in four, by job.** *In class*: Locks, Live. *Students*:
  Students, Submissions, Gradebook. *Course*: Assessments, Items, Content.
  *Records*: Audit log, System health, Feedback. **Live moves up** beside
  Locks: they are the two pages opened mid-class. Every route is still
  offered; none is added or removed.
- **The template's layout, and only the page scrolls.** After the first
  build ("nav bar should not be this long", when the sidebar was stretched
  down a whole scrolling page), a content-height sidebar was tried and
  rejected the same day: "It looks bad just make the layout of it the same
  as the templates just make the inner page itself scrollable not the
  sidebar". So at lg and up the frame is the window: the sidebar runs the
  window's full height with the account at its foot and never moves, and
  **`<main>` is the only scroller**; the document itself does not scroll. At
  380 the sheet is full height, account at its foot, as in the template.
- **No collapse control.** At 1440 it would change nothing a teacher can see
  (main keeps 70rem; the widest route needs 66rem), and a rail of eleven
  icons is not legible. Recorded as a deliberate absence.

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legible | Reversible | Teaching |
|---|---|---|---|---|
| Eleven nav links | Opens the page | Named, grouped, current one marked (`aria-current="page"` + filled pill) | Yes (the nav is always there) | n/a, staff surface |
| Skip to content | Moves focus past the nav | Appears on focus | n/a | n/a |
| Account menu (the foot) | Opens theme + sign out | Avatar, name, email, role | Escape; focus returns to it | n/a |
| Theme (three, inside the account menu) | Changes every surface's colours; a projector wants `phosphor` | Radio items, current one checked | Pick another | n/a |
| Sign out | Ends the session, lands on `/signin`, **says so in a toast** | Separated, last in the menu | Sign in again | n/a |
| 380 menu button | Opens the sidebar as a sheet | `aria-expanded`, `aria-controls="console-nav"`, label says Open/Close | Escape, the scrim, a nav link, or the button; **focus returns to the button** | n/a |

**Not taken, on purpose:** the team switcher (one course, nothing to switch to;
a control that switches nothing fails the consequence test, so the brand block
is a plain mark and name); count badges (nothing computes them yet; *Awaiting
marking* on `/gradebook` already carries the one that matters); collapsible
groups; the collapse rail (ruling above); a header bar inside the content column
(our routes own their own titles and actions).

## Structure

**At `lg` (1024) and up:**

```
<div shell>                                   flex row
  <a skip link>
<div shell>                                   height 100vh, NOT overflow: hidden (see below)
  <aside id=console-nav data-shell>           16rem, 100vh, border-r, surface-1; never moves
    brand                                     /icon.svg mark · "OCTA" over "CPE 412 · Teacher console"
    <nav aria-label="Console sections">       flex: 1; scrolls on its own only if the window is short
      group × 4: label (xs, muted) + <ul aria-labelledby>
    account (pinned to the foot)              DropdownMenuTrigger: initials, name, email · chevrons
  <main id=main>                              100vh, overflow-y: auto, position: relative; unchanged padding
```

- **Only `<main>` scrolls.** On `/gradebook` (2285px of content) the nav and
  the account stay exactly where they are; `console-shell.spec.ts` asserts
  the document does not scroll, `<main>` does, and the account's position is
  unchanged after scrolling it to the end.
- `<main>` is `position: relative`, so every absolutely positioned
  descendant (sr-only text among them) belongs to its scroll box. Without it
  they escaped, and the DOCUMENT grew to 2223px on `/gradebook`.
- `.shell` must NOT be `overflow: hidden`. The gate's clipping check walks
  up from each element; past `<main>` (a vertical scroller, allowed) it would
  reach a clipping `.shell` and report everything below the fold as cut off.
  That failed seven routes' assertion 1 at once, and was a false alarm.
- A full-page capture at 1440 now needs a viewport as tall as `<main>`'s
  CONTENT (measure its children, not `<main>`, which is the viewport's height).
- **Width unchanged: 16rem.** `<main>`'s content box stays **70rem at 1440**,
  measured before and after on `/locks`, `/assessments`, `/submissions` and
  `/gradebook`. Those routes need 62, 64, 62 and 66rem.
- Group labels are not headings: every route owns its `<h1>`, and four `<h2>`s
  in the nav would sit above it in every page's outline. Each list is named by
  its label through `aria-labelledby`.
- Each item keeps its hint as `title`. Hover only; nothing depends on it.

**Below `lg`:**

```
<header data-shell>                           sticky top-0, surface-1, border-b
  [menu button]  current page name            "Gradebook", "Students"… or "Teacher console"
<aside id=console-nav>                        hidden until opened, then a 18rem sheet from the left
<div scrim>                                   .dialog-scrim, click closes
```

- **One sidebar, not two.** The same `<aside>` is the sheet at 380, so there is
  one `console-nav`, one navigation landmark, one account menu.
- **It traps nothing.** It is a disclosure, not a modal: Tab moves through it
  and on; leaving it with Tab closes it, without stealing focus back.
- **It closes on Escape, on the scrim, and on any route change** (a link, or
  Back), and focus returns to the menu button each time.
- `scroll-padding-top` on `<html>` below `lg` equals the bar, so a route that
  scrolls a control into view does not park it under the bar.

## States

| State | What shows |
|---|---|
| Checking access, under 400ms | Nothing. A flash is worse than a still frame (`useDelayed`) |
| Checking access, 400ms to 3s | The shell's own skeleton: the sidebar's shape (brand, eleven bars, the foot) and an empty main, `aria-busy`, with *Checking your access…* as its status |
| Checking access, past 3s | The same, plus a line in words: *Still checking. The sign-in service can take a moment to answer.* |
| Nobody signed in | `Navigate` to `/signin` (unchanged) |
| A student | `StudentAccountScreen` (unchanged; `/signin`'s) |
| Bootstrap credentials | `ChangeCredentialsScreen` (unchanged; `/signin`'s) |
| Signed out, from any of the three | `toast.success("Signed out", "<email> is no longer signed in on this browser.")`, then `/signin` |
| Sign out failed | `toast.error("Not signed out", ...)`, stays; the menu is still there to try again |

The guard's decisions are not touched. It decides what to RENDER; the security
is `requireStaff()` on every console route and RLS beneath it.

## Account block

Initials in a circle (from the name, else the email), the name (else the email)
over the email, both truncated with an ellipsis and whole in `title`. The menu
opens upward from the foot at 1440 and over the sheet at 380: a label (name,
email, role as a word: *Teacher*, *Admin*), **Theme** as three radio items,
a separator, **Sign out**.

`components/ui/dropdown-menu.tsx`, `modal={false}`, focus returned through the
remembered trigger when an item closes it (§0d.6).

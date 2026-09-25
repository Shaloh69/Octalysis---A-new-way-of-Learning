# `/signin`: what was taken from the template, and what was not

Reference: `template.png` (shadcn-admin `/sign-in-2`, captured 25 Sep 2026, see
`SOURCE.md`). Implementation: `current.png` (1440), `current-380.png` (380).
Gate: `design/specs/console-gate.spec.ts` (the sign-in and the student-account
screen) and `design/specs/console-bootstrap-credentials.spec.ts` (the forced
credential change).

Colours and fonts are ours, always: `packages/tokens`, three themes. Nothing
below is about colour.

## What this route's contract is, and where it comes from

**`PAGE-SPECS.md` has no row for `/signin`.** Nothing new was invented to fill
that gap. The contract is:

1. `CONSOLE-REVAMP.md` §3: *the first thing anyone sees, with the forced
   credential change behind it*.
2. `console-gate.spec.ts`: an anonymous visitor to any guarded route lands
   here; a student account is told why and given two ways out; the server
   refuses both regardless of what this page renders.
3. `console-bootstrap-credentials.spec.ts`: an account on its bootstrap
   password is blocked on one screen with no way past, only a way out.
4. `DESIGN-REFERENCES.md` §7: signing in is the machine booting (POST), with
   one generic failure message for every cause.

So `/signin` is three screens sharing one frame, `GateFrame`:

| Screen | Who sees it | Rendered by |
|---|---|---|
| **Sign in** | nobody signed in | `pages/SignInPage.tsx`, at `/signin` |
| **This is the teacher console** | a student account | `pages/GateScreens.tsx`, from `AppShell` |
| **Change your email and password** (and **Credentials changed**) | a staff account still on its bootstrap credentials | `pages/GateScreens.tsx`, from `AppShell` |

The last two render at whatever guarded URL was requested, because the guard
is in `AppShell`. They were bare `max-w-md` columns with none of the sign-in
page's frame. They are the same gate, so they now wear the same frame.

## Why the page was rebuilt, not fixed

### The red run, 25 Sep 2026

The extended specs were run against the old page before any of it changed:
**10 failed, 41 passed, 5 skipped** (the same five per width).

Stated plainly, because it matters for what the rebuild did and did not fix:
**on the sign-in page itself the six gate assertions were already green.**
It clipped nothing, did not scroll sideways, was keyboard-reachable, held AA on
all three themes and rendered only tokens. It was not broken in the way
`/items` was. What went red was everything the gate does not cover on its own:

| Red | Per width |
|---|---|
| Credential screen, assertion 6: the positive control. **That screen had no motion at all**, not even the readout the sign-in page had | 1440, 380 |
| Split at 1440, form first at 380: the page was one centred card | 1440, 380 |
| No link to the student app: *"Students sign in on the student app"* was plain text | 1440, 380 |
| No toaster on `/signin`: it was mounted inside `AppShell` | 1440, 380 |
| No show-password control | 1440, 380 |

And seen in the old screenshots, not asserted by anything:

- The notched corner was a `clip-path` on a bordered box, so **the border was
  cut away along both diagonals** and the frame read as broken.
- The readout's `AUTH` line said `WAITING` before, during and after a failed
  sign-in. The POST metaphor's one job, *"halts loudly on a failure"*, was
  not done.
- The student screen and the credential screen were bare columns with none of
  the gate's frame.

And in the code: a network failure or a rate limit printed *"That email and
password did not match an account"*. A teacher whose password was right would
retype it forever. Fixed in `lib/session.ts`, unit-tested.

### Found by looking at the rebuild

The first rebuild put the caption under the readout frame, on the backdrop. **A
bus trace ran straight through it**, like a strikethrough, at 1440 and at 380.
Every spec was green: the contrast assertion walks an element's *ancestors* for
its background, and the backdrop is a sibling. The caption now lives inside the
frame, on its opaque surface, and `console-gate.spec.ts` holds it with **"no text
sits on a bus trace"**, which went red on that build before the fix.

## Structure taken from the template

| Template | Here | Why |
|---|---|---|
| Split at desktop: form in the left half, a panel in the right half | Same. Left: the form on `surface-0`. Right: the POST readout on `surface-1` over the shared bus backdrop, contained to that half | The form is never competing with the backdrop for contrast; the readout gets space instead of being squeezed into the form card |
| One column at 380, the right half gone | One column at 380, form first, **the readout below it** rather than gone | `DESIGN-REFERENCES.md` §7.3: *"380px. The panel is a single column below 560px, and the sequence is the same."* The readout is kept but moved below the fold so the form is what the phone shows first |
| Brand mark and name above the form | The OCTA mark (inline SVG in `currentColor`, the icon's own rings-around-a-core grammar), **OCTA**, "Teacher console" | A `<p>`, not a heading: the page has one `h1` and it is the task |
| `Sign in` heading, one line of description | `h1` "Sign in" in display type, then who it is for | |
| Email, Password, **show-password button inside the field** | Same, the toggle is a real `<button>` with `aria-pressed` and a label that says what it will do | Passes all four tests in `DESIGN-MANDATE.md` §1: it changes what the teacher can see, is legible, reversible, and saves a mistyped password |
| Full-width primary button with an icon | Same, `LogIn` icon, the word changes to "Checking…" while it runs | |
| A small-print footer under the form | Three sentences: no sign-up, **"Forgot your password?"** leading to `/forgot-password`, and a **link** to the student app for a student who came to the wrong door | Sign-up and the student link replace template controls that would be dead ends here (below) |
| *(not in the template)* | A `SERVER` line in the readout: `WAKING`, `ONLINE` or `NO ANSWER`, and past 3s a `role="status"` sentence | **The API is woken on arrival** (below) |

## Deliberately NOT copied

- **"Or continue with" GitHub / Facebook.** Staff accounts are email and
  password, created by an administrator. There is no OAuth provider
  configured and none is planned.
- **"Don't have an account? Sign Up".** There is no sign-up, by design: a
  staff account can read every answer key. The footer says so in words.
- ~~**"Forgot password?"**~~ **Now copied, 25 Sep 2026.** The first rebuild
  left it out because there was nowhere for it to go, and brought the missing
  reset to the instructor rather than building it unasked. **The instructor
  approved it the same day**, so the link is back as "Forgot your password?",
  in the footer rather than beside the password label (the template's place),
  so that Tab from the email field still lands on the password. It leads to
  `/forgot-password` and `/reset-password`, each with its own folder beside
  this one.
- **Terms of Service / Privacy Policy.** Neither page exists.
- **The product screenshot in the right half.** Replaced by the POST readout,
  which is this project's own auth vocabulary (§7), plus one real sentence:
  past this screen the teacher can read every answer key, and every change a
  student can see is written to the audit log with their name.

## The API is woken on arrival — approved 25 Sep 2026

Render's free tier sleeps and takes ~50s to wake, and signing in goes to
Supabase, **not** to the API. So without this, a teacher signs in in ten
seconds and then sits on `/locks` waiting for a server nobody asked to start.

`/signin` and `/reset-password` (both end on `/locks`) call `wakeApi()`
(`lib/api.ts`) on arrival: one `GET /healthz` per page load, which touches no
database and needs no token. It never blocks the form. The readout's `SERVER`
line reports it. Under 3s nothing else is said. Past 3s a `role="status"` line
says the server is starting up and to carry on. If it never answers, a line
says so and that signing in still works. `console-gate.spec.ts` holds all
three states, with `/healthz` intercepted: slow, refused, fast.

## The failure state, which the template does not have

- One line, POST style: a `FAULT` tag and the sentence, `role="alert"`,
  directly under the fields and above the button that caused it.
- **It does not vanish.** It stays through typing and is replaced only by
  the next attempt. A message that clears on the first keystroke takes the
  reason with it.
- The readout's `AUTH` line reads `FAULT` and `CONSOLE` reads `HALTED`. That
  is decoration (`aria-hidden`); the alert is what is announced.
- **Three sentences, never four** (`lib/session.ts` `signInFailureMessage`,
  unit-tested):
  1. any 4xx from the auth server: *"That email and password did not match
     an account."* Unknown address, wrong password, disabled account all
     print this, because anything else is an enumeration oracle on the app
     that holds the answer keys.
  2. 429: too many attempts, wait a minute. The limit is per client, not per
     account, so saying so reveals nothing about who exists.
  3. no answer, or a 5xx: the sign-in service did not answer, **so what you
     typed was not checked**.
  A build without its Supabase variables says that instead, and it is what
  a local stack shows, since locally there is no Supabase Auth.
- Past 3 seconds of "Checking…", a `role="status"` line says the service is
  slow to answer rather than letting the button spin in silence.

## Toasts: moved to the app root

**Decision, 25 Sep 2026: `<Toaster />` is mounted once in `App.tsx`, outside
`<Routes>`, instead of inside `AppShell`.** It is `position: fixed`, so where
it sits in the tree changes nothing about where it paints. What it changes is
which screens can raise one: `/signin`, the student screen and the credential
screen all render outside the shell's layout, and a successful sign-in
navigates away from the page that raised the toast, so a shell-scoped toaster
would have been unmounted with it. `console-items.spec.ts`'s toast tests
re-ran green after the move.

Used here for exactly one thing: **"Signed in as <email>"**, raised on success
and read on the page it lands on. A failure is inline, not a toast: it
belongs next to the field that caused it, and a toast in the bottom-right
corner is the one place a person looking at a password field will not look.

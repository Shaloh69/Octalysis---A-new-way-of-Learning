# `/reset-password`: what was taken from the template, and what was not

**A new page, approved by the instructor on 25 Sep 2026**, with
`/forgot-password`, whose `SPEC.md` holds the contract, the deployment
prerequisites and why the pair exists. This is where the link in a reset email
lands.

Reference: `template.png` (shadcn-admin `/sign-up`, see `SOURCE.md`).
Implementation: `current.png` / `current-380.png` (the new-password form, both
hints showing), `current-no-link.png`, `current-expired-380.png`. Gate:
`design/specs/console-password-reset.spec.ts`.

## Three states, decided by the address

`recoveryLinkState` (`lib/session.ts`, unit-tested) reads the address once, on
the first render:

| The address carries | The page shows |
|---|---|
| `#…type=recovery` (implicit flow) or `?code=` (PKCE) | **Set a new password**: the form |
| `#error=…` (a used or expired link) | **This link has expired**, with **Send a new link** and **Back to sign in** |
| nothing | **No reset link here**, with the same two ways out, and **no password field at all** |

**There is no password form without a link.** A signed-in session is not
permission to change a password without knowing the old one, and this page
must not become that back door.

A recovery link shows the form **without verifying the link first**. A bogus
one is refused at submit (`LINK_EXPIRED`), which gives its holder nothing they
did not already have. It also means the form is reachable, and gated, on a
local stack that has no Supabase Auth.

Once supabase-js has read the link (`primeRecovery`), the page **takes it off
the address bar** (`history.replaceState`), so the recovery token is not left
in history or in a screenshot of the tab.

## Structure taken from the template

| Template | Here | Why |
|---|---|---|
| Password, then Confirm Password, then one action | **New password**, **Confirm new password**, **Set new password** | The fields and hints are `NewPasswordFields`, shared with the forced credential change, under one rule (`lib/password.ts`: 12 characters, confirmed). Two copies of the rule would drift into accepting different passwords |
| Hints | *At least 12 characters*; *These do not match*, as words under the field, only once something is typed | Never colour alone |

## Deliberately NOT copied

- **Email field.** A reset changes the password only; the caption says so.
  Changing the address is the credential screen's job.
- **Show-password toggles.** Both fields are new-password entries confirmed
  against each other; the confirmation does the job the toggle does on
  `/signin`. The credential screen, which shares these fields, has none either.
- **OAuth, Terms, Privacy, "Already have an account?"**: none of them apply.

## After it succeeds

`toast.success("Password changed for <email>")`, raised here and read on
`/locks`, where the page navigates. The recovery session is a real session, so
the teacher is signed in. A bootstrap account still meets the forced credential
change there (`forgot-password/SPEC.md`).

This page also **wakes the API** (`/signin`'s `SPEC.md` explains why): a reset
ends on `/locks`, which needs it.

## Failures

`passwordUpdateFailureMessage` (unit-tested):

| Case | Message |
|---|---|
| same password | "That is already your password" |
| weak password | too weak |
| no or bad recovery session | `LINK_EXPIRED`, plus a **Send a new link** button right below |
| 429 | too many attempts |
| no answer / 5xx | not changed: the service did not answer |

Each message is a `FAULT` line that stays until the next attempt.

**Never seen succeed.** The success path needs a real recovery email, so it
must be looked at on the deployment.

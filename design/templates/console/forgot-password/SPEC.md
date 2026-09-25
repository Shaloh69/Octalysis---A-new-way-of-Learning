# `/forgot-password`: what was taken from the template, and what was not

**A new page, approved by the instructor on 25 Sep 2026.** The `/signin`
rebuild left "Forgot password?" out because there was nowhere for it to go, and
brought the missing reset to the instructor instead of building it. The
instructor said yes. Before this, a forgotten staff password meant the Supabase
dashboard or re-running `bootstrap-admin.mjs`.

Reference: `template.png` (shadcn-admin `/forgot-password`, see `SOURCE.md`).
Implementation: `current.png` (1440), `current-380.png` (380),
`current-fault.png` (a request that could not be sent). Gate:
`design/specs/console-password-reset.spec.ts`, shared with `/reset-password`.

Colours and fonts are ours: `packages/tokens`, three themes.

## The contract

`PAGE-SPECS.md` has no row for it. Root `CLAUDE.md` listed `/forgot-password`
and `/reset-password` as absent under "public and auth". This is the
**console's** pair: staff accounts, email and password. The student app signs
in by ID number and has no reset of its own; that is not built here.

1. Ask for a reset link by email address.
2. **Never reveal whether an account exists.**
3. Say plainly when a request could not be sent, and why.
4. Lead back to `/signin`.

## Structure taken from the template

| Template | Here | Why |
|---|---|---|
| Centred card | The gate's split frame, the task left and the POST readout right, one column at 380 | This page is part of `/signin`'s gate and must look like it; `GateFrame` is that frame |
| "Forgot Password" heading, one line of description | `h1` "Reset your password"; the description is **conditional**: *"If an account exists for it, we will send a link"* | Contract 2. The template's *"Enter your registered email"* implies the page knows which addresses are registered |
| Email, one full-width action | Email, **Send reset link** with a `Mail` icon, disabled until the field holds an `@` | The action is named for what it does. "Continue" names nothing |
| A line under the card | "Remembered it? **Back to sign in**" | |

## Deliberately NOT copied

- **"Don't have an account? Sign up."** There is no sign-up. Staff accounts are
  created by an administrator, as `/signin` says.
- **A success that says "sent".** After a request the form is replaced by a
  `role="status"` panel: *"If an account exists for <address>, a reset link is
  on its way"*, plus a note to check spam and a **Send it again** button. An
  unknown address gets exactly this too.

## Failures: three, and none of them about accounts

`resetRequestFailureMessage` (`lib/session.ts`, unit-tested) returns `null`,
meaning *say it was sent*, for every 4xx that is not about the request itself.
Only these are reported, each in a `FAULT` line that stays until the next
attempt:

- too many reset emails requested (429, or Supabase's
  `over_email_send_rate_limit`)
- not an email address (`email_address_invalid` / `validation_failed`)
- the service did not answer, so **nothing was sent**

A build without its Supabase variables says that instead, which is all a local
stack can show.

## What the deployment needs before this works — not verifiable locally

1. **Supabase → Auth → URL Configuration → Redirect URLs** must list
   `https://<console-domain>/reset-password`. If it does not, Supabase sends the
   link to the Site URL instead, which is the student app.
2. **Email delivery.** Supabase's built-in sender is heavily rate-limited, and
   on current projects it may deliver only to the project's own team members.
   Check the project's Auth email settings. A teacher who is not on the Supabase
   team may need custom SMTP before a reset can reach them.
3. **A reset does not clear the bootstrap flag.** The flag lives in
   `app_metadata`, which only the service role writes. A bootstrap account
   that resets its password by email still meets the forced credential change
   on its next sign-in. That is intended: the bootstrap email address is known
   as well as the password.

**Never seen succeed.** The success panel and a real email have not been
observed: locally there is no Supabase Auth. Look at both on the deployment
before calling this verified.

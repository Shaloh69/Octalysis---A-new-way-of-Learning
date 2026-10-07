# `/claim` (console) — a teacher claims their employee ID (T1)

Reference: `template.png` (shadcn-admin *Sign up*), see `SOURCE.md`. Plan:
`docs/TEACHERS-AND-SUBJECTS-PLAN.md` §2. Not built yet. Gate:
`design/specs/console-claim.spec.ts`, screenshots opened.

A public page beside `/signin` (no session needed), linked from it: "First
time? Claim your teacher account". It creates the account the admin put on
the teacher roster, with the role the ROSTER names, never one from the form.

## What it shows

The card: "Claim your teacher account", one line ("Your employee ID is on
the roster the admin imported."), a link back to **Sign in**; the fields
**Employee ID** (mono), **Full name as on the roster**, **Email**,
**Password**, **Confirm password** (show toggles); **Claim account**.

## The controls, and the four tests

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| The five fields | what the claim submits | labelled, errors beside the field, the password rule stated before typing | edit before submitting | |
| Show password | reveals the typed password | the toggle names its state | press again | |
| Claim account | creates the account and signs in to the console | one pending state, then the console | an admin can disable it | |
| Sign in link | goes to `/signin` | named | | |

**One generic error** for an unknown employee ID, an ID already claimed, a
disabled row and a name that does not match (`services/api/CLAUDE.md`: no
enumeration): "That employee ID could not be used. Check it with your
admin." Rate limited (5 a minute per IP). A local stack has no Supabase
admin client: the page says claiming is unavailable there, as `/signin`'s
credential change does.

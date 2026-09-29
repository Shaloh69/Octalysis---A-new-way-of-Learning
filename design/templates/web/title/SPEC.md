# The title screen — `/login`, `/register`, `/maintenance`, 404 — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §8 row 10): first contact. Template:
`template.png` (`SOURCE.md`). Component: `apps/web/src/components/TitleScreen.tsx`.
Gate: `design/specs/web-title.spec.ts` (and `r3-gate.spec.ts`).

## Realm

The star system, signed out: `data-realm="star"`, no biome. The still CSS star
field; no WebGL before sign-in.

## Layout

The menu (left: the screen's destinations, the current one lit and
`aria-current="page"`), the panel under it (the screen's one task, its caption
the page's h1), the OCTA mark across a ring (centre, decorative), the card
(top-right: what this is, or what happened), the foot line (course, school).
Under 1100px: the mark, the menu and panel, the card, stacked.

| Route | Menu | Panel (h1) | Card |
|---|---|---|---|
| `/login` | Sign in · Claim your account | Sign in: Student ID (mono), Password, one generic fault line | Welcome aboard |
| `/register` | the same | Claim your account: ID, email, password (10+ checked in the browser), confirm | Before you start (the roster rule) |
| `/maintenance` | Sign in | Back shortly | Systems halted: your data Safe, the service Restarting |
| 404 | The star map · Sign in | There is nothing at this address; Back to the map | Lost in space |

## Carried over, unchanged

One failure message for every sign-in failure (no enumeration oracle);
nothing about the roster decided in the browser; the form live from the first
paint. `BootPanel` and `Backdrop` are deleted (replaced by `TitleScreen`).

## Controls and the four tests

The menu links and the forms' submit buttons each change what the student can
do (sign in, claim, go to the map); each is named by verb and object;
reversible by the menu. Nothing decorative is a control.

## Captures (opened, 30 Sep 2026, build at 5185)

`current-login`, `current-register`, `current-maintenance`, `current-nowhere`
(the 404), each at 1440 and `-380`.

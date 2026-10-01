# The arrival screen, SPEC

Instructor, 2 Oct 2026: "after the warp is a custom loading screen for each of
the planet biomes or moons, with unique fun facts about its planet, like
Entering a Blue Gas Giant". R3.4. Template: `template.png`, Starfield's loading
screen (`SOURCE.md`). Gate: `design/specs/web-arrival.spec.ts`; the facts:
`apps/web/test/world.spec.ts`.

## When it shows

Only after **travel** from the star system into a planet or moon: the realm
changing star → biome (`RealmWarp` marks it, `lib/arrival.ts`; under reduced
motion there is no warp but the student still travelled). **Never** on a deep
link or a reload (nothing was travelled), **never over a paper** (a `/check`
route, or while `useSitting()`; hard rule 9). It clears itself after
`--dur-arrival` (6s), or at once on any key (which only dismisses: "l" does not
also leave the planet), a click, or Continue. The page beneath loads all along.

## What it looks like (instructor, 2 Oct 2026, after the first captures)

"The background should be its biome design", and "remove the planet, make it
seamless". So there is **no globe and no veil**: the planet's own biome art
fills the screen, and the caption (the planet's sprite panel) sits over its
ground, at the bottom as in the template; on a phone at the top, because a
phone's biome keeps its landscape in the lower third. While it shows, the
shell's bars and the page are hidden over that same biome
(`.biome-shell:has(> .arrival)`); on dismiss the caption fades out as they
fade in, and the background never changes. The first build (a globe drawn
from the map's texture over a 62%, then 90% veil) is in this folder's history.

## What it says

- **Entering · the world**: the words for the globe the map drew for this
  planet ("a banded gas giant", "a blue-green ocean world") or moon ("a grey
  cratered moon"). One function decides both (`solar-system/world.ts`), so the
  map and the arrival cannot disagree.
- **The frost line decides the world** (instructor, 1 Oct 2026, R4.7): a
  planet whose ring is inside L2/L3 is rocky, beyond it a gas or ice giant;
  stage 01, the spoke across every level, is the home world. Seeded per
  student, never random.
- **The facts**, two kinds only (hard rule 5): the instructor's brief **word
  for word** (`docs/source/solar-system-brief.md`: the kind of world, the frost
  line, rings, the asteroid belt, moons, the Hill sphere), and the planet's
  **own data** (its title, moons counted, levels named, grading period; a
  moon's objective and its planet). No two planets read the same (tested over
  all 19). Labels such as "Beyond the frost line" are ours; the words after
  them are the source's.

## What it owes

| Rule | Held by |
|---|---|
| Never over an assessment | the `/check` guard and `useSitting()`; a paper sits behind its own Start |
| Never invents | `world.spec.ts`: every brief fact found in the file; the data facts built from the record |
| Reads nothing it does not show | its data hooks run only while it shows (`ArrivalView`) |
| Keyboard | Continue is a button; any key dismisses without firing a shortcut beneath |
| AA in all seven biomes | the caption is the planet's sprite panel; computed |
| Seamless | no veil and no globe: the screen's background is transparent over the biome; the bars and page are hidden while it shows and back after (asserted) |
| Tokens only | computed |

## Captures (2 Oct 2026, build at 5185, reduced motion; all opened)

`current` (06, ocean biome: a banded gas giant), `current-rocky` (05, desert:
inside the frost line), `current-home` (01, jungle: the spoke), `current-moon`
(01.2, cave); each at 1440 and `-380`, recaptured after the instructor's
"biome, no planet" ruling and again after the phone caption moved to the top.
Reproduce with `OCTA_CAPTURE=1`.

**Found by a probe, not a spec:** the build's CSS minifier writes `6000ms` as
`6s`, and reading the number alone cleared the screen after 6ms. Durations are
now read with their unit (`tokenMs`). **Found by looking:** on a phone the
caption covered the biome's ground and left only sky; it sits at the top there.

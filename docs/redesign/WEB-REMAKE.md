# WEB-REMAKE.md
### The student app, remade as a game — a star-system HUD outside, the planet's biome inside

**Instructor ruling, 30 Sep 2026.** The design of the whole student app is too
bland. It is **remade, not improved**: new templates taken from game UI, a
different nav bar, and every page rebuilt. Two further rules came with it:

> Every time a student opens a planet or a moon, the theme changes: the nav bar
> and the designs follow that planet's biome, always. The default look applies
> while we are in the star system. Moving from the star system into a biome is
> always a transition.

This document owns that remake. It sits under R3 (page templates and redesign)
and opens no new phase.

---

## 0. What this supersedes, and what still binds

**Superseded:**

- `WEB-REVAMP.md`'s visual direction and its §6 route order. Its §2 feature list,
  §3 (the sidebar, moons, ENTER JOURNEY, asteroids, summaries) and §4 (Kepler's
  third law) **still stand**: they say what the pages do, and this document says
  what they look like and in what order they are rebuilt.
- **The look of the three routes rebuilt on 29-30 Sep** (`/app/stage/:id/check`,
  `/app/stage/:id`, `/app/map`). Their behaviour, data, instructor rulings and
  specs carry over. Each is the requirements document for its own remake, the
  way every old page has been. R3's boxes for them are reopened as remake boxes.

**Still binding, unchanged:** the eight hard rules; tokens as the only source of
colour, type, space and motion (a literal hex outside `packages/tokens` is
blocked); AA computed on every colour set that can appear; keyboard-only
operation; 380 with no sideways scroll; `prefers-reduced-motion` cuts, never
slows; the accent marks the student's own place and never a state or a lock; a
lock's reason is the server's, verbatim; no client lock, no client score,
nothing gradeable in `localStorage`; the allowed libraries stay lazy-loaded per
route; the six-assertion gate, one route per session, and screenshots opened and
looked at.

**The instructor's rulings of 30 Sep 2026**, asked and answered:

1. **A stage check: the chrome wears the biome, the paper stays neutral.** §4
2. **The default is one game HUD with three variants.** The student's bare-metal,
   blueprint or phosphor choice and the seeded accent survive as its colour
   variants, so Settings still does something. §2
3. **The style: a sci-fi HUD in the star system, pixel frames per biome inside a
   planet**, matching the pixel-art biome packs already shipped. §2, §3
4. **Type: add one game face for HUD labels.** Inter stays for reading and
   JetBrains Mono for every number; the new face is for nav labels, titles and
   HUD captions only, never body text and never a number. §6

**The references:** `design/templates/web/_direction/` (SOURCE.md there). They are
direction; each route still captures its own `template.png`.

---

## 1. Two realms, decided in one place

| Realm | Routes | Look |
|---|---|---|
| **The star system** (default) | `/app`, `/app/map`, `/app/stages`, `/app/progress`, `/app/work`, `/app/settings`; and, outside the session, `/login`, `/register`, `/maintenance`, the 404 as the title screen | The **sci-fi HUD** (§2), over the solar system, in the student's variant and accent |
| **Inside a planet or moon** | `/app/stage/:id` and everything under it: the reading, the check, results, labs, and the moon journeys when they exist | **That planet's biome** (§3): the page background, the frames, **and the nav** |

- **The realm is decided once, from the route**, in the shell (`useRealm()`),
  and written to `<html>` as `data-realm="star"` or `data-realm="biome"` with
  `data-biome="<name>"`. No page decides its own. A deep link or reload into a
  planet paints its biome on the first frame; nothing flashes the HUD first.
- **One biome per planet, seeded from student and stage** (`WEB-REVAMP.md` §3.5,
  ruled 25 Sep). Deterministic, cosmetic only, never touching a lock, a ring or a
  grade. **A moon wears its planet's biome.** Today one biome is seeded per
  student (`cosmetic-seed.ts`, `biomeIndex`): making it per stage is the
  foundation session's work (§8), through `/api/v1/cosmetics`, with tests.
- **The map's planet sidebar is a window into that planet**: it wears the
  planet's biome while the page around it stays in the star system (§3.5).
- **Inside a planet the base variant steps aside.** The biome's own token set
  holds the page; the student's variant returns on leaving. The accent (the
  student's seeded hue) persists in both realms, with its lightness and chroma
  fixed per colour set so AA holds for every hue.

---

## 2. The star system: a sci-fi HUD

From `_direction/star/`: Starfield's system map, skill screen, character hub,
inventory and HUD, and No Man's Sky's discoveries list.

- **The nav is a tab strip** (Starfield's skill screen, No Man's Sky's top nav):
  Map · Stages · Progress · Your work · Settings, in the HUD face, the current
  one lit with a rule under it, **← and → controls either side** that step to
  the previous and next tab. It is navigation: real links with `aria-current`,
  every one reachable by Tab. At 380 it may become a bottom bar of the same five,
  never a sideways scroller; the shell session decides and records it
- **A mission tracker**, top-left on every star route (Starfield's MISSION
  STATUS): the stage `lib/next-stage.ts` chooses and its next step, in words,
  with one control to go there. It replaces the "pick up where you left off"
  card as a HUD element
- **A key-hint bar**, bottom-right at 1440 (Starfield's): each hint is a real
  keyboard shortcut and a real button that does the same thing (Esc Back, M Map,
  and the route's own). A hint that does nothing fails the mandate's consequence
  test and is deleted. Hidden at 380, where there are no keys
- **Panels**: thin-rule frames with corner brackets, a caption bar in the HUD
  face, **stat tables** (label left, value right, the value in mono), and
  **meters that print their number** (SURVEY 33% is how mastery reads)
- **The Register Bar stays the signature element**, restyled as the ship's
  readout strip (`.claude/rules/design.md`)
- **The background is the solar system** on every star route (the map's own
  scene or its still star field), never a biome (`BIOME-AND-LOADING-SPEC.md`
  §1b)
- **Locks read as Starfield's ranks do**: the padlock beside the words, never
  instead of them

## 3. Inside a planet: the biome, in pixel frames

From `_direction/biome/`: Stardew Valley's skill page, journal, quest and letter,
and the CC0 art in `_direction/assets/`.

- **The same nav component, in the biome's dress** (Stardew's icon tabs attached
  to the frame's top edge, the current one raised). **Proposed, for the shell
  session to confirm with the instructor:** inside a planet its items are the
  planet's own (Reading · Moons · Check, and Labs when they exist) plus **Leave
  planet**, which returns to the star system with this planet selected; the star
  destinations are one step away through it
- **Nine-slice pixel frames** for every panel, title tabs shaped like Stardew's
  scroll, list rows as framed buttons with badges in words (NEW, DONE, LOCKED),
  and the reading on a **parchment-like surface** (Stardew's letter) with the
  biome around it
- **Frames are art, so they live with the tokens.** Kenney's CC0 Pixel UI Pack is
  the source; the frames, tabs and buttons are vendored into `packages/tokens`
  (nothing else may hold a colour literal) and recoloured per biome, or drawn in
  CSS from the biome's tokens: the foundation session chooses and records why
- **Each biome is a complete token set** (surfaces, ink, lines, the accent's
  lightness and chroma), the way the eight encounter themes are four tokens and
  a nine-slice panel. **Legibility is not negotiable:** text sits on a token
  surface over the art, AA computed for every biome and every accent hue, and a
  biome that cannot hold AA gets a stronger scrim, never an exemption

## 4. A stage check: the chrome is the planet's, the paper is everyone's

**Instructor ruling, 30 Sep 2026.** The check happens inside the planet, so the
nav, the frame and the background keep the planet's biome and the student never
feels they left. **The paper does not change:** the question card, its options,
Record answer, Submit and every verdict sit on **one neutral surface, identical
for every student**, with no biome art under or inside it.

This **amends** `DESIGN-MANDATE.md` §1B rule 1 and `BIOME-AND-LOADING-SPEC.md`
§1b's fairness line from "no theatre anywhere on an assessment" to "theatre may
dress the chrome of an assessment, never the paper". The purpose is unchanged:
two students with different biomes, comparing screens, see the same exercise.
The runner's spec proves it by rendering one paper as two students with
different biomes and asserting the paper's computed styles are identical.

## 5. Transitions: always, both ways

**Star → biome** (entering a planet or moon: Enter journey, a stage link, the
mission tracker): the star field recedes, §4.1's warp streaks, **the realm
switches at the warp's peak** (the token swap happens under full cover, so no
frame mixes two themes), the biome resolves, the frame and nav settle in, the
content mounts. `BIOME-AND-LOADING-SPEC.md` §4.1-§4.2 already name this
sequence; the remake makes it the only way in.

**Biome → star** (Leave planet, Back): the reverse. The content leaves, the biome
dissolves into stars, the HUD returns, and the map opens with the planet
selected and its sidebar open (`WEB-REVAMP.md` §3.3).

- **Planet → moon** (same biome): no realm change; a short in-biome move
- **A deep link or reload** into a planet: no warp, because nothing was
  travelled; the biome is there from the first paint
- **`prefers-reduced-motion`: a cut.** The realm switches in one frame; no warp,
  no dissolve. `QA_MODE=1` freezes every ambient loop
- **Motion is never the only signal:** the nav's words change with the realm
  ("Stage 06 · External Memory", "Leave planet")
- **Budget:** the Bring-Up is still the one orchestrated moment per stage. Realm
  transitions are navigation, which `.claude/rules/design.md` requires to carry a
  transition both ways; each route's `motion.md` records its own

## 6. Type

| Role | Face | Where |
|---|---|---|
| **HUD label** (new, ruled 30 Sep) | one game face from Google Fonts, chosen in the foundation session from captured specimens: **Chakra Petch**, **Oxanium** and **Pixelify Sans** are the candidates | nav labels, titles, panel captions, key hints, badges. **Never body text, never a number**, never below 12px |
| Body | Inter | everything read as prose |
| Mono | JetBrains Mono | **every number**, register value, id, percentage and listing: "what the machine sees", unchanged |

Space Grotesk, today's display face, is retired in `apps/web` if the HUD face
takes the display role; the foundation session decides and updates
`.claude/rules/design.md` and `packages/tokens` in the same commit. The console
keeps its type.

## 7. Every page, every session

Each route is one session, gated exactly as before (root `CLAUDE.md`), and now
also owes:

- its `template.png` captured from a real game screen, starting from the one
  §8 names; if a better real screen exists, capture that and record why
- a `SPEC.md` listing its controls against the mandate's four tests, and **its
  realm**
- `design/specs/web-<route>.spec.ts`: the six gate assertions at 1440 and 380,
  what the plan owes, and **the realm's own assertions**: `data-realm` and
  `data-biome` are right on first paint; a star route never shows a biome; a
  planet route's nav and frame wear its planet's biome; contrast computed on
  every colour set the route can show (three variants in the star system, every
  biome inside a planet); the transition in and out recorded, and a cut under
  reduced motion
- `current*.png` at 1440 and 380, in every variant or biome that applies, all
  opened

## 8. Order

| # | Session | Template to start from | What it owes |
|---|---|---|---|
| 1 | **The look system** (no route) | `_direction/` entire | The HUD token set and its three variants; one token set per biome (seven); the HUD face; the pixel frames (Kenney CC0) and how they are coloured; **per-planet biome seeding** through `/api/v1/cosmetics` (API tests first); `useRealm()`; a computed AA test in `packages/tokens` over every colour set × a sweep of accent hues; a look sheet rendered and captured at 1440 and 380 |
| 2 | **The shell**: nav (both dresses), mission tracker, key-hint bar, Register Bar, the realm switch and both transitions | `starfield-skill-tree-2`, `no-mans-sky-discoveries`, `starfield-hud`, `stardew-valley-skill-level` | Also clears the shell defects `NEXT-SESSION.md` §0p.1-5, §0q.1 and §0r.2 carry. The instructor confirms the in-planet nav (§3) |
| 3 | `/app`, the 3D map | `starfield-map` | `WEB-REVAMP.md` §3.1-§3.3 (selection, ~700ms zoom, the sidebar as the planet's window) and §4 (Kepler). Moons and asteroids with it or as the next session, the instructor's call |
| 4 | `/app/map`, the flat map | `starfield-map` | The 30 Sep behaviour and `web-map.spec.ts` carried; the look redone in the HUD |
| 5 | `/app/stage/:id`, the reader | `stardew-valley-letter`, `stardew-valley-journal` | The reading in the planet's biome; the 29 Sep rulings carried |
| 6 | `/app/stage/:id/check`, the runner | `stardew-valley-quest` for the chrome | Biome chrome, **neutral paper** (§4); the 29 Sep rulings carried |
| 7 | `/app/stages` | `no-mans-sky-discoveries` | Acts as systems, stages as planets, state as an icon and a word |
| 8 | `/app/progress` | `starfield-character-menu-2` | Depth and the 21 competency cells as labelled meters |
| 9 | `/app/work` | `starfield-inventory-2` | Submissions (40% of the grade) as a list with a detail card; §0g.4's return |
| 10 | `/app/settings` | the HUD's own panels | The variant picker now changes the HUD's variant |
| 11 | `/login`, `/register`, `/maintenance`, the 404 | a title screen, captured in session | First contact |
| 12 | Moons, their journeys, the act-1 minigames (R4) | `starfield-map-3`, `stardew-valley-quest` | `WEB-REVAMP.md` §3.2, §3.6, §3.7 |

**No route starts until the previous one's spec is green.** The console is not in
this remake.

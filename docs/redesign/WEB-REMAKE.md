# WEB-REMAKE.md
### The student app, remade as a game — one star-system HUD outside, the planet's biome inside

**Two instructor rulings, both 30 Sep 2026.** The first (morning) ruled the
student app too bland and ordered it remade as a game. The second (evening),
after the look system was built and captured, ruled that it **still looks bad**
and ordered **every aspect reworked**: change it, or remove it and make it new.
This document holds both, with the second winning wherever they differ. It sits
under R3 and opens no new phase.

> Every time a student opens a planet or a moon, the theme changes: the nav bar
> and the designs follow that planet's biome, always. The default look applies
> while we are in the star system. Moving from the star system into a biome is
> always a transition. *(ruling 1)*
>
> Stick to the themes, changing only between the star system and the biomes.
> Use sprites for the nav bars, side bars and buttons in the biomes. Remove the
> 2D map altogether and use only the 3D one. Make it work on the phone. Revamp
> the map from the star system you found. Rework every aspect. *(ruling 2)*

---

## 0. The rulings, in one list

Asked and answered on 30 Sep 2026:

1. **Two looks and only two.** One star-system HUD for everyone, and one look per
   biome. **The student variants (bare-metal, blueprint, phosphor) are removed**
   from the student app: nothing a student chooses changes the theme. The seeded
   accent hue stays, marking the student's own place. (The console keeps its three
   themes; this is apps/web only.)
2. **Inside a biome, the chrome is sprites.** The nav bar, the side bars and every
   button are Kenney's CC0 pixel sprites (`packages/tokens/pixel/`), recoloured by
   choosing a sprite per biome, never by filter. Text still sits on token surfaces.
3. **The 2D map is removed.** `/app/map`, `FlatMap` and the flat galaxy are deleted;
   `/app/map` redirects to `/app`. **The 3D map is the only map, and it carries an
   accessible layer**: every planet is also a real, focusable button (the SYSTEM
   panel's row of bodies, Starfield's own pattern), and the side panel is real DOM,
   so keyboard and screen-reader students can use the map fully. Reduced motion
   freezes the orbits and cuts the camera. A device without WebGL keeps the whole
   accessible layer and a one-line notice; only the picture is missing.
4. **It works on the phone.** The 3D map runs at 380 in portrait: the canvas fills
   the screen, the panels become a top strip and a bottom sheet, and touch selects.
5. **The map is Starfield's system map** (`_direction/star/starfield-map.png`):
   the solar system in the middle, a SYSTEM panel and a BODY panel on the left, a
   key-hint bar bottom right.
6. **The Register Bar and the Depth Gauge are reworked, not removed.** The
   registers become the HUD's readout strip in the star system and a sprite bar in
   a biome; depth becomes a meter in the mission panel. Same information, new form.
7. **A check's paper is one neutral set, identical for every student.** With the
   variants gone, "follows the variant" (the morning's answer) has nothing to
   follow: the paper is `[data-paper]`, the same colours for all.
8. **All of it now, gated per piece.** The rework runs in one session, in §8's
   order; each piece is captured at 1440 and 380, spec-green, committed and pushed
   before the next. This amends "one route per session" for this rework only.

**Still binding, unchanged:** the eight hard rules; tokens as the only source of
colour, type, space and motion; AA computed on every colour set; keyboard-only
operation; 380 with no sideways scroll; `prefers-reduced-motion` cuts, never
slows; the accent never marks a state or a lock; a lock's reason is the server's,
verbatim; no client lock, no client score, nothing gradeable in `localStorage`;
the allowed libraries lazy-loaded per route; screenshots opened and looked at.

## 1. Two realms, decided in one place

| Realm | Routes | Look |
|---|---|---|
| **The star system** | `/app` (the 3D map), `/app/stages`, `/app/progress`, `/app/work`, `/app/settings`; and `/login`, `/register`, `/maintenance`, the 404 | **The HUD** (§2), one set, `[data-realm="star"]` |
| **Inside a planet or moon** | `/app/stage/:id` and everything under it | **That planet's biome** (§3), `[data-realm="biome"][data-biome=…]`: nav, side bars, buttons and page |

- `useRealm()` (`apps/web/src/lib/realm.ts`) decides the realm from the route and
  writes `data-realm` / `data-biome` on `<html>`; `index.html` paints them before
  the first frame. No page decides its own.
- **One biome per planet**, seeded from student and stage (`planetBiomes` from
  `/api/v1/cosmetics`); a moon wears its planet's. Cosmetic only.
- `data-theme` is **not set** in apps/web any more. Every token a student page
  reads comes from its realm's set in `packages/tokens/looks.css`.

## 2. The star system: the HUD

From `_direction/star/`: Starfield's system map, skill screen, character hub,
inventory and HUD, and No Man's Sky's discoveries list.

- **The nav**: a tab strip (Map · Stages · Progress · Your work · Settings) in the
  HUD face, the current one lit with a rule under it, ← and → either side stepping
  to the previous and next tab. At 380 it is a **bottom bar** of the same five.
- **The mission panel**, top-left: the stage `lib/next-stage.ts` chooses and its
  next step, in words, one control to go there, and the **depth meter** (L0-L6)
- **The key-hint bar**, bottom-right at 1440: every hint is a real shortcut and a
  real button. Hidden at 380
- **The readout strip**: the registers (PC, IR, MAR, MBR, ACC) as a thin HUD strip
- **Panels**: a hairline frame with corner brackets, a lit caption bar, stat
  tables, meters that print their number, badges in words
- **The background**: the 3D system on `/app`; a still CSS star field elsewhere
  (cheap on a phone, no second WebGL context)
- **Locks** read as Starfield's ranks: the padlock beside the words, never instead

## 3. Inside a planet: the biome, in sprites

From `_direction/biome/`: Stardew Valley's skill page, journal, quest and letter.

- **The nav bar is a sprite bar** across the top: the planet's name, its tabs
  (Reading · Check, Moons when they exist) as sprite buttons, the current one
  pressed, and **Leave planet** at the end
- **The side bar is a sprite panel**: the reading's contents, or the check's
  question list
- **Every button is a sprite button**, with the pressed sprite on `:active`
- **The reading sits on a parchment surface** inside a sprite frame; the biome's
  art fills the page behind it
- **Legibility is not negotiable**: the sprite draws the frame, never the fill;
  a token ring inside it carries the edge; AA is computed on every biome

## 4. A stage check: the chrome is the planet's, the paper is everyone's

The nav, the side bar and the background keep the planet's biome. **The paper**
(the question card, its options, Record answer, Submit and every verdict) **sits
on one neutral set, identical for every student** (`[data-paper]`). The runner's
spec renders one paper as two students with different biomes and asserts the
paper's computed styles are identical.

## 5. Transitions: always, both ways

**Star → biome**: the star field streaks (§4.1's warp), the realm switches at the
peak under full cover, the biome resolves, the chrome settles. **Biome → star**:
the reverse, landing on the map with the planet selected. A deep link has no warp.
**`prefers-reduced-motion`: a cut.** Motion is never the only signal: the nav's
words change with the realm.

## 6. Type

| Role | Face | Where |
|---|---|---|
| HUD label and display | **Oxanium** | nav labels, titles, captions, key hints, badges. Never body text, never a number, never below 12px |
| Body | Inter | prose |
| Mono | JetBrains Mono | every number |

All self-hosted (`packages/tokens/fonts.css`). Space Grotesk is retired in apps/web.

## 7. Every piece, every time

Each piece owes: a `template.png` from a real game screen (the `_direction/`
image named for it, captured into its folder), a `SPEC.md` (controls against the
mandate's four tests, and its realm), `design/specs/web-<piece>.spec.ts` (the six
gate assertions at 1440 and 380, AA on the realm's set or on all seven biomes,
the realm's own assertions), and `current*.png`, every one opened.

## 8. Order (this session, ruling 2)

| # | Piece | Template | Notes |
|---|---|---|---|
| 1 | **The look system** | `_direction/` | Done 30 Sep (morning); reworked by ruling 2: one star set, sprite classes for bars and buttons, the neutral paper |
| 2 | **The shell** | `starfield-skill-tree-2`, `starfield-hud`, `stardew-valley-skill-level` | Both navs, mission panel with depth, key hints, readout strip; shell defects §0p.1-5, §0q.1, §0r.2 |
| 3 | **`/app`, the 3D map** | `starfield-map` | SYSTEM and BODY panels, the accessible row of bodies, selection and zoom, Kepler, per-planet tint, the phone. **`/app/map` and the flat map deleted** |
| 4 | `/app/stage/:id`, the reader | `stardew-valley-letter`, `stardew-valley-journal` | Sprite nav and side bar, parchment |
| 5 | `/app/stage/:id/check`, the runner | `stardew-valley-quest` | Sprite chrome, neutral paper |
| 6 | `/app/stages` | `no-mans-sky-discoveries` | Acts as systems, stages as planets |
| 7 | `/app/progress` | `starfield-character-menu-2` | Depth and the 21 cells as labelled meters |
| 8 | `/app/work` | `starfield-inventory-2` | List and detail card |
| 9 | `/app/settings` | the HUD's panels | The accent; no theme picker |
| 10 | `/login`, `/register`, `/maintenance`, 404 | a title screen | First contact |
| 11 | Cleanup | — | Delete the dead code and CSS; the whole suite |

The console is not in this remake.

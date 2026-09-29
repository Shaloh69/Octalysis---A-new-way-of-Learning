# The look system — what the remake is dressed in

`WEB-REMAKE.md` §8 #1, built 30 Sep 2026. No route was rebuilt: this is the
vocabulary every remade route is written in. The shell session (§8 #2) is the
first to wear it.

**Where it lives:** `packages/tokens/looks.css` (the ten colour sets and the
frames), `packages/tokens/fonts.css` (the three faces), `packages/tokens/pixel/`
(the vendored frames), `packages/tokens/test/looks.spec.ts` (the proof).
**What it looks like:** `design/look/` (the look sheet) and its captures in
`design/look/captures/`, every one opened.

---

## 1. The instructor's four choices, 30 Sep 2026

Each was asked with captures to look at, and a recommendation.

| Question | Chosen | The capture it was chosen from | Recommended? |
|---|---|---|---|
| The HUD label face | **Oxanium** | `faces-hud-bare-metal-*.png`, `faces-biome-desert-*.png` (Chakra Petch, Oxanium, Pixelify Sans, and Space Grotesk for comparison, in our own nav words) | Yes |
| The biome's pixel frames | **Kenney's Pixel UI Pack, vendored** | `frames-desert-*.png`, `frames-cave-*.png` (A: drawn in CSS from tokens; B: the Kenney sprite) | **No**: CSS was recommended. §3 says how the sprites were made safe |
| Space Grotesk in apps/web | **Retired**: the HUD face takes the display role | the same face captures | Yes |
| A stage check's paper | **Follows the student's variant** (bare-metal, blueprint or phosphor); never the biome | none needed | Yes |

## 2. Type

| Role | Face | File | Where |
|---|---|---|---|
| HUD label | **Oxanium**, variable 200-800 | `fonts/oxanium-latin-wght-normal.woff2`, 14 KB | nav labels, titles, panel captions, key hints, badges. `--font-hud`. **Never body text, never a number** (a caption's "04" is wrapped in mono: see every capture), never below 12px (`--text-hud-min`) |
| Display | Oxanium | the same | `looks.css` sets `--font-display: var(--font-hud)` under `[data-realm]`, which only apps/web sets. **The console keeps Space Grotesk** |
| Body | Inter, variable | 48 KB | prose |
| Mono | JetBrains Mono, variable | 40 KB | every number |

**Self-hosted, not Google Fonts** (`packages/tokens/README.md`: a lecture hall
on campus wifi should not wait on fonts.google.com; a third origin is one more
thing down during a check). Latin subsets, `font-display: swap`, OFL-1.1 with
each licence beside its file. **Measured before:** apps/web loaded no font file
at all, so every face came from whatever the machine had installed. Since this
session apps/web imports `fonts.css`, and the build ships the three woff2 files
(102 KB). The capture script checks `document.fonts` on every shot: all three
loaded, every time (`captures/fonts.json`).

## 3. Frames

**The star system: `.frame-hud`.** A hairline rule (`--frame`) with bright
corner brackets (`--frame-corner`), drawn with eight gradient strokes. The
caption bar (`--caption-bg` / `--caption-ink`) is Starfield's lit title bar.

**Inside a planet: `.frame-pixel` and `.frame-pixel-button`.** Kenney's CC0 Pixel
UI Pack, one sprite per biome and its pressed twin, as `border-image`:

| Biome | Sprite (pack path) | Pressed |
|---|---|---|
| neutral | `9-Slice/Ancient/grey` | `grey_pressed` |
| jungle | `9-Slice/Colored/green` | `green_pressed` |
| desert | `9-Slice/Ancient/brown` | `brown_pressed` |
| arctic | `9-Slice/Outline/blue` | `blue_pressed` (first choice `space` has no pressed state; its `space_inlay` is a 44×44 inlay, which the sprite test caught) |
| city | `9-Slice/Colored/yellow` | `yellow_pressed` |
| cave | `9-Slice/Ancient/white` | `white_pressed` |
| ocean | `9-Slice/Colored/blue` | `blue_pressed` |

How vendored art was made to hold the rules it cannot see:

- **The sprite draws the frame, never the fill.** No `fill` in the
  `border-image`, so every word sits on the biome's `--surface-1`. The frame
  comparison filled the panel with the sprite, and the cave's light ink went
  illegible on the tan paint (`frames-cave-1440.png`, panel B).
- **A token ring inside every sprite.** One `--px` of `--frame-inner`, checked by
  the AA sweep against every surface. Needed: jungle's lime band measured about
  **1.6:1** against its own leaf paper, so without the ring a panel's edge
  vanishes from the inside.
- **Whole pixels.** The sprite's 6-pixel frame is drawn at `--px` per pixel (3px
  on a wide screen, 2px at 640 and under), `round` so the rivets tile, pixelated.
  A button or tab draws the same six pixels in 4 `--px` instead of 6: at a
  panel's 18px a 44px button had 8px left for its label and clipped it.
- **Tested as art.** `looks.spec.ts` decodes each PNG (`test/png.ts`, no
  dependency): 48 by 48, and every pixel of the 6-pixel band opaque, so no scene
  shows through a frame. Every `url()` resolves; the Kenney licence travels in
  `pixel/`.

## 4. The ten colour sets

Every set declares the SAME names every page already reads (`--surface-0..3`,
`--ink`, `--ink-muted`, `--ink-faint`, `--line`, `--line-strong`, the accent
family, `--success/danger/warning/info/locked` and their `-bg`, the register
cast) plus the game register's `--frame`, `--frame-corner`, `--frame-shade`,
`--frame-light`, `--frame-edge`, `--frame-inner`, `--caption-bg/ink`,
`--lit-bg/ink` and `--meter-track/fill`. So a page is written once and is right
in both realms; nothing branches on the realm to choose a colour.

**The AA sweep** (`packages/tokens/test/looks.spec.ts`): 40 pairs per set, each
text pair at 4.5:1 and each non-text pair (control edges, frame edges, the
meter, the focus ring) at 3:1, for the seeded accent swept **0-359 in steps of
15**. 178 computed checks per set, **1,780 in all**. It was **watched failing
first**: 12 of 22 red on its first run (the HUD sets had no register cast; the
pixel frame's dark outline against a dark panel read 1.07-1.21:1; the light
biomes' accent read 4.38-4.48:1 at hues 180-210; the dark biomes' outline on a
dark ground read 1.05-1.08:1). Each pair was fixed at its cause, not waived.

| Set | Selector | Look | Text floor (worst text pair, any hue) |
|---|---|---|---|
| HUD · bare-metal | `[data-realm="star"][data-theme="bare-metal"]` | Starfield's navy-black, steel-blue caption, light lit tab | **5.59:1** |
| HUD · blueprint | `…[data-theme="blueprint"]` | an engineering drawing: pale ground, navy captions and lit tab | **5.02:1** |
| HUD · phosphor | `…[data-theme="phosphor"]` | a green CRT, high contrast | **6.23:1** |
| Biome · neutral | `[data-realm="biome"][data-biome="neutral"]` | light stone paper, slate | **4.78:1** |
| Biome · jungle | `…[data-biome="jungle"]` | leaf-green paper, deep moss | **4.84:1** |
| Biome · desert | `…[data-biome="desert"]` | Stardew's parchment, dark brown ink | **4.76:1** |
| Biome · arctic | `…[data-biome="arctic"]` | ice paper, navy ink | **4.97:1** |
| Biome · city | `…[data-biome="city"]` | night violet, amber neon lit rows | **6.08:1** |
| Biome · cave | `…[data-biome="cave"]` | amethyst dark, lavender lit rows | **6.08:1** |
| Biome · ocean | `…[data-biome="ocean"]` | deep-sea navy, aqua lit rows | **6.08:1** |

Four light parchments and three dark sets, so the seven read as seven places
before a sprite loads.

**The accent** keeps its lightness and chroma fixed per set: L 0.76 C 0.14
(bare-metal), 0.47/0.14 (blueprint), 0.82/0.11 (phosphor), **0.42/0.13 on the
light biomes** (0.44 failed at the cyans), 0.80/0.12 on the dark biomes. It
marks the student's own place ("You are here") and **never a state**: every
state is a word and a glyph (DONE ✓, NEW ✳, LOCKED + padlock), so no set makes a
state depend on colour alone.

**In a biome, no text sits on the art.** Every word is inside a frame on a token
surface (`BIOME-AND-LOADING-SPEC.md` §1b). `faces-biome-desert-380.png` shows
what happens otherwise: the key hints on the bare scene are unreadable.

## 5. The realm, and the per-planet biome

- `<html data-realm="star|biome">` and, inside a planet, `data-biome`, decided by
  `realmFor(pathname, planetBiomes)` in `apps/web/src/lib/realm.ts` (pure,
  `test/realm.spec.ts`, 48 cases) and applied by `useRealm()` from one
  `RealmSync` at the app root. **A star route carries no `data-biome`.**
- **The first frame:** an inline script in `apps/web/index.html` sets both before
  any bundle runs, from the path and a cached copy of the per-planet biomes
  (`localStorage` `octa:planet-biomes`, cosmetic only, cleared on sign-out). The
  realm test runs that exact script against the same route table. A spec records
  `<html>` at the first animation frame of a reload into a planet: right realm,
  right biome. **One known gap:** the first-ever deep link on a browser, before
  any cosmetics response was cached, paints `neutral` until the response lands.
- **One biome per planet:** `GET /api/v1/cosmetics` now returns `planetBiomes`,
  one per stage the caller can see, `derivePlanetBiome(studentId, stageId)` from
  the same digest as every other cosmetic; a moon wears its planet's
  (`planetOf`, `packages/contracts`). The seeded student 232129006's act 1:
  **00 city, 01 cave, 02 jungle, 03 desert, 04 ocean.**

## 6. Using it (for the shell and every route after)

- Import `@octa/tokens/looks.css` after `tokens.css`. **Not imported yet** in
  apps/web, on purpose: it recolours every page at once, and the current runner
  would put its paper on the biome's parchment against the ruling. The shell
  session imports it and adopts the frames.
- A panel: `.frame-hud` in the star system, `.frame-pixel` inside a planet. A
  button or a tab inside a planet: `.frame-pixel-button`. A caption:
  `.caption-hud`, or the tokens directly.
- **The paper in a check follows the variant:** put `data-theme="<the student's
  variant>"` on the paper's root element. tokens.css's `[data-theme]` block then
  re-declares the base theme's surfaces there, over the biome's, so the paper is
  identical for every student with that variant whatever their biome.
- The look sheet is `design/look/index.html?realm=star&theme=blueprint` or
  `?realm=biome&biome=cave&hue=200`; `node --experimental-strip-types
  design/look/capture.mts` recaptures all twenty.

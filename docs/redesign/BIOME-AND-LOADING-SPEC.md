# BIOME-AND-LOADING-SPEC.md — Per-Student Landing Biomes, and the Two Loading Screens
### Extends `SOLAR-SYSTEM-SPEC.md` §3 (per-student cosmetic seeding). A biome is a cosmetic layer, same boundary as everything else in that section: it wraps a planet or moon's landing scene, it never touches the exam, the blueprint, or grading.

---

## 1. What a biome is, precisely

A biome is a seeded environmental backdrop a student "lands in" when entering
a stage or opening a moon's detail. Same content underneath, same encounter
theme underneath (`GAME-DESIGN.md` §9, untouched, still content-honest and
per-stage) — the biome is the scenery around it, seeded per-student from the
same seed that already drives the avatar and the solar-system cosmetics.

**Example:** Student A and Student B both reach Stage 09 (Number Systems).
Both get the **Pixel** encounter theme for the actual bit-toggle exercise —
that's locked, per-stage, identical for everyone, because pixel art is
honestly what a grid of bits looks like. But the *landing scene* around it —
what's visible in the moment before the exercise loads and behind its edges
— is jungle-canopy silhouette for Student A, dune/heat-haze for Student B.
Different mood, same lesson, same difficulty, same grade.

## 2. Build approach — real parallax art is the default, procedural is the fallback

**Revised: this section previously said "procedural first, real assets as an
upgrade." That's backwards for this specific case, and worth being explicit
about why, since it's easy to over-apply the encounter-theme precedent here.**
`GAME-DESIGN.md` §9's "no asset packs" rule exists because the *encounter*
themes need to look content-honest (a switchboard has to look like a
switchboard) and four tokens plus a gradient genuinely achieves that. A
biome's entire job is different: it's there specifically so "jungle" and
"desert" read as unmistakably different environments at a glance, which is
the reason biomes exist in this redesign at all. A flat procedural gradient
in two different hues does not deliver that — it delivers a tinted rectangle,
which is close to indistinguishable from just picking a different accent
colour, and defeats the actual point.

**So: for the seven biomes below, use the real sourced CC0 parallax art as
the default landing scene. Fall back to a procedural treatment only where —
like volcanic below — no clean, verifiably-licensed pack exists yet, not as
a blanket default everywhere.**

Bundle-weight discipline still applies, just differently than a pure-CSS
approach would need: **lazy-load only the one biome a given student is
actually seeded into, per stage, on demand — never bundle all seven.** A
parallax pack is a handful of PNGs, not a texture-heavy 3D asset; loaded one
biome at a time, this stays well inside reasonable page-weight norms. Verify
the actual per-biome weight once sourced and keep it visible in
`docs/PROGRESS.md`, the same way `SOLAR-SYSTEM-SPEC.md` §5 tracks the 3D
chunk's budget — don't let this be the one asset category nobody measures.

**Seven biomes**, each with a real, checked source — expanded from the
original two on request, and each one specifically verified to have a
genuinely free-to-use option, not just "itch.io has some":

| Biome | Source | License | Note |
|---|---|---|---|
| General nature/background elements (base layer for several biomes) | Kenney **Background Elements** (110 assets) — https://kenney.nl/assets/background-elements | CC0 | Same supplier already credited on `/about` for audio — zero new attribution burden |
| **Jungle** | **Free Pixel Art Forest** (edermunizz) — https://edermunizz.itch.io/free-pixel-art-forest | **NOT CC0. Verified on the page, 1 Sep 2026:** *"You can use this asset even commercially, just give proper credit. You CANNOT use in NFT or crypto games, on any kind of crypto thing."* **Credit is REQUIRED**, unlike every other pack here | 1 background, **9 layers**, PSD + PNG. A licence `.txt` ships in the download; read it too |
| **Desert** | **Desert Parallax Background** (styloo) — https://styloo.itch.io/desert-parallax-background | CC0 1.0, explicit | Multiple resolutions provided, 4 layers |
| **Arctic / snow** | **Parallax Backgrounds: Snowy Mountains** (Admurin) — https://admurin.itch.io/parallax-backgrounds-snowy-mountains | **NOT CC0 — do not file it as such.** Verified on the page itself, 1 Sep 2026, verbatim: *"You can use this asset in any game project, personal or commercial"* · *"DO NOT resell or redistribute AS A GAME ASSET, it has to be part of a project"* · *"Credit not necessary but appreciated, if you do you can link to my ITCH profile"* · *"Modify to suit your needs"* · *"You are NOT allowed to turn any of my assets to an NFT."* · *"You are NOT allowed to use these assets to train AI."* | Embedding it in OCTA is "part of a project" and is fine. **5 transparent PNG layers, 384×216.** This licence text must be tracked in the pack's own manifest and in `CREDITS.md` — it is not interchangeable with CC0 |
| **Volcanic** | Browse https://itch.io/game-assets/tag-backgrounds/tag-volcano | Check per file | No single standout free pack found — this is the one biome that stays procedural for now (lava-glow gradient, warm high-contrast palette) until a properly-licensed pack turns up, per the fallback rule in §2 above |
| **Cave / underground** | **Find a different pack. Not Admurin's.** Browse https://itch.io/game-assets/new-and-popular/free/tag-parallax and search "cave", then verify whatever you land on the same direct way | **DO NOT USE Admurin's "Parallax Backgrounds: Caves"** (https://admurin.itch.io/parallax-backgrounds-caves). Read its comment thread, 1 Sep 2026: a user pointed at the **same art on DeviantArt** (https://www.deviantart.com/admurin/art/Parallax-Backgrounds-Caves-943909344) *"mentioned as licensed under CC 3.0"*, asked directly which licence governs and whether they could keep using it, and the author replied only *"the license is indicated in the respective section. You don't have to credit me unless you want to. Only thing that cannot be done is sell the asset."* **That does not resolve the conflict** — it restates the itch terms without addressing the CC 3.0 upload of the same work. Asked directly, never answered | This is the worked example of why a tag listing is not a licence. Two sources, two licences, author declined to reconcile them |
| **Ocean / underwater** | **Underwater Fantasy Pixel Art Environment** (ansimuz) — https://ansimuz.itch.io/underwater-fantasy-pixel-art-environment | **Not stated as CC0; permissive.** Verified on the page, 1 Sep 2026, verbatim: *"You may use these assets in personal or commercial projects. You may modify these assets to suit your needs. Credit is not required but appreciated it."* No NFT or AI clause on this one | **3 layers** for parallax. The cleanest terms of the four checked, but still record it as its own licence rather than as CC0 |

**The volcanic and cave rows above are the honest ones, not the polished
ones on purpose.** Not every biome has a clean, obviously-CC0 pack waiting —
sometimes the right answer is "this one stays procedural for now, keep
looking for a real asset later" (volcanic), and sometimes it's "the first
result everyone finds isn't actually clearly licensed, don't ship it anyway"
(cave). That's the same rigor `GAME-DESIGN.md` §9 already applies before
vendoring anything — it's just being applied in the *opposite* default
direction here, real art first, procedural as the named exception, not the
starting position.

Whichever path is chosen, every biome variant goes through the same contrast
pipeline as the base themes and encounter themes — a biome that fails WCAG AA
against its own foreground text does not ship, same rule, same CI check,
extended rather than duplicated.

## 2a. What was actually vendored, 2 September 2026

The table above is the sourcing research. This is the outcome, and it differs
from it in two places — both recorded rather than quietly substituted.

| Biome | Vendored | Why not the pack above |
|---|---|---|
| `neutral` | Kenney Background Elements, CC0 | — it is the pack above |
| `desert` | Kenney Background Elements, CC0 | **styloo's pack now 404s.** Checked 2 Sep 2026. A licence verified against a page that no longer exists cannot be re-verified by anyone |
| `jungle` | Kenney Background Elements, CC0 | edermunizz's terms are fine but **require credit** — a standing obligation on every future edit of `CREDITS.md`. CC0 carries none. That pack is still the better art if someone wants the denser look |
| `volcanic` | procedural | as specified — no cleanly-licensed pack found |
| `arctic` | **Admurin Snowy Mountains** — not CC0, terms verbatim in the pack dir | vendored 2 Sep 2026 via a driven browser session, exactly as §1b predicted would be needed |
| `ocean` | **ansimuz Underwater Fantasy** — permissive, terms verbatim in the pack dir | same |
| `cave` | **JonathanPalmerGD / PWL, CC0** — from **OpenGameArt, not itch.io** | see below: the obvious itch replacement failed the same test Admurin's did |

**Neither substitution lowered the standard.** CC0 is at least as permissive as
what either replaced pack offered, and the pack's own `License.txt` travels with
the art in every biome directory.

**These are elements, not pre-cut strips**, so each biome is composed in its own
manifest — which is exactly what the table above means by calling Kenney the
"base layer for several biomes". Three biomes cost **23 KB of art in total**.

### Cave: why it came from OpenGameArt, and what that fixes

§2's instruction was *"Find a different pack. Not Admurin's"* — because the same
art sits on DeviantArt under CC 3.0 while itch states different terms, and the
author declined to reconcile them when asked directly.

**The obvious replacement failed identically.** ansimuz's *Warped Caves* is a
good pack by an author already vendored here, but its page carries **no licence
statement from the author at all**. The CC-BY-3.0 that surfaces in a search is
in a **user comment**, by someone who is not the author, in a seven-year-old
thread. Same shape, same rejection.

**OpenGameArt records the licence as structured metadata on the work**, not as
prose in a description or a claim in a comment. That is the whole difference: it
can be read, cited and re-verified by anyone, later, without interpreting a
conversation. Two independent confirmations for this pack — the entry's
`License(s)` field, and the pack's own bundled readme.

**A CC-BY-SA candidate was rejected on licence, not looks.** *2d Backgrounds for
platformer game. Dungeons and Cave* is arguably better art, but ShareAlike adds
a copyleft obligation chain; CC0 adds none, and for a thesis deliverable the
safer licence wins a close call.

**Prefer OpenGameArt for anything licence-critical.** itch.io is better for
finding art and worse for proving you may use it.

**Downscaled 800px → 400px** (377 KB → 156 KB, 59% smaller), which CC0 expressly
permits. The band draws at ~148px, so 800 was five times oversized.

**A square source in a 4:1 band needs `scale` above 1.** At `auto 100%` an
800×800 seamless tile repeats four times across the band and every detail
disappears — it read as abstract blobs. At 2.2 it shows fewer, larger repeats
and reads as stalactites over a floor. `.biome-strip` therefore honours
`--biome-scale` rather than hard-coding `100%`.

### A second composition note: measure the alpha, not the filename

Arctic's six numbered layers rendered as grey mush when stacked. The alpha
channel explained it in one measurement:

    0.png  100.0% opaque   the complete background — sky, mountains, pines
    1.png    5.1%          sparse overlay
    2.png   16.8%          "
    3.png   26.4%          "
    4.png   52.1%          "
    5.png  100.0% opaque   ANOTHER complete background

`5.png` drawn last covered everything. It is an alternative background, not a
foreground, and it is not vendored at all rather than shipped unused.

**"Parallax" in a pack title does not promise transparency.** Measure the alpha
coverage before assuming a numbered set is a compositable stack — one command,
and it turns an inexplicable render into an obvious one.

This is also why `kind: "strip"` exists. Pre-cut scene layers must not get the
renderer's aerial perspective: the depth is painted in, and fading the back
layer washes out a sky the artist balanced. Loose elements (Kenney) need exactly
the opposite.

### A composition note that cost a rebuild

The first jungle used three sprites that are all ~130px wide and similarly round
(aspects 1.78–2.15). At similar scales they tiled at nearly the same interval, so
the band read as **wallpaper** — one identical egg-shaped tree stamped across it.
That is the exact failure `neutral.ts` already warned about, reproduced by
choosing sprites without looking at their dimensions.

What breaks a repeat is the **rendered tile width differing between layers**,
because layers whose intervals share no common rhythm drift in and out of phase:

    tree05  129px x 0.30 ~=  39px   far, reads as texture
    tree01  128px x 0.58 ~=  74px   mid
    tree03  136px x 0.95 ~= 129px   near, and the tallest silhouette

39 / 74 / 129 — no two close. **Measure the sprites before choosing scales.**

---

## 2b. The tiling problem — real, partly solved, and not solved by this pass

Found while vendoring the first pack, and it applies to every pack in the table
above, so it belongs here rather than in a commit message.

**These packs ship individual ELEMENTS, not pre-cut full-width strips.** Kenney
Background Elements is 65 separate PNGs — one tree, one cloud, one tuft of
grass. Admurin's and ansimuz's are closer to layer strips (5 and 3 layers
respectively) and will behave better, but edermunizz's 9-layer forest is again
composed pieces.

**Naive tiling reads as wallpaper.** The first `neutral` composition set one
tree as a `repeat-x` background at one size. The result was an identical trunk
every 100px — unmistakably a repeating pattern rather than a treeline. It
passed every check: the art was real, CC0, correctly licensed, correctly
lazy-loaded, and contrast-clean. It just did not look like a place.

**The interim fix, which is what ships today:** more layers, at different
depths, with different sprites and sizes — `neutral` uses two different trees
at 0.42 and 0.6 scale plus two cloud layers — with opacity scaled by depth for
aerial perspective. Because the layers tile at different intervals they drift
in and out of phase across the band, which breaks the obvious repeat. It now
reads as a forest with depth, which clears §2's bar: jungle and desert will be
unmistakably different environments.

**What would actually solve it, and is deferred:** generating one wide strip
PNG per layer at build time, placing sprites at randomised (but seeded, so it
is reproducible) intervals and sizes. That is real image-processing work — it
needs a compositing dependency this repo does not have, and a build step, and
its own weight budget. **It is not solved by this pass and should not be
described as solved.** Anyone picking this up should read the `neutral`
manifest first: the layer/depth/scale/align model already there is the input
such a generator would consume.

## 3. Seeding — via the cosmetic endpoint, not the exam engine

Per `SOLAR-SYSTEM-SPEC.md` §3 (corrected after R0's security check — read
that section, not the earlier draft if you have it cached): the biome index
comes from the same **new, read-only cosmetic endpoint** as the orbit
rotation offset, palette variant, and callsign — derived from `student_id`
via a lightweight, non-secret hash, **never** from
`services/api/src/engine/seed.ts`'s exam-attempt seed, which embeds
`EXAM_SALT_SECRET` and must never be reimplemented or exposed client-side.
Pick a biome index from the set in §2 above — **7 to start** (jungle,
desert, arctic, volcanic, cave, ocean, plus the general Kenney nature layer
as a neutral default/fallback biome for the rotation). Expand further only
if a biome earns its place the way `GAME-DESIGN.md` §9 already required of
the encounter themes — don't ship a dozen for the sake of variety alone.

Applies at two scales:
- **Per planet** — the backdrop when entering a stage
- **Per moon** — a smaller version of the same backdrop behind a moon's
  detail popover, same biome as the parent planet (a moon doesn't get its own
  independent biome roll — it inherits the planet's, since it's the same
  landing, just zoomed to one objective)

## 4. The two loading screens — different triggers, different content

> **Revised for the full-page backdrop.** Both were written when the solar
> system was a panel on `/app`. It is now the app's background
> (`SOLAR-SYSTEM-SPEC.md` §1.5), which changes what a loading screen *is* here:
> not a thing that covers the page, but **a state the background already on
> screen moves through.** Neither is built yet; build them this way.
>
> **NEITHER IS IMPLEMENTED as of R3.** They are specified, sourced, and absent.
> Recorded plainly so nobody reads this section as describing the app.

### 4.1 Hub loading — warp speed

**Trigger:** any loading state that happens *at the hub level* — first
arrival at `/app`, navigating between distant regions of the map, anything
where the student isn't heading toward a specific stage yet.

**What it looks like:** a starfield warp effect — stars streak outward from
center as the camera's field of view widens, the classic hyperspace look.

| Source | Link | What it gives you |
|---|---|---|
| **Three.js Starfield Warp** (fwdtools) | https://fwdtools.com/ui-snippets/three-starfield-warp/ | The actual mechanism: perspective-divided star positions (X/Y divided by remaining Z) produce the streak; widening FOV at the same time produces the bowed, stretched look. Recycled particle pool (2,600 stars, never reallocated) — this is the performance-conscious version |
| **drei `<Stars>`** | Already in the locked stack, `SKILL-TREE-3D.md` §5.1 | Reuse the *same* background star field already planned — animate its camera z-position/FOV between idle and loading states rather than standing up a second star system |
| **o2bomb/space-warp** — honest post-mortem | https://github.com/o2bomb/space-warp | Read this before building: the author's first version hit ~65% Lighthouse on mobile from stacking bloom + chromatic aberration. Don't repeat that — bloom alone, no chromatic aberration, same discipline `SKILL-TREE-3D.md` §5.1 already applies to the map's own bloom usage |

**It is a camera move on the existing scene, not a second star system.** The
table above already says this ("animate its camera z-position/FOV between idle
and loading states rather than standing up a second star field") and the
backdrop makes it the only sensible reading: the star field is *already there*,
behind every route. A warp is that field accelerating — pull the camera, widen
the FOV, let the existing recycled particle pool streak — then settle back into
the ambient drift. Standing up a second scene on top of the first would cost a
second WebGL context to show the student something they can already see.

**Where it triggers, given the backdrop:** first arrival at `/app`, and any
navigation between routes that both show the backdrop. It must NOT fire on the
way into a content surface — that is §4.2's job, and the two firing together
would be two loading animations for one navigation.

**Budget:** this is a loading state, so it must never itself become the
reason a page feels slow — cap it under the existing 3D chunk's performance
budget, and skip it entirely (straight to end state) under
`prefers-reduced-motion`, same as every other animated moment in this project.

### 4.1b The flat map's star field — the CSS box-shadow technique

The warp above accelerates a WebGL star field. The **flat map has no canvas** —
it is what a student gets under reduced motion, on a portrait phone, without
WebGL, or after the frame-rate guard fires — so it needs a star field that costs
essentially nothing and never runs a frame loop.

**The technique: one element, N box-shadows.** A single small element carries a
long comma-separated `box-shadow` list, so 160 stars cost 160 shadows on **one
DOM node** rather than 160 nodes. Three layers at 1px/2px/3px give depth. It is
a well-worn CSS pattern, usually credited to Saran Sinha's parallax pen and
reproduced widely since.

| Source | URL | What we took |
|---|---|---|
| **Parallax Star background in CSS** (sarazond) | https://codepen.io/sarazond/pen/LYGbwj | The core trick: SCSS loop generating a long `box-shadow` list; three layers at different star sizes |
| **Resizable Parallax Starfield** (kylehenwood) | https://codepen.io/kylehenwood/pen/XXdrJM | Making the field resize without regenerating the list |
| **Parallax Starfield HTML+CSS** (Matt Montag) | https://www.mattmontag.com/design/parallax-starfield-htmlcss-effect | The clearest write-up of why one node with N shadows beats N nodes |

**Three deliberate departures from every version of it online:**

1. **The animation is removed.** Those pens translate each layer on a loop
   (50s/100s/150s) to fake parallax. Our flat map must not move: two of the four
   rungs that send a student to it are *"this device is struggling"* and *"this
   person asked for less motion"*, and both are answered by holding still. A spec
   asserts that no CSS animation is declared anywhere in the flat map's subtree —
   a static screenshot alone would not prove it, since a slow enough animation
   looks still.
2. **No literal colours.** The shadow list omits the colour entirely, so each
   star uses `currentColor` and the layer takes its colour from a token. One list
   serves all three themes, and it does not trip the hook that bans hex outside
   `packages/tokens`.
3. **Generated in TS, not SCSS.** The list is built once by a seeded PRNG in
   `FlatGalaxy.tsx` and passed as CSS custom properties, so it stays out of the
   stylesheet (160 shadows is a lot of bytes to ship to every route) and stays
   deterministic — the sky is the same every session. **It is not the per-student
   cosmetic seed**: it must not vary by student, or two students comparing
   screens would see different skies over the same curriculum.

**Where the warp fits on the flat map.** Selecting a planet in 3D flies the
camera in (`GAME-DESIGN.md` §3.2). There is no camera here, and scaling the SVG
to fake a zoom would put a large motion on precisely the surface that
reduced-motion students land on. So the flat map borrows §4.1's warp instead:
its own star layers streak outward, the map fades, and the stage opens on the
other side (`useFlatWarp`). Under `prefers-reduced-motion` it is **skipped
entirely and navigation happens immediately** — not slowed, skipped, the same
rule as every other animated moment in this project.

### 4.2 Stage/moon loading — biome-themed

**Trigger:** entering a specific planet or opening a moon detail — the
student knows their destination, so the loading screen previews it.

**What it looks like:** a few seconds of the destination biome's backdrop,
already in motion if it has any ambient parallax, before the actual stage
content mounts. Not a spinner, not a progress bar with no context — the
destination itself, arriving early. This is consistent with
`PAGE-SPECS.md` §5's existing loading-state rule: "skeletons matching final
layout, never a centred spinner" — a biome preview is the game-native version
of that same principle, not an exception to it.

**It is also the hand-off out of the backdrop.** Entering a stage is the one
navigation where the solar system stops being the background — content surfaces
opt out (`SOLAR-SYSTEM-SPEC.md` §1.5). So this transition carries a second job
beyond covering a fetch: it is the seam where one visual world becomes another.
The biome arriving early is what makes that a departure rather than a
disappearance.

Sequence, once built: the backdrop dims and recedes → the destination biome
resolves in → stage content mounts on top of it. Reversed on the way back out.

**Reduced motion:** freezes to a single static frame of the biome, same
information, same rule as everywhere else in this project. No dim, no recede —
the backdrop is simply not there on the next route, which is what a
reduced-motion user gets from every other transition in this app.

## 5. Accessibility note specific to biomes

Biome art is decorative background, never a carrier of information the
content itself doesn't also state in text — same "the game layer may never
be the only carrier of meaning" rule from `DESIGN-MANDATE-V2.md` §1B rule 4.
A screen-reader user gets the same stage content Student A and Student B get;
they just don't get told whether their landing scene is jungle or desert,
because that fact carries no pedagogical weight and doesn't need an
accessible equivalent — this is the one place in the whole redesign where
"doesn't need a text equivalent" is the correct call, precisely because it's
pure cosmetic dressing with zero information content, the same test that
already governs everything else.

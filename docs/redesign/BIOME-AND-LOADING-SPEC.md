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

## 1b. The biome is the PAGE background, not a band — ruled 2 September 2026

§1 says a biome is "the scenery around it… behind its edges", and §4.2 says
stage content "mounts **on top of it**". Both describe a background. It was built
as a **banner strip** at the top of the stage reader, which is a weaker reading
of the same words, and the instructor's ruling settles it: **the biome is the
background of the whole page when one is selected.**

### Where it goes, and where it must not

| Surface | Biome | Why |
|---|---|---|
| `/app/stage/:id` and its beats — **after ENTER JOURNEY** | **Yes — full page** | This is the landing. It is what §4.2's hand-off delivers you into |
| A moon's journey — **after ENTER JOURNEY** on a moon | **Yes** | Same landing, entered at that subtopic's anchor |
| A stage's activities and minigames | **Yes** | They are the planet's content, and the biome is that content's background |
| **The map sidebar — planet or moon** | **No** | Ruled 25 Sep 2026 (`WEB-REVAMP.md` §3.5). The sidebar is where you choose; the biome is what you find after choosing. **This row supersedes the earlier "a moon's detail: Yes"**, which was written when a moon's detail was a landing rather than a panel on the map |
| `/app`, `/app/map`, hub routes | **No** | The solar system is the background there (`SOLAR-SYSTEM-SPEC.md` §1.5). Two backgrounds is two visual systems arguing |
| **The Self-Test / any assessment** | **NEVER** | `DESIGN-MANDATE.md` §1B rule 1: theatre dresses the practice, never the assessment |

### What it must not do — the fairness line

**A biome must never change an assessment's appearance.** §1's worked example is
the rule: Student A lands in a jungle and Student B in a desert, and **both get
the Pixel encounter theme** for the bit-toggle exercise, because pixel art is
honestly what a grid of bits looks like. Encounter themes are per-STAGE and
identical for everyone (`GAME-DESIGN.md` §9).

So when this spec says the biome changes "the colours", it means **the page's
ambient scenery** — the backdrop behind and around content. It does **not** mean
the encounter theme, the answer controls, the feedback colours, or anything a
student is graded through. Two students must be able to compare screens during a
Self-Test and see the same exercise.

This is the same boundary `SOLAR-SYSTEM-SPEC.md` §3 draws for every other
cosmetic: **unique system, identical curriculum.**

### Legibility is not negotiable

A full-page background sits behind body text, so it is held to the same computed
AA contrast as everything else. Content keeps its own surface — the biome is
*behind* the reading column, never *under* the words. If a biome cannot clear
contrast behind text, the content surface gets more opacity, not the biome less
art.

---

## 2c. Why the first seven looked bland, and the composition grammar that fixes it

**The honest diagnosis: every biome was built the same way.** Tile a sprite
along the bottom, put a cloud strip on top, vary the sprite. Seven biomes, one
composition, so they read as one picture in seven palettes.

Reference parallax art does not work that way. What distinguishes a jungle from
a desert is not the foliage — it is **structure**: where the horizon sits, how
much sky is visible, whether the frame encloses you or opens out, whether the
repeated forms are vertical or horizontal.

**Each biome declares a structure, and no two share one:**

| Biome | Structure | What that means concretely |
|---|---|---|
| `jungle` | **Enclosed, no horizon** | Canopy from the top edge, trunks crossing the full height. Sky barely visible. Dense verticals at three depths |
| `desert` | **Wide, low horizon** | Most of the frame is sky. Sparse verticals, long horizontals, a single dominant form (the pyramid) rather than a repeat |
| `arctic` | **High horizon, layered ridges** | Mountains stacked back to front; the drama is the silhouette line, not objects |
| `ocean` | **Suspended, no ground line** | Forms enter from top AND bottom. The subject is the water column, so nothing sits on a floor |
| `cave` | **Framing, looking through** | Ceiling and floor both intrude; the eye reads an opening between them. The one biome that encloses on two edges |
| `neutral` | **Open, mid horizon** | Deliberately the calmest — it is the default and must not compete. Nothing sits close to the viewer, and it owns the only snow-capped range |
| `city` | **Vertical, built, lit** | The one landscape that is made rather than grown: straight edges, a hard skyline, and points of window-light nothing else in the set has |

`volcanic` was the seventh row here — *"glow from below, procedural, the only
biome lit from beneath"*. It was **replaced outright by `city` on 2 Sep 2026**,
having been the one biome with no art at all. See §2a.

**The test:** desaturate all seven to greyscale. If two are hard to tell apart,
the composition is doing no work and the palette is carrying it. Palette is the
weakest possible differentiator — it is also the one that breaks first for a
colour-blind student.

### Reference material

Read the composition, not the assets — these are references, and only the CC0
and explicitly-licensed ones are candidates for vendoring:

| Source | Use |
|---|---|
| **OpenGameArt — Underwater World Parallax Backgrounds** — https://opengameart.org/content/underwater-world-parallax-backgrounds | Suspended composition: forms entering from both edges, no ground line |
| **OpenGameArt — Background Scenes** — https://opengameart.org/content/background-scenes | A set built as a set — how horizon height alone separates environments |
| **CraftPix — Pixel Cave Parallax** — https://craftpix.net/product/pixel-cave-game-parallax-backgrounds/ | The framing structure: ceiling and floor both intruding. **Licence is not CC0 — reference only, do not vendor** |
| **itch.io parallax tag** — https://itch.io/game-assets/tag-parallax | Breadth. Remember §2a: itch is good at finding art, bad at proving you may use it |

**Cross-reference every change with Playwright.** `design/specs/biomes.spec.ts`
captures all seven; the greyscale test above is the one to run when a
composition is changed, because "these look different" is exactly the judgement
a screenshot settles and an opinion does not.

---

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
the default landing scene. Fall back to a procedural treatment only where no
clean, verifiably-licensed pack exists yet, not as a blanket default
everywhere.**

> **All seven have real art as of 7 September 2026, so the fallback covers
> nothing.** `PROCEDURAL` in `BiomeScene.tsx` is empty and deliberately kept
> empty, so the next unsourceable biome has to opt in by name.
>
> **The candidate table below is DATED RESEARCH from 1–2 September and is
> deliberately not rewritten.** It is the licence audit trail — what was
> checked, on what date, in whose words — and two of its rejections still bind
> (Admurin's cave, and any pack whose licence lives in a comment). What it is
> *not* is a description of what ships. That is the table in §2a, above.

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
ones on purpose.** *(Both have since been resolved: `volcanic` was replaced by
`city`, and `cave` was sourced from OpenGameArt — the same artist the itch
listing could not licence. Kept because the reasoning is the point.)* Not every biome has a clean, obviously-CC0 pack waiting —
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

**Current as of 7 September 2026. Four of these rows changed twice in two days**,
so treat the table as a record of what is vendored *now* and read the pack
docblocks for why.

| Biome | Vendored | Licence, and how it was confirmed |
|---|---|---|
| `neutral` | **MatiasVME**, Parallax background forest, 8 layers | CC0 — OGA structured `License(s)` field, "No attribution required" |
| `jungle` | **ansimuz**, Forest Background, 4 layers | CC0 — confirmed twice: OGA field + the pack's own `license.txt` |
| `desert` | **Emcee Flesher**, Rocky desert landscape, 4 layers | CC0 — OGA field, and the **derivation chain walked**: it derives from Quantiset's Mars background, also CC0 on its own page |
| `arctic` | **Admurin** Snowy Mountains, 5 layers | **Not CC0.** Terms verbatim in the pack dir; vendored via a driven browser session, exactly as §1b predicted |
| `ocean` | **ansimuz** Underwater Fantasy, 4 layers | Permissive, not stated as CC0. Terms verbatim in the pack dir |
| `cave` | **ansimuz**, Warped: Super Grotto Escape, 3 layers | CC0 — confirmed twice: OGA field + the pack's `public-license.txt` |
| `city` | **FabinhoSC**, Skyline Background, 5 layers | CC0 — confirmed twice: OGA field + the pack's `Read.txt` |

**What this table used to say, and why it changed** — the history matters
because two of the changes were licence decisions and two were not:

- `neutral`, `jungle`, `desert` were **Kenney Background Elements** (CC0), loose
  vector elements composed by the renderer. Replaced 7 Sep on **looks, not
  licence**: flat two-tone shapes have no internal detail, so the biomes read as
  bland at any density. See §2e.
- `volcanic` was **procedural** — the one biome with no cleanly-licensed pack.
  Replaced outright by `city`, which has real CC0 art.
- `cave` was **JonathanPalmerGD / PWL** (CC0, impeccable). Replaced 7 Sep on
  looks: three flat silhouettes on tan that were re-scaled twice chasing a cave
  they could not become.

**No substitution lowered the standard.** Five of seven are CC0; the two that
are not carry their terms verbatim in their own pack directory, and every biome
directory ships a `LICENSE.txt` that travels with the art.

**Kenney's pack is no longer used by any biome.** It supplied `neutral`,
`jungle` and `desert` as loose *elements* composed in their own manifests —
23 KB for three biomes — until 7 September 2026, when all three were rebuilt
from pre-cut packs on looks rather than licence (§2e). The row above survives
because the pack is still the right answer for a biome that genuinely needs
loose elements, and because `CREDITS.md` records what shipped in earlier
builds.

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

## 2d. Scatter, not tile — the mechanism that made them repetitive

§2c said the seven biomes read as one picture in seven palettes and blamed
composition. That was half the answer. The other half is the **rendering
mechanism**: every layer used `background-repeat: repeat-x` with one sprite.

**That is uniform by construction.** One silhouette, one interval, forever. No
choice of prettier tree fixes a mechanism whose whole job is to repeat exactly —
and it is why the first fix (choosing sprites whose rendered widths differed)
helped a little and did not solve it.

### The standard fix, and where it comes from

Breaking texture repetition is a solved problem in game rendering. The canonical
treatment is **Inigo Quilez's article on texture repetition**
(https://iquilezles.org/articles/texturerepetition/): derive a pseudo-random
**offset and orientation per tile** from the tile's own index, so that neighbours
differ without any runtime randomness. The other standard techniques are
**multiple variants selected per instance**, and **deliberate scatter placement**
rather than a grid.

| Technique | How it lands here |
|---|---|
| Per-instance offset from a hash | Each sprite's x comes from a hash of biome + layer + index |
| Per-instance orientation | Horizontal flip, 50/50 — **doubles apparent variety for free** |
| Multiple variants | Each layer carries a POOL, not one sprite. Pools mix silhouettes, not sizes of one shape |
| Size variation | `jitter` spreads instances ±35% around the layer's scale |
| Scatter placement | Slot-based, see below |

**Sources:** Quilez as above · [Unreal forum thread on breaking tiling
repetition](https://forums.unrealengine.com/t/how-to-break-the-repetition-of-tiling-texture-in-unreal/1643221)
· [GameDev.net on preventing repeating terrain
textures](https://gamedev.net/forums/topic/652603-preventing-repeating-terrain-textures/).

### Slot-based, not free-random

Instances are NOT placed at uniform random. The width is divided into `count`
slots and each instance jitters **inside its own slot**.

Pure randomness clumps — that is what randomness does — and a clump reads as a
mistake rather than as nature. Slots keep the spread even while the jitter
removes the rhythm, which is the combination that actually looks unplanned.

### Deterministic, and not the student's seed

The hash is seeded from the **biome name and layer index**, never from the
per-student cosmetic seed. Two students in a jungle see the *same* jungle, the
same way they see the same curriculum — the biome is already the per-student
variable, and varying it twice would make a screenshot impossible to compare and
a bug impossible to reproduce.

It also means captures are stable: `design/biomes/` can be diffed between runs.

### Animation covers what is left

Two layers of motion, both cheap:

- **Layer drift** — each layer translates a fraction of a percent, at a speed set
  by its depth. Parallax between layers is what stops a still scene reading as a
  flat backdrop.
- **The ambient motif** (§4.2b) — twelve motes, deterministic, one motif per
  biome.

Both stop dead under `prefers-reduced-motion`. Neither is a particle library:
this is weather, and root `CLAUDE.md`'s initial-bundle rule is not relaxed for
weather.

### Two mistakes worth keeping

**A layer with no `variants` still tiles.** The desert's sun had none, fell
through to the old path, and `repeat-x` put a **row of suns across the sky** —
the exact uniformity this rebuild exists to remove, reintroduced by an omission.
A single-instance layer must say so explicitly: `count: 1`.

**Sprites are sized by height, so width needs an aspect.** Defaulting every
sprite to a tall 1:2 squashed the clouds into ovals; Kenney's are about 1.6:1.
Every scattered layer now carries an `aspect` **measured from the PNG header**,
not guessed.

---

## 2e. THE BIOME TEMPLATE — six slots, filled to the letter

Every biome fills the same six slots, back to front. This is not a style guide;
it is a **conformance list**, and `design/specs/biomes.spec.ts` asserts it.

The template exists because the first seven biomes were built by taste and came
out flat: sprites on a gradient, standing on nothing. Published parallax packs
all carry the same structure, and the slots this project kept skipping — sky,
ground, atmosphere — are the ones that make a scene a *place* instead of a
collage.

| # | Slot | What it is | Required? |
|---|---|---|---|
| 1 | **Sky** | Two-stop gradient from `--biome-sky-top` / `--biome-sky-low`. Static | **Always** |
| 2 | **Far** | Horizon silhouettes. Low saturation, small, many | **Always** |
| 3 | **Mid** | The subject mass. Where most of the depth reads | **Always** |
| 4 | **Near** | Large forms, full saturation, may leave the frame | **Always** |
| 5 | **Ground** | The plane everything stands on | Unless the biome has none (see below) |
| 6 | **Motif** | One ambient particle, §4.2b | Unless deliberately none |

### The rules, in order of how often they were broken

1. **A sky is a layer, not a background colour.** Without it, sprites float on
   the app's page surface and every biome reads as murky regardless of the art.
   Two stops, because a flat fill reads as paper.
2. **Things stand on the ground, and the ground is a slot.** Sprites were
   positioned against the bottom of the *viewport* with nothing beneath them.
   Vertical jitter may only **sink** a sprite, never lift it — a tree can stand
   behind the horizon, it cannot hover above it.
3. **Distance drains colour.** Atmospheric perspective is not optional decoration:
   a far ridge at full saturation reads as a small near ridge. Saturation ramps
   with depth so the back of the scene sits closer to the sky it is seen through.
4. **At least three depth layers**, or there is no parallax to speak of — two
   layers is a backdrop and a sprite.
5. **Every layer scatters** (§2d) unless it is genuinely a single object. A layer
   without `variants` falls through to `repeat-x` and tiles, which is the
   uniformity this whole section exists to remove.
6. **Every sprite declares a measured `aspect`.** Sizing is by height, so width
   comes from the ratio; guessing squashes wide sprites into ovals.

### How each biome fills the template

Structure per §2c, and **no two share one** — that is what the greyscale test
checks:

**All seven are pre-cut packs as of 7 September 2026.** `neutral`, `jungle` and
`desert` were compositions built from Kenney Background Elements — loose flat
vector shapes scattered by this renderer. Every technique in this section was
applied to them (scatter, overlap, density falling with depth, atmospheric ramp,
fog sheets, a ground plane) and they still read as bland, because **the
composition was never the problem**: flat two-tone vector shapes have no internal
detail, so there is nothing for the eye to find at any density. Scattering more
of them produced a denser flat picture.

| Biome | Structure | Pack | Ground | Motif |
|---|---|---|---|---|
| `neutral` | open, mid horizon, snow-capped | MatiasVME, 8 layers | *in art* (loose rock) | *none, on purpose* |
| `jungle` | enclosed, no horizon, god-rays | ansimuz, 4 layers | *in art* (forest litter) | leaves |
| `desert` | receding terraces, the only red | Emcee Flesher, 4 layers | *in art* (3 terraces) | sand |
| `arctic` | high horizon, ridges | Admurin, 5 layers | *in art* (snow) | snow |
| `ocean` | submerged, no sky | ansimuz, 4 layers | *in art* (seabed) | bubbles |
| `cave` | interior, no sky, crystals | ansimuz, 3 layers | *in art* (rubble) | dust |
| `city` | vertical, built, lit | FabinhoSC, 5 layers | *in art* (street) | dust |

**Strip packs fill slots 2-5 inside their own art** — they are pre-cut scenes
drawn as a set, and re-cutting them would undo the composition. They still owe
slots 1 and 6, and the template still applies: what changes is who fills them.

**Every ground exemption is "the art already has one"** — jungle's litter,
neutral's loose rock, desert's terraces, arctic's snow, ocean's seabed, cave's
rubble, city's street. Not one biome is exempt because it has no floor; they are
exempt because drawing a second floor over a painted one puts a flat coloured
band across it. `neutral` is the one real exemption, and it is from the MOTIF: it
is the default, and a default that demands attention is one a student has to get
rid of.

**Two things a pre-cut pack still gets wrong, and both are measured, not seen:**

*A pack can leave a transparent margin below its artwork.* `align: "bottom"`
aligns a layer's CANVAS, not its picture, so city's `front.png` — 250×170 with
content ending at y=142 — rendered its skyline 16.5% above the frame with
`back.png`'s silhouette showing underneath. The city hovered over its own
shadow. `BiomeLayer.sink` pushes that margin off-frame, and the value comes from
the alpha bounding box: `(canvasHeight - contentBottom) / canvasHeight`. The pack
is not wrong — a platformer covers that strip with ground tiles. A full-page
background has none.

*Height-fitting is right on a wide screen and wrong on a tall one.* A 1.78-ratio
strip in a 380×844 viewport is 1500px wide, so a phone shows a quarter of the
scene — which is what "the arctic trees are squished to the side" actually was.
Below 640px the strips fit the WIDTH instead, anchored to the bottom, with the
sky gradient filling above. That is why **every pack's sky token must be matched
to its own art**: on a phone, most of the sky IS the token.

**The scatter renderer is kept, unused.** Nothing declares `variants` any more,
and `.biome-ground` draws for nobody. Both stay for the same reason `PROCEDURAL`
is kept empty: the next biome sourced as loose elements rather than as a pre-cut
scene will need them, and that should be opted into deliberately rather than
rebuilt from scratch. The sprite rules below still bind anything that uses them.

### The sprite rules — measured, never eyeballed

Four rules, all written after the same mistake: looking at a biome, thinking it
was fine, and being wrong. Every one was found by **measuring**, and every one is
now asserted per biome in `biomes.spec.ts`.

**1. Nothing is squashed. A sprite's ratio comes from its file.**
Sprites are `<img>` with `height` set and `width: auto`, so the browser takes the
ratio from the PNG. They used to be `<span>`s with a `background-image` and one
declared `aspect` per *layer* — but a layer holds **variants**, and variants are
different pictures with different shapes. Jungle's trees are 0.44, 0.46 and 0.46;
its cloud is 1.59. Measuring across all seven found **fourteen distorted sprites,
the worst by 51%**, and not one was visible as distortion — a tree squashed 27%
just looks like a tree, if you have never seen it undistorted.
**Never reintroduce a declared aspect ratio.** A number describing a picture is a
number that will stop describing it.

**2. Nothing floats. Vertical jitter may only sink.**
Every sprite's base must reach the ground line. Jitter is allowed to push a
sprite *down* — standing behind the horizon, partly hidden — and never to lift
one. It was `(rand() - 0.5) * 3`, symmetric around zero, which lifted **half of
every layer** off the ground: the floating was caused by the jitter added to make
placement look natural.

**3. Density falls toward the viewer.**
A forest is dense at the back, because you are seeing through many trees at once,
and sparse at the front, because you are standing between them. Jungle runs 26 →
18 → 12 → 6. Reversing it produces a hedge with a view behind it. The far layers
can carry those counts only because instances **overlap**: placement spreads
±1.8 slots, not ±0.9, so neighbours cross. Confining each sprite to its own slot
produced a perfectly even rank however random the jitter looked, and an even rank
reads as a fence.

**4. Depth is three effects, not one, and one of them goes *between* layers.**
Distance drains colour, lowers contrast, and lightens toward the sky — so
saturation, brightness and contrast all ramp with depth, landing the far layers
near flat silhouettes. That is what the technique literature recommends: distant
trees are *"just silhouettes"*, a single dark shape that reads as a tree from any
distance, while only foreground trees carry leaf detail.

But a filter changes a *sprite*; it cannot put anything **between** two planes, so
far and mid stayed crisply separated however desaturated the far one got. Each
scattered layer therefore also draws a **fog sheet** — one thin veil of sky colour
in front of it. Fog **compounds**: at 0.22 per sheet a seven-layer desert went
milky grey and lost the warm dusk that was the point of its palette. Per-layer
opacity has to be read as a total. It is 0.10.

### Clouds

The sky is the largest empty area in the frame, so uniformity shows there first
and worst. **At least four cloud variants, and a size spread of ±65% or wider** —
three variants at ±45% read as one cloud stamped along the top. Desert runs two
cloud bands at different depths rather than one, so they do not all sit on one
plane.

### Before you call a biome done

Run `node scripts/capture-biomes.mjs` and read the layer shape it prints, then
`pnpm qa design/specs/biomes.spec.ts`. The captures go in `design/biomes/`, one
per biome.

**A dev server on port 5173 may not be this project.** A full spec run once passed
entirely against a different app: it returned 200, rendered an `<h1>` and
screenshotted happily, and seven of its pages came within one commit of being
committed as OCTA's biomes. `design/global-setup.ts` now refuses to run against an
app whose title is not OCTA — but the same trap catches manual checks, so confirm
the port before believing what you see.

### Following it to the letter

`biomes.spec.ts` asserts the template per biome: a sky that is not the page
surface, at least three depth layers, a ground plane or a recorded exemption,
and every scattered layer carrying `variants` and `aspect`. A biome that skips a
slot fails there rather than in review — which is the point, because the first
seven skipped three slots each and looked plausible enough to ship.

### Reference material

Read the layer structure, not the assets:

| Source | What it gives |
|---|---|
| **SLYNYRD — Pixelblog 23, Parallax Scrolling** — https://www.slynyrd.com/blog/2019/11/12/pixelblog-23-parallax-scrolling | The authoritative artist treatment. "Layer 1 — Sky … this is your atmospheric base", and far layers as "low detail, low saturation, mostly shapes and atmosphere" |
| **Inigo Quilez — texture repetition** — https://iquilezles.org/articles/texturerepetition/ | Per-instance offset and orientation from a hash; the basis of §2d's scatter |
| **OpenGameArt — 3 Parallax Backgrounds** — https://opengameart.org/content/3-parallax-backgrounds | Complete packs to compare slot-for-slot |
| **Crystal Moon sci-fi parallax** — https://gleolite.itch.io/crystal-moon-simple-sci-fi-parallax-background | A published layer list that names every slot: "sky & moon, far mountains, mid mountains, near mountains, big crystal clusters, **ground with small crystals**" — the ground layer this project kept omitting |
| **Sky Island parallax-ready** — https://chixell.itch.io/sky-island-pixel-art-parallax-ready-background | Foreground-detail slot done well |

**Cross-reference with Playwright, not with opinion.** `design/biomes/` holds one
capture per biome; changing a composition means re-capturing and comparing, and
the greyscale test is the one that settles "do these look different".

---

## 3. Seeding — via the cosmetic endpoint, not the exam engine

Per `SOLAR-SYSTEM-SPEC.md` §3 (corrected after R0's security check — read
that section, not the earlier draft if you have it cached): the biome index
comes from the same **new, read-only cosmetic endpoint** as the orbit
rotation offset, palette variant, and callsign — derived from `student_id`
via a lightweight, non-secret hash, **never** from
`services/api/src/engine/seed.ts`'s exam-attempt seed, which embeds
`EXAM_SALT_SECRET` and must never be reimplemented or exposed client-side.
Pick a biome index from the set in §2 above — **7** (neutral, jungle, desert,
arctic, ocean, cave, city). The server's `BIOMES` array in
`routes/cosmetics.ts` is the authority on the order, and the client reads the
list back from the response rather than hardcoding it, so adding one is a
one-line change on the server. Expand further only
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

### 4.2b One ambient motif per biome — added 2 September 2026

§4.2 says the loading screen shows "the destination biome's backdrop, already in
motion if it has any ambient parallax". **Each biome now declares what that
motion is** — one motif, and only one.

| Biome | Motif | Direction |
|---|---|---|
| `jungle` | Leaves falling | down, drifting sideways |
| `desert` | Sand blowing | across, low |
| `arctic` | Snow falling | down, slow, straight |
| `ocean` | Bubbles rising | up |
| `cave` | Dust motes | drifting, no dominant direction |
| `neutral` | None | it is the plain one, and stays plain |
| `city` | Dust motes | drifting — the same motif as `cave`, and the only pair that shares one |

`volcanic`'s row was **embers rising, up, faster than bubbles**. The biome was
replaced by `city` (§2a) and `embers` is now a motif nothing uses. It is kept in
the `motif` union in `registry.ts` rather than deleted, because a rising-ember
effect is the obvious thing a future forge or foundry biome would want, and the
CSS for it is already written and reduced-motion-safe.

**Why one and not several.** `DESIGN-MANDATE.md` §1B rule 3 allows one spectacle
moment per stage, and the Bring-Up already owns it. A loading transition that
layers three effects spends a budget that belongs to the moment a subsystem
comes online.

**Why the direction matters more than the particle.** Falling, rising and
drifting are three different readings of gravity, and gravity is what tells a
student whether they are underwater, underground or outside — before any sprite
resolves. Two biomes sharing a direction should differ in speed and density, and
`neutral` deliberately has none so the default reads as calm rather than busy.

**Constraints, all inherited rather than new:**

- **Reduced motion freezes it to a static frame.** Same rule as everywhere.
- **It never runs behind an assessment.** §1b's fairness line: theatre dresses
  the practice, never the assessment.
- **CSS or a single canvas, not a particle library.** The initial-bundle rule in
  root `CLAUDE.md` is not relaxed for weather.
- **It stops when the stage mounts.** A motif that keeps running behind content
  is decoration competing with reading, which the mandate's first test rejects.

---

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

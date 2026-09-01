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
| **Jungle** | itch.io CC0 jungle/forest parallax packs — browse https://itch.io/c/6211077/parallax-bg, filter to CC0 per file | Varies per file — check individually | |
| **Desert** | **Desert Parallax Background** (styloo) — https://styloo.itch.io/desert-parallax-background | CC0 1.0, explicit | Multiple resolutions provided, 4 layers |
| **Arctic / snow** | **Parallax Backgrounds: Snowy Mountains** (Admurin, via the curated Free CC0 Assets collection) — https://itch.io/e/12578572/jco-added-to-free-cc0-assets, or search https://itch.io/game-assets/tag-backgrounds/tag-snow | Check per file | Several options in this tag; pick one, verify its license page directly rather than trusting a collection listing |
| **Volcanic** | Browse https://itch.io/game-assets/tag-backgrounds/tag-volcano | Check per file | No single standout free pack found — this is the one biome that stays procedural for now (lava-glow gradient, warm high-contrast palette) until a properly-licensed pack turns up, per the fallback rule in §2 above |
| **Cave / underground** | Browse https://itch.io/game-assets/new-and-popular/free/tag-parallax (search "cave" within results) | **Verify carefully** — one popular-looking cave pack (Admurin's) was flagged by its own author, in the comments, as ambiguously licensed (claimed CC0 in one place, CC 3.0 on DeviantArt) — this is exactly the "check per file, don't trust a tag" discipline this project already applies everywhere else, now with a concrete example of why it matters | |
| **Ocean / underwater** | Browse https://itch.io/game-assets/tag-parallax (search "ocean") — several free options surfaced, e.g. "Free Ocean and Clouds Pixel Backgrounds" | Check per file | |

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

**Budget:** this is a loading state, so it must never itself become the
reason a page feels slow — cap it under the existing 3D chunk's performance
budget, and skip it entirely (straight to end state) under
`prefers-reduced-motion`, same as every other animated moment in this project.

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

**Reduced motion:** freezes to a single static frame of the biome, same
information, same rule as everywhere else in this project.

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

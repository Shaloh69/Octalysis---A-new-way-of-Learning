# The remake's direction — game UI references

The student app is being **remade as a game** (instructor, 30 Sep 2026;
`docs/redesign/WEB-REMAKE.md`). These are the references the whole remake is
drawn from: two registers, one for the star system and one for inside a
planet, plus the art that makes the second one buildable in CSS.

**They are direction, not route templates.** Each route session still captures
its own `template.png` into `design/templates/web/<route>/` (root `CLAUDE.md`,
templates are artifacts), and it normally starts from the screen named for it
below. Every image here was **opened and looked at** before this file was
written.

**Copyright.** The Starfield, No Man's Sky and Stardew Valley images are
screenshots of commercial games, kept as reference artifacts only, exactly as
the other templates are. Nothing from them ships. The Kenney packs are **CC0**
and may be vendored; RPGUI is read for technique.

Captured 30 Sep 2026 (00:44-00:50 UTC). Game screenshots downloaded from
interfaceingame.com's own image files (HTTP 200 for each page and each image),
1920×1080 as published. Web pages captured with Playwright (Chromium) at
1440×1000, `load` + 4s.

## `star/` — the star system: a sci-fi HUD

The default look, on every hub route (`WEB-REMAKE.md` §2). The student's
bare-metal, blueprint or phosphor choice and seeded accent are its colour
variants.

| File | Source (page, image) | What it shows | Used for |
|---|---|---|---|
| `starfield-map.png` | https://interfaceingame.com/screenshots/starfield-map/ · `/wp-content/uploads/starfield/starfield-map.png` | A solar system in flat space: orbit rings, the sun, planets with rings, a moon **selected** with a reticle and its name tag. Left: a **system panel** (designation, level, a row of bodies, SURVEY 33%) over a **body panel** (Kreet, Moon of Anselon, SURVEY 19%, a two-column stat table, resources as tiles). Bottom right: a **key-hint bar** (MISSIONS L, SHOW ME, RESET CAMERA, SET COURSE X, BACK TO GALAXY Tab / hold to exit). A vertical "STARMAP" tab on the far left | `/app` and `/app/map`: the selected-body panel, SURVEY as mastery, the key-hint bar, the tab |
| `starfield-map-3.png` | …/starfield-map-3/ · …/starfield-map-3.png | The same panel after zooming into the moon: a dotted-terrain surface map, points of interest as diamond markers, SURVEY 51%, TRAITS (0/1) with a `?` | A moon zoom (R4), a planet's inside before its biome resolves |
| `starfield-skill-tree-2.png` | …/starfield-skill-tree-2/ · …/starfield-skill-tree-2.png | A **tab strip** (PHYSICAL · SOCIAL · COMBAT · SCIENCE · TECH) between ← and → buttons, the current tab lit. A centred panel: a title bar, a description, a badge, **CHALLENGE PROGRESS (0/20)**, and RANK 1-4 where **locked ranks carry a padlock beside their words**. "SKILL POINTS 0" boxed bottom-left | **The star-system nav** (a tab strip with arrow-key stepping), and the lock pattern: the reason in words, the padlock beside it, never instead |
| `starfield-character-menu-2.png` | …/starfield-character-menu-2/ · …/starfield-character-menu-2.png | A hub: a centred ring around the character; four corner modules, each a **title rule, a picture, a labelled meter with its number** (SURVEYED 78%, CERTIFICATION 33%, HULL 100%, MASS 79/135); a mission name and next step at the foot; key hints | `/app/progress`: the 21 competency cells and depth as labelled meters around the machine |
| `starfield-inventory-2.png` | …/starfield-inventory-2/ · …/starfield-inventory-2.png | A **dense list** (name, count, value columns; the selected row lit), the item large in the middle, a detail card right (description, MASS 0.50, VALUE 18), totals boxed under the list, key hints | `/app/work`: submissions as a list with a detail card |
| `starfield-hud.png` | …/starfield-hud/ · …/starfield-hud.png | In-world HUD: **MISSION STATUS / ONE SMALL STEP / GET THE CUTTER** boxed top-left; an item card with a leader line; a thin HEALTH bar; a subtitle | The **"what next" tracker** every hub route carries (`lib/next-stage.ts`), top-left, as a mission |
| `no-mans-sky-discoveries.jpg` | https://interfaceingame.com/screenshots/no-mans-sky-discoveries/ · `/wp-content/uploads/no-mans-sky/no-mans-sky-discoveries.jpg` | Top nav as **words with a rule under the current one** (DISCOVERIES · JOURNEY · CONTROLS · OPTIONS · GRAPHICS) between A/D key hints; a player chip top-left; **Star Systems** as a list of SYSTEM rows with PLANET rows indented under them, each with a status icon; the selected planet's panel beside it (name, "discovered by", four facts, actions with key glyphs) | `/app/stages`: acts as systems, stages as planets, each row's state as an icon plus a word |

## `biome/` — inside a planet or moon: pixel frames

The look the moment a student enters a planet or moon: the nav and the page
follow that planet's biome (`WEB-REMAKE.md` §3).

| File | Source | What it shows | Used for |
|---|---|---|---|
| `stardew-valley-skill-level.png` | https://interfaceingame.com/screenshots/stardew-valley-skill-level/ · `/wp-content/uploads/stardew-valley/stardew-valley-skill-level-1920x1080.png` | A pixel **nine-slice frame** over the live world; a row of **icon tabs attached to the frame's top edge** (the current one raised); skill rows as labelled pixel meters; a tooltip frame; a close ✕ | **The biome nav**: tabs attached to the page frame, the current raised; meters |
| `stardew-valley-journal.png` | …/stardew-valley-journal/ · …-journal-1920x1080.png | A scroll-shaped title tab ("Journal") on a frame; list rows, each its own framed button, with **NEW!** and **DONE** badges or an icon | A stage's own lists: sections, objectives (moons), checks |
| `stardew-valley-quest.png` | …/stardew-valley-quest/ · …-quest-1920x1080.png | The same frame opened to one entry: a title, a paragraph, and the goal as one line with a ▶ marker; a back arrow | A moon's panel (§3.2): the objective, its wording, the one thing to do |
| `stardew-valley-letter.png` | …/stardew-valley-letter/ · …-letter-1920x1080.png | A wide **parchment** surface over the world, text in a hand-lettered face, a close ✕ | The reader's surface inside a biome (the reading column), and what "the biome recedes behind the words" looks like |

## `assets/` — what makes the pixel register buildable

| File | Source | What it is | Licence |
|---|---|---|---|
| `kenney-pixel-ui-pack.png` | https://kenney.nl/assets/pixel-ui-pack (200, "Pixel UI Pack · Kenney") | 750 pixel UI sprites: panels, buttons, arrows, in several colours | **CC0**: may be vendored as nine-slice frames |
| `kenney-ui-pack-sci-fi.png` | https://kenney.nl/assets/ui-pack-sci-fi (200, "UI Pack - Sci-Fi · Kenney") | 130 sci-fi panels, bars, sliders, icons | **CC0** |
| `rpgui.png` | https://ronenness.github.io/RPGUI/ (200, "RPGUI - RPG-style gui in HTML5!") | Pixel frames, buttons and lists done in plain HTML and CSS with `border-image` | Read for technique; nothing copied |

## What was not taken

- **Game UI Database** (https://www.gameuidatabase.com/): **403** behind
  Cloudflare, as on 29 Sep.
- interfaceingame.com pages for Mass Effect Legendary Edition, Terraria and
  Outer Wilds: **404**.
- The other downloaded screens (No Man's Sky HUD and inventory, Stardew
  inventory and collection) were not opened, so they are not kept.

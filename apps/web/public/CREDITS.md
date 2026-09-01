# Third-party credits

Every asset OCTA ships, with its licence — including the ones whose licence does
not require attribution. `GAME-DESIGN.md` §4 is the sourcing rationale.

## Audio
Not yet vendored. Planned: Kenney UI Audio / Interface Sounds (CC0, kenney.nl).

## Landing biomes
`docs/redesign/BIOME-AND-LOADING-SPEC.md` §2. Seven biomes, seeded per student,
lazy-loaded one at a time.

- **Background Elements** — Kenney Vleugels, https://kenney.nl/assets/background-elements
  — **CC0 1.0**. Used for the `neutral` biome. The pack ships its own
  `License.txt`, kept beside the art at `public/biomes/neutral/`. CC0 requires
  no attribution; it is credited here anyway, per this file's own rule.

### Sourced and licence-verified, art not yet vendored

Each of these was opened and its terms read on its own page, 1 September 2026.
**Four of the six are not CC0 and carry different obligations** — filing them
all as "CC0" would be wrong in a way that matters, so the actual terms are
recorded here and in each pack's manifest under `apps/web/src/biomes/packs/`.

- **Free Pixel Art Forest** — edermunizz,
  https://edermunizz.itch.io/free-pixel-art-forest — for `jungle`.
  Commercial use permitted, **credit REQUIRED** (the only pack here that
  requires it rather than merely appreciating it). No NFT or crypto-game use.
- **Parallax Backgrounds: Snowy Mountains** — Admurin,
  https://admurin.itch.io/parallax-backgrounds-snowy-mountains — for `arctic`.
  Any project personal or commercial; **must remain part of a project and never
  be redistributed as a standalone game asset**; no NFT use; **no use for AI
  training**; modification permitted; credit appreciated, not required.
- **Underwater Fantasy Pixel Art Environment** — ansimuz,
  https://ansimuz.itch.io/underwater-fantasy-pixel-art-environment — for
  `ocean`. Personal or commercial use, modification permitted, credit
  appreciated but not required.

### Not sourced

- `cave` — **one candidate was checked and rejected.** Admurin's "Parallax
  Backgrounds: Caves" has the same artwork on DeviantArt under CC 3.0; asked
  directly in the pack's comments which licence governs, the author restated
  the itch terms without reconciling the two. An unresolved licence is not one
  to ship on. A different pack is needed.
- `desert` — styloo's Desert Parallax Background is named in the spec as CC0
  1.0 explicit, but has not yet been opened and verified the same way.
- `volcanic` — **procedural by design**, the one named exception, because no
  cleanly-licensed pack exists for it. No third-party art involved.

## Interface art
Not yet vendored. Planned: Kenney Pixel UI Pack and UI Pack (CC0, kenney.nl) for
the pixel and switchboard encounter themes.

## Fonts
- Space Grotesk — SIL Open Font License 1.1
- Inter — SIL Open Font License 1.1
- JetBrains Mono — SIL Open Font License 1.1

Self-hosted, not hotlinked: a lecture hall on campus wifi should not wait on a
font CDN.

## Libraries
three.js · @react-three/fiber · react-force-graph-3d · Phaser · CodeMirror ·
React · Vite · Fastify · Zod — all MIT unless noted in their own package.

## Framework credit
Motivation design is based on the **Octalysis Framework** by Yu-kai Chou.

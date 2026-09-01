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

Six of the seven are not yet vendored. `jungle`, `desert`, `arctic`, `cave` and
`ocean` need packs sourced and their licences verified **on each file's own
page** — §2's cave row is the worked example of why a tag listing is not
enough, its author having given conflicting licence information in two places.
`volcanic` is procedural by design, the one named exception, because no
cleanly-licensed pack exists for it yet.

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

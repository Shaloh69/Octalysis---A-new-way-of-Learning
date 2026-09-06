# Third-party credits

Every asset OCTA ships, with its licence — including the ones whose licence does
not require attribution. `GAME-DESIGN.md` §4 is the sourcing rationale.

## Audio
Not yet vendored. Planned: Kenney UI Audio / Interface Sounds (CC0, kenney.nl).

## Landing biomes
`docs/redesign/BIOME-AND-LOADING-SPEC.md` §2. Seven biomes, seeded per student,
lazy-loaded one at a time.

- **Background Elements** — Kenney Vleugels, https://kenney.nl/assets/background-elements
  — **CC0 1.0**. Used for the `neutral`, `desert` and `jungle` biomes. The pack
  ships its own `License.txt`, kept beside the art in each of
  `public/biomes/{neutral,desert,jungle}/`. CC0 requires no attribution; it is
  credited here anyway, per this file's own rule.

  These are individual **elements**, not pre-cut parallax strips, so each biome
  is composed from them — which is what §2's table means by calling this pack the
  "base layer for several biomes". Three biomes, **23 KB of art in total**.

- **Parallax Backgrounds: Snowy Mountains** — Admurin,
  https://admurin.itch.io/parallax-backgrounds-snowy-mountains — **NOT CC0**.
  Used for the `arctic` biome. The pack ships no licence file, so its terms are
  copied verbatim into `public/biomes/arctic/LICENSE.txt` and re-verified on the
  live page the day it was vendored. **Obligations:** it must remain part of a
  project and never be redistributed as a standalone game asset, never minted as
  an NFT, and never used as training data. Credit is not required; it is given
  here per this file's rule.

- **Underwater Fantasy Pixel Art Environment** — ansimuz,
  https://ansimuz.itch.io/underwater-fantasy-pixel-art-environment — **not
  stated as CC0, permissive**. Used for the `ocean` biome. Terms verbatim in
  `public/biomes/ocean/LICENSE.txt`: personal or commercial use, modification
  allowed, credit appreciated but not required. No NFT clause and no AI clause —
  the most permissive of the non-Kenney packs.

### Sourced and licence-verified, art not yet vendored

Each of these was opened and its terms read on its own page, 1 September 2026.
**Four of the six are not CC0 and carry different obligations** — filing them
all as "CC0" would be wrong in a way that matters, so the actual terms are
recorded here and in each pack's manifest under `apps/web/src/biomes/packs/`.

**Two of them were not used, and the reasons are worth keeping** (2 September
2026):

- **Desert** — the cited pack, *Desert Parallax Background* by styloo, **now
  returns 404**. It was recorded as the cleanest-licensed of the six; a licence
  verified against a page that no longer exists cannot be re-verified by anyone.
  Composed from Kenney instead.
- **Jungle** — *Free Pixel Art Forest* by edermunizz is usable and its terms are
  clear, but it is the one pack here that **requires credit**, which is a
  standing obligation that must survive every future edit of this file. Kenney's
  CC0 creates none. The edermunizz pack is still the better art and remains the
  right choice for anyone who wants the denser look — its `obligations` field is
  where the requirement gets recorded if it is ever vendored.

Neither substitution lowered the standard: CC0 is at least as permissive as what
either pack offered.

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

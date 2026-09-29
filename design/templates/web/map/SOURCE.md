# Source of template.png

`TEMPLATE-LINKS.md`'s row for `/app/map` names **"beautiful-skill-tree +
React Flow a11y patterns"** (`GAME-DESIGN.md` §4.2). That is a lead. Captured
29 Sep 2026; the lead held no screen of the right shape.

## What was tried

| Lead | Result |
|---|---|
| **beautiful-skill-tree's demo**, https://beautiful-skill-tree.vercel.app/ | **Gone.** HTTP **404**. The repo (https://github.com/andrico1234/beautiful-skill-tree, 200) carries a GIF and three "used by" links, no live demo |
| **calisthenicsskills.com**, the repo's first "used by" | **Rejected: shut down.** 200, title "Vite App", and what rendered is a page reading *"Calisthenics Skills has sunset!"*. `rejected-calisthenics-sunset.png` |
| **Borderlands Skill Tree**, http://borderlands-skill-tree.s3-website.eu-west-2.amazonaws.com/ | **Considered, not taken.** 200, "React App". A real beautiful-skill-tree screen: three columns of icon nodes joined by lines over a game backdrop. **No detail panel** (a node explains itself only in a hover tooltip, which a keyboard or touch user never sees), no legend, nothing saying what to do next. `considered-beautiful-skill-tree.png` |
| **React Flow**, https://reactflow.dev/learn/advanced-use/accessibility and https://reactflow.dev/examples | **Read, not captured as the template.** Both 200. Documentation and component demos, not a product screen. What it gives is a rule, and we take it: nodes and edges are focusable in a stable order, and the graph is operable without a pointer |
| **roadmap.sh**, a curriculum drawn as a node map, https://roadmap.sh/computer-science | **Taken.** Below |

## The screen: `template.png`, `template-380.png`, `template-map*.png`

| | |
|---|---|
| URL | https://roadmap.sh/computer-science, HTTP **200**, title "Computer Science Roadmap: Curriculum for the self taught developer" |
| Captured | 2026-09-29 (15:27 UTC), Playwright (Chromium), `load` + 4s, cookie banner answered "Reject All", at **1440×1500** and **380×1900** |
| Rendered | `template-map.png`: a whole curriculum as one map of topic boxes joined by lines, the main path down the middle, each topic's subtopics branching off it. `template.png`: **"Data Structures" selected**: a drawer opens on the right, IN PLACE over the map, with the topic's title, a short description, its progress controls (Learning / Done / Skip) at the top and its resources below; Close top-right. `template-380.png`: the same drawer, full screen. `template-map-380.png`: the whole map at 380, **shrunk until its labels are about 5px** |
| Opened | All six PNGs were opened and looked at before `SPEC.md` was written |

## What we take

- **A curriculum is a map you can select from, and a selection opens a panel
  in place.** The map stays; the panel says what the topic is, where you stand
  on it, and the one thing to do next. `WEB-REVAMP.md` §3.1's sidebar is this
  pattern, and §3.9 says the flat map opens the same one.
- **The lines are the curriculum's own structure.** roadmap.sh draws its
  dependencies; our 18 edges come from `GET /api/v1/stages`' `edges`, never
  computed here.
- **State is on the node and in the panel**, in words beside a mark.

## What we do not take

- **Its 380.** The whole map shrunk to 5px labels (`template-map-380.png`) is
  the failure our 380 exists to avoid: at 380 our planets sit **15.3px apart**
  (measured from `computeSolarLayout` on the seeded map), so 19 targets on the
  picture cannot each be 24px (WCAG 2.2, 2.5.8). Below a map width of 560px
  the same 19 buttons become a list under a still picture.
- **The drawer as a modal.** roadmap.sh dims the map behind its drawer. Ours is
  a labelled region, not a modal (§3.9): the map stays operable beside it at
  1440, and focus is not trapped.
- **Learning / Done / Skip.** A student marking a stage done would be the
  client deciding progress; `stage_progress` is the grading service's alone,
  and a lock is `is_stage_unlocked()`'s (hard rule 4). Our panel's one action
  is **Enter journey**.
- **Resources, AI tutor, sign-up prompts, its colours and type.** Colours and
  type are ours, from `packages/tokens`. No biome: the solar system is this
  route's background (`BIOME-AND-LOADING-SPEC.md` §1b).

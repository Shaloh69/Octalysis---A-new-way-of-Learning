# Source of template.png

`TEMPLATE-LINKS.md`'s `/console/live` row said *"Custom — see
`DESIGN-MANDATE-V2.md`"*. That file is not gone: it is
`docs/redesign/DESIGN-MANDATE-V2.md` (the row omitted the folder), and its one
Lecture Mode line is §4's *"Never in Lecture Mode aggregates"* about the
avatar. It names no reference. So the session prompt's ask stood: a
purpose-built live-poll / audience-response presenter (a question with a live
bar spread, a projector-sized view) and a control panel.

Method: Playwright (Chromium), `networkidle` + 1.5s, full page, 2026-09-29,
at **1440×1500 and 380×1900** (`NEXT-SESSION.md` §0k.7). shadcn.io previews
were captured after clicking **Skip tour** where it appeared (§0l.7) with its
floating theme switcher (`div.fixed.z-[9999]`) hidden. Every PNG kept here was
opened before anything was built.

## Taken: `template.png`, `template-380.png` (Dashboard Session Analytics) — the control view

| | |
|---|---|
| URL | https://www.shadcn.io/view/dashboard/session-analytics |
| HTTP | 200, final URL unchanged |
| Rendered at 1440 | *Session Analytics*, "Real-time" on the right; **four figures in one row** (247 Active Sessions, 12m 34s Avg Duration, 4.2 Pages / Session, Desktop Top Device), each a small label over a large number; a **Device Breakdown** of three labelled bars with the percentage printed at the end; **Top Active Pages**, five rows of a mono path, a short bar, a count and a duration |
| At 380 | Intact: the four figures fold to **2×2**, the bars keep their labels and values, nothing is cut |
| Taken | **The frame of the room.** A row of four counts (working now, papers open, handed in, reports: the old page's three cards plus `/live/health`, which the page had never read), then **labelled bars with the value printed**, one per stage. 2×2 at 380 |
| Not taken | "Real-time" as a badge (ours says when it last read, in words, and that it reads every five seconds); a duration per row (nothing here is per person); grey as the only bar colour (ours is the accent on a `--surface-2` track, with the number beside it) |

## Taken: `template-projector.png`, `template-projector-380.png` (Awards Vote Results) — the projector

| | |
|---|---|
| URL | https://www.shadcn.io/view/awards/vote-results |
| HTTP | 200, final URL unchanged |
| Rendered at 1440 | *Community Voting Results*, "Best Developer Tool 2025", **16,981 votes** on the right; six rows, each a name, its count and **its percentage**, with a full-width fill bar under it; a footer of "Voting closed · 6 nominees · Results certified" |
| At 380 | Intact: the same rows, bars full width, count and percentage kept on the name's line |
| Taken | **A total at the top, then one bar per row with the number and the percentage printed**: the projector's grammar, at projector size. With a question running: how many answered, then the class's share correct as one bar. With none: people working, then the class so far by stage |
| Not taken | A colour per row (the six hues are the only thing telling rows apart; ours are one accent and a label); the "Winner" badge (a ranking, and Lecture Mode never ranks); names on the rows (the projector names no one, ever) |

## Taken: `template-start.png`, `template-start-380.png` (Dialog Quick Poll, opened) — starting a question

| | |
|---|---|
| URL | https://www.shadcn.io/view/dialog/quick-poll (block page: https://www.shadcn.io/blocks/dialog-quick-poll) |
| HTTP | 200, final URL unchanged. The first capture showed only the **Quick Poll** trigger button on an empty page; retaken after clicking it |
| Rendered | A dialog: *When should we launch?*, "10 votes · Select an option"; three **full-width option rows**; a footer of **Cancel** and **Vote** (disabled until an option is chosen) |
| At 380 | The dialog fills the width; the rows and footer are intact |
| Taken | **Full-width choice rows, and a primary action that stays disabled until a choice is made**, for the *Start a question* dialog: a stage, then one live item from it, then who may answer and why. Rows are pressed buttons (`NEXT-SESSION.md` §0c.5), not radios |
| Not taken | It is the **voter's** side, which is `/app/live` and not this session; the count in the title |

## Rejected

| URL | HTTP | Rendered | Why not |
|---|---|---|---|
| https://www.shadcn.io/view/comments/poll-embed | 200 | A comment thread; one comment by **Sarah Chen** carries a poll ("Next sprint priority", 40 votes) with four radio options | A poll threaded under named people's comments, with avatars: the opposite of a view that names no one |
| https://polling-osfy.web.app/ | never network-idle (45s); screenshot after | The **Live-Poll** project's landing page: "Feel the Room, in Real-Time.", **Login / Sign Up**, Get Started, View on GitHub | The open-source presenter view (https://github.com/yf19770/Live-Poll) is behind a sign-in; the landing page shows none of it |
| https://i.ibb.co/2YHL7bVg/Screenshot-2025-08-12-at-12-08-30-AM.png | no response (curl timed out twice, 90s) | — | Live-Poll's README "Dashboard Preview". Could not be fetched, so it was never seen, so it is not a reference |

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure.

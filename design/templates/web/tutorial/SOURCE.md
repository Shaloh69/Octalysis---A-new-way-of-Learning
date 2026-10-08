# The first-run tour and its ? button — template source

Instructor, 8 Oct 2026: "add a ? button on top that auto runs on only first
ever log ins, its a tutorial. Find suitable templates online and do it."

`template.png` (1440) and `template-380.png` (380): **Driver.js**'s own home
page, **https://driverjs.com/**, captured 8 Oct 2026 with Playwright, HTTP 200,
title "Driver.js - Product Tours & Highlights in Vanilla JS", **with its tour
running** (the "Show Demo" button pressed, the popover "Before we start" open).
Opened before use. What rendered at both widths: the page dimmed; the element
being explained cut out of the dimness; a popover below it with a small arrow
to the element, a title, one short paragraph, and **Previous** / **Okay,
start!** buttons.

Also probed and not used: **Shepherd** (`shepherdjs.dev`, 200: a docs page, no
tour running on load); the first chat probe for this session was
`shadcn-chat.vercel.app`, which is the chat's reference, see `../chat/SOURCE.md`.

## What is taken

The STRUCTURE: dim, spotlight, a popover anchored to its target with an arrow,
"n of N", Previous / Next, and a way out. Driver.js's yellow, its type and its
fox are not taken; the dress is the star HUD's panel (`.hud-panel`: a hairline
with corner brackets), the accent ring on the spotlight (the student's own
place), the HUD face on the title.

## What is not taken: the library

The repo adds no UI library (root `CLAUDE.md`, "Do not add" and the short list of
allowed ones), so the tour is built by hand in `apps/web/src/shell/Tour.tsx`,
about 230 lines, and tested by `design/specs/web-tour.spec.ts`.

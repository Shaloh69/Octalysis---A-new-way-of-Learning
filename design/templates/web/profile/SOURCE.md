# `/app/profile` — template source

PROFILES (`docs/PROFILES-PLAN.md`, approved 7 Oct 2026, night): "For the web
students add a profile page where they can add profile images."

`template.png` is **Starfield's character menu**, interfaceingame.com
`/screenshots/starfield-character-menu/` (image
`/wp-content/uploads/starfield/starfield-character-menu.png`), captured 8 Oct
2026, HTTP 200, 1920x1080, **opened before use**. What rendered: the character
standing inside a thin **ring** at the centre; captioned panels around it (a
title over a hairline, a picture, labelled facts); the mission and key caps at
the foot. The direction folder already holds its sibling
(`_direction/star/starfield-character-menu-2.png`, used for `/app/progress`).

`starfield-character-creation.png` (same site, `/screenshots/starfield-character-creation/`,
HTTP 200, opened) is kept as the second reference: a "select profile" screen
whose foot carries the **employee number** as a labelled fact. It is where the
student number's treatment came from.

## What is taken

The ring around the person (the accent marks the student's own place); the
captioned panels (`.hud-panel` + `.hud-caption`, as `/app/settings`) holding
read-only facts; the number as a labelled fact in mono.

## What is not

The 3D portrait, the corner modules and the radial layout. A web profile is a
picture, three facts and a list of classes; it does not need Starfield's
character sheet, only its ring and its panels.

The picture's own controls (choose, position, zoom, use, remove) have no game
equivalent and follow the cropper pattern of every web avatar editor; the
reference for how that behaves is in `SPEC.md`.

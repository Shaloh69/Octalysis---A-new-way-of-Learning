# The galaxy (a student's star systems around a black hole) — template sources

Instructor, 7 Oct 2026 (night): a student with classes in several subjects,
each with its own teacher, has one star system per subject. "It will be a
different page. For the map it will be the solar systems orbiting a huge
black hole, with Enter Journey explaining: this star system is for the
subject, etc." Chats, summaries and course progress follow the star system.
Plan: `docs/COURSE-STUDIO-PLAN.md` §5 (CS2). Captured 7 Oct 2026 with
Playwright, every file opened and looked at.

| File | URL | HTTP | What rendered |
|---|---|---|---|
| `template.png` (1440) | https://niiflheim01.github.io/singularity/ ("Singularity \| 3D Black Hole Visualization") | 200 | A black hole at the centre, a wide accretion disc of streaks wound around it in warm-to-cool colour, a HUD title and status pill at the top, mono readouts in the corners |
| `template-380.png` | the same | 200 | The disc fills the width; **the corner readouts overlap each other** ("Singularity v1.0" over "RADIATION") — a defect, not copied |
| `template-orbs.png` (1440) | https://pyaimind.github.io/galaxy-template/ ("Galaxy Template — Interactive 3D Galaxy") | 200 | Glowing orbs ringed around a dark centre in a starfield; a sound toggle bottom left |
| `template-orbs-380.png` | the same | 200 | The ring of orbs centred, nothing cut off |
| `template-card.png` (1440) | the same, an orb clicked (`xy:720,571`) | 200 | A glass card over the scene: a title, a tag, a close button. **The "Enter Journey" moment** |

**Taken:** the black hole as the centre of the page, its disc as the
backdrop; each subject's star system as an orb on its own orbit around it
(the orbit, not decoration: the same Kepler rule the systems' planets keep,
`WEB-REVAMP.md` §4); choosing one opens a card that says what the system is
(the subject, its title, the teacher, the section, how far along the student
is) with **Enter Journey**; the HUD's readouts in mono. The accessible layer
of `VISUAL-SYSTEM-3D.md` §5 binds: every system is also a real button in a
list, reduced motion freezes the orbits and cuts the camera, no WebGL keeps
the list.

**Not taken:** the hearts and the pink glass (ours: the star HUD's panels,
`[data-realm="star"]`), the overlapping readouts at 380, the sound toggle as
it is (the app's audio settings own sound), Singularity's lensing post-effects
beyond what the performance budget allows.

**Rejected:** https://solarsystem-8e913.web.app/ (Orion Realms: a marketing
landing page; its Star Explorer, `/explorer`, still read "LOADING SYSTEM..."
after six seconds, so it showed no selection to take).

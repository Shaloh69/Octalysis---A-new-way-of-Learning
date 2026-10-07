# `/app/study` (the Study Session: a student's study sheets) — template source

Instructor, 7 Oct 2026 (night): a Study Session page where students make
custom study sheets from stages, topics, planets or moons, or with the AI's
help, edit them at will, and may share them with the class. Plan:
`docs/STUDY-AND-BOT-PLAN.md`.

**https://www.blocknotejs.org/demo** ("BlockNote - Javascript Block-Based
React rich text editor"), captured 7 Oct 2026 with Playwright, HTTP 200,
signed out (the URL gains a random room hash, e.g. `#zq3va`). Opened and
looked at:

- `template.png` (1440): a document card: a toolbar (who is editing,
  Share, Export, a panel toggle), the sheet's title and blocks, the "type
  '/' for commands" hint, and a COMMENTS side panel on the right.
- `template-380.png`: the side panel is gone, Share and Export become icons,
  and **the title breaks mid-word** ("Welcom / e to / BlockNo / te!"):
  a defect, recorded so it is not copied (our titles wrap at word breaks and
  scale down).

**Taken:** the STRUCTURE: one sheet as a document of blocks with a toolbar
(share with the class, export or print); a side panel that, for us, holds
the sources (stages, planets, moons, figures) and the AI's help instead of
comments; at 380 the side panel becomes a sheet opened from the toolbar.

**Not taken:** its colours and type, its live multi-cursor collaboration
(a sheet has one author; classmates read a shared copy), its comments.

**Rejected:** `https://novel.sh/` (captured 7 Oct 2026, HTTP 200, rendered
only "Application error: a client-side exception has occurred");
`https://www.blocknotejs.org/` (the home page: a marketing hero, the editor
only as a small illustration).

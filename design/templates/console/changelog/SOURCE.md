# /changelog (console) — template source

Instructor, 7 Oct 2026 (night): "Add Changelogs to both the admin/teachers and
student web to show the Updates We made. Also add all the progress of the
entire System there." Answers the same night: entries come from BOTH written
highlights and the full commit list; the console shows the build phases,
course readiness and the planned work.

| File | URL | HTTP | What rendered |
|---|---|---|---|
| `template.png` (1440) | https://ui.shadcn.com/docs/changelog ("Changelog - shadcn/ui") | 200 | A docs column: h1 Changelog, a one-line lede, then one dated update after another (an h2 per update, a bold lede, prose, "What changed" as a list); an "On This Page" index of the updates on the right |
| `template-380.png` | the same | 200 | One column; the index folds away; the updates stack |

Captured 7 Oct 2026 with Playwright (`scripts/.capture-ref.tmp.mjs`), opened
and looked at.

**Taken:** one reading column of dated updates, newest first, each a heading,
a short lede and "what changed" as a list; an index of the updates beside it
at 1440 (here: the progress sections and the months); nothing beside it at 380.

**Not taken:** the docs nav (the console's own shell is the nav), the RSS
button, code blocks, the Vercel advert, colours and type (ours).

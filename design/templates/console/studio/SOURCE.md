# Course Studio — template sources

Instructor, 7 Oct 2026 (night): the page where subjects, books and course
content are made and checked, with the AI in a separate sidebar; it takes in
`/content` and the planned `/assistant`. Plan: `docs/COURSE-STUDIO-PLAN.md`.
All captured 7 Oct 2026 with Playwright, opened and looked at.

| File | URL | HTTP | What rendered |
|---|---|---|---|
| `template.png` (1440) | https://ui.shadcn.com/view/new-york-v4/sidebar-15 ("sidebar-15 - shadcn/ui", a left AND a right sidebar) | 200 | A left tree (search, Ask AI, pages, favourites, workspaces), the content in the middle (placeholder cards), a right sidebar (a calendar and lists in the demo) |
| `template-380.png` | the same | 200 | Both sidebars fold away behind a toggle; the content alone, full width |
| `template-ai-menu.png` (1440) | https://www.blocknotejs.org/examples/ai/minimal ("Rich Text editor AI integration") | 200 | The editor with its AI menu opened by typing `/ai`: an "Ask AI anything…" box and commands (Continue Writing, Summarize, Add Action Items, Write Anything…). The extra line break mid-paragraph is from the capture's typing, not the page |
| `template-editor.png` (1440) | https://www.blocknotejs.org/demo (the Study Session's reference, reused) | 200 | One document of blocks with Share, Export and a side panel |

**Taken:** three panes: the course outline on the left (subjects → books →
chapters → blocks, objectives, figures, questions), the editor in the middle
(the existing block editor's rules: a reason and the version on every save),
the AI sidebar on the right; at 380 the outline and the AI are sheets opened
from the bar. In the editor, a command menu for the AI, whose every result is
a PROPOSAL with a diff that the teacher accepts or discards (nothing reaches
students unapproved, hard rule 5).

**Rejected:** https://prodly-henna.vercel.app (Prodly: three panels and AI
edits as proposals, exactly the model, but the demo is behind a sign-in; an
account on a third-party demo is not made).

**Not taken:** colours and type (ours, three themes), the demo's calendar,
emoji page icons, live multi-cursor collaboration.

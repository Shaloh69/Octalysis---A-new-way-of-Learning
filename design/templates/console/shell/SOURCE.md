# Source of template.png: the console shell

The shell is everything `AppShell.tsx` draws around a route: the sidebar, its
nav, the account block, and the 380 top bar with its menu. It is in every
console route's screenshot, which is why it was ordered before the routes that
remain (`CONSOLE-REVAMP.md` §3, #8).

Captured 2026-09-28 with Playwright (Chromium). Every URL answered **200** with
its final URL unchanged, and every PNG below was opened before anything was
built. shadcn-admin at 1440x900 and 380x844 after `networkidle` + 2.5s;
shadcn.io's previews after `domcontentloaded` + 4.5s (their `networkidle` never
settles). Floating site chrome on shadcn.io (fixed elements under 400x200) was
hidden before capture.

## Taken: shadcn-admin's own sidebar

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/ (the Dashboard) |
| `template.png` (1440) | A **256px sidebar**, full height, separate from the content. Top: a **team switcher**, a square logo mark, *Shadcn Admin* over *Vite + ShadcnUI*, a chevron. Then the nav **grouped under small muted headings**: *General* (Dashboard, Tasks, Apps, Chats with a count badge, Users, Secured by Clerk ›), *Pages* (Auth ›, Errors ›), *Other* (Settings ›, Help Center). The current item sits on a filled pill. At the **foot, pinned to the bottom of the viewport**: an avatar (initials), the name over the email, a chevron. The content column holds its own top bar (a sidebar toggle, tabs, search, theme, avatar) |
| `template-account-menu.png` | The foot opens a **menu upward**: the name and email again, *Upgrade to Pro*, then *Account / Billing / Notifications*, then **Sign out**, set apart by a separator and coloured as destructive |
| `template-collapsed.png` | The toggle collapses the sidebar to a **64px icon rail**: the logo, one icon per item, the avatar |
| `template-380.png` | No sidebar. A top row: the sidebar toggle, a menu button, search, theme, avatar. The page starts under it |
| `template-menu-380.png` | The toggle opens the sidebar as a **288px sheet from the left**, over a dimming scrim, with the same groups and the account pinned to its foot |

Measured in the page: sidebar `[left 0, width 256]`, content `[256, 1176]` at
1440; the sheet `[0, 288]` at 380; the rail `64` collapsed.

**Taken, as the instructor ruled after two tries:** the full-height column with
the account pinned to the window's foot, and the content scrolling beside it.
The first build let the sidebar stretch down the whole scrolling page ("nav bar
should not be this long"); a content-height sidebar looked worse ("just make the
layout of it the same as the templates just make the inner page itself
scrollable not the sidebar"). Ours is now the template's frame.

## Alternative kept: `sidebar-with-toggle-theme`

| | |
|---|---|
| URL | https://www.shadcn.io/preview/blocks/sidebar/sidebar-with-toggle-theme (`alt-with-toggle-theme.png`, `-380.png`) |
| Rendered | Brand block, one group (*Navigation*), and **the theme control pinned at the foot** (*Light mode*), not in a header. At 380 the bar holds the sidebar toggle and **the current page's name** (*Dashboard*) |
| Taken | The **current page's name in the 380 bar**. Ours reads "OCTA Console" on every route, which tells a teacher on a tablet nothing about where they are. The theme lives in the sidebar's own foot, not in a page header, since the console's routes have none |

## Rejected

| URL | Why not |
|---|---|
| `sidebar-education-lms` (`alt-education-lms.png`) | The nearest subject (a course; *Spring 2026* under the brand), but its groups are collapsible trees of individual courses. OCTA is one course and eleven flat pages; a tree would hide them |
| `sidebar-learning-platform` (`alt-learning-platform.png`) | Collapsible **groups**. Every group of ours is two to three items; a chevron that folds three links away saves nothing and costs a click on the page a teacher opens mid-class |
| `sidebar-with-footer-user` (`alt-with-footer-user.png`) | The same account foot as shadcn-admin, with less. Nothing to add |
| `sidebar-simple-groups` (`alt-simple-groups.png`) | Groups without icons. Our icons are how the 380 bar and a scanning eye find a page |

## How this was searched

shadcn.io's `/blocks` index links one block per family; the `sidebar-*` family
(**100 blocks**) was read from `sidebar-accounting-app`'s sibling links and
filtered for *education, learning, theme, footer-user, groups*. No block is a
teacher console. `ui.shadcn.com/blocks` offers `sidebar-01..16`, the same
anatomy shadcn-admin already shows.

## The "before" screenshots

`before.png` (1440, full page on `/gradebook`) and `before-380.png`,
`before-menu-380.png`, against seeded data. Seen in them: a plain text brand
("OCTA / Teacher console"); eleven flat items; the account, a native theme
`<select>` and Sign out stacked straight under the nav; **the sidebar scrolls
away with the page**, so on `/gradebook` it ends 600px down a 2285px page over
an empty column; at 380 a bare "OCTA Console" bar whose menu opens **inline**,
pushing the whole page 650px down with no scrim.

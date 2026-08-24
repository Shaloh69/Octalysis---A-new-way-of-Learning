# DESIGN-REFERENCES.md
### Real templates, real links, and what to take from each

Rule for all of these: **take the layout and the solved problems. Leave the identity.**
Every one of these ships with slate/blue + Inter everywhere. If you use any of them as-is,
OCTA looks like every other admin panel on the internet. Replace the token layer with
`packages/tokens` (three themes) before you build a single feature page.

---

## 1. Teacher console — primary

### `satnaing/shadcn-admin`
- **Repo:** https://github.com/satnaing/shadcn-admin
- **Live demo:** https://shadcn-admin.netlify.app
- **Overview page (with screenshots):** https://www.shadcn.io/template/satnaing-shadcn-admin

**Why this one.** <cite index="26-1">It's built with Shadcn (TailwindCSS + RadixUI) on Vite, with React Router, TypeScript, ESLint/Prettier and Tabler Icons — light and dark modes, responsive design, sidebar and header layouts, and 10+ pages.</cite> That matches our stack exactly; most alternatives are Next.js-first and would force a framework change.

**Take:** the app shell (sidebar + header + content), the **command palette** (a teacher jumping
between 40 students will live in it), the auth-page layouts, the settings pages, the theme
provider, and the data-table patterns.

**Leave:** its color tokens, its demo pages (tasks/apps/chats), its mock auth.

**One caveat, stated by the author:** <cite index="27-1">it's explicitly not positioned as a starter template, and some components are modified from stock shadcn/ui for RTL support and other improvements.</cite> So expect to do a little untangling, and don't assume a component matches upstream shadcn docs.

### Alternates if that one fights you

| Template | Link | Note |
|---|---|---|
| **ShadcnStore dashboard + landing** | https://github.com/shadcnstore/shadcn-dashboard-landing-template | <cite index="23-1">React + TypeScript + Vite and Next.js versions, shadcn/ui v3 and Tailwind CSS v4, and it includes both a dashboard and a marketing landing page.</cite> Attractive because it solves console *and* public site in one design language. |
| **TailAdmin React** | https://github.com/TailAdmin/free-react-tailwind-admin-dashboard · https://tailadmin.com/react | <cite index="6-1">React 19, TypeScript, Tailwind CSS v4, Vite.</cite> Bigger component set, less opinionated, larger community. |
| **shadcndashboard** | https://github.com/shadcndashboard/shadcndashboard | <cite index="24-1">React (Vite), Shadcn UI, Base UI and Tailwind CSS v4, with auth pages, form layouts with validation, data tables and user profile pages.</cite> |
| **rohitsoni007/shadcn-admin** | https://github.com/rohitsoni007/shadcn-admin | <cite index="22-1">Uses TanStack Router and Tailwind CSS 4 with the Vite plugin, with theme colors as CSS variables in `src/index.css`.</cite> Useful reference for the CSS-variable theming approach we need. |

**Browse more:** https://github.com/topics/shadcn-admin

---

## 2. Public site / landing

### Curated indexes worth opening before you pick
- https://adminlte.io/blog/tailwind-landing-page-templates/ — <cite index="29-1">20 free open-source Tailwind landing templates, all free for commercial use with live demos, spanning HTML, React/Next, Astro and Vue.</cite>
- https://colorlib.com/wp/tailwind-landing-page-templates/ — 32 templates, licenses listed per entry
- https://opentailwind.dev/blog/free-tailwind-css-landing-page-templates/ — screenshots + live demos per template
- https://github.com/topics/tailwind-css-template

### Specific picks

| Template | Link | License note |
|---|---|---|
| **Cruip Simple Light** | https://github.com/cruip/tailwind-landing-page-template | <cite index="29-1">Arguably the most forked SaaS landing template on GitHub — hero with illustration, features grid, testimonials, pricing, newsletter, footer.</cite> Clean, minimal, easy to strip. |
| **Cruip Open PRO** | https://github.com/cruip/open-react-template | <cite index="29-1">Animated hero, feature grid, testimonials, newsletter and footer on React/Next + Tailwind v4, with scroll-triggered reveals and micro-interactions. GPL licensed.</cite> **Check the GPL** before shipping — for a university project it's fine, but read it. |
| **Notus React** | via https://colorlib.com/wp/tailwind-landing-page-templates/ | <cite index="30-1">Creative Tim design system, MIT, and gives you a landing page + admin dashboard + auth pages in one consistent language.</cite> |
| **dave-hawkins/tailwind-landing-template** | https://github.com/dave-hawkins/tailwind-landing-template · demo https://tailwind-landing-template.vercel.app/ | <cite index="33-1">Entire template lives in a single `index.html`, scaffolded with create-vite, designed to slot into any default Tailwind project.</cite> Good if you want something you can fully read in ten minutes. |

**Honest recommendation:** OCTA's landing page shouldn't look like a SaaS landing page. The hero
should be the **17-stage course map**, live and interactive, because the content *is* the pitch.
Take a template's section rhythm and responsive breakpoints; write your own hero.

---

## 3. Component & pattern sources

| Need | Source |
|---|---|
| Base components | https://ui.shadcn.com |
| Blocks (dashboards, auth, sidebars) | https://ui.shadcn.com/blocks |
| Theme generator — build the three themes fast | https://tweakcn.com |
| Data tables (roster, item bank, gradebook) | https://tanstack.com/table |
| Charts (mastery curves, p-value distributions) | https://recharts.org · https://ui.shadcn.com/charts |
| Animation | https://motion.dev |
| Icons | https://tabler.io/icons · https://lucide.dev |
| Audio | https://howlerjs.com |

---

## 4. Design practices — the ones that actually matter here

### Typography
Don't ship Inter everywhere. Three roles, three jobs:
- **Display:** Space Grotesk — mechanical, engineered, not the usual geometric sans.
- **Body:** Inter or Source Sans 3 — neutral is correct where readability rules.
- **Data/code:** JetBrains Mono — and make it a *real* role. Machine code, assembly listings,
  register values, hex dumps, spec sheets, and **every number in a parameterized question**
  set in mono. That consistency is the design: in OCTA, monospace means *this is what the
  machine sees*.

Fonts: https://fonts.google.com/specimen/Space+Grotesk · https://www.jetbrains.com/lp/mono/

### Themes
Three, chosen by the student, persisted to `profiles.theme`:

| Theme | Background | Ink | Accent |
|---|---|---|---|
| **Bare Metal** (default) | `#0B0E11` | `#D7DEE6` | copper `#C4703B` |
| **Blueprint** | `#F2F4F7` | `#16222E` | drafting blue `#1F5F8B` |
| **Phosphor** | `#07100B` | `#8FE38F` | amber `#E0A93B` |

All three must pass WCAG AA. Automate the check in CI — don't eyeball it.

### The signature element
**The Register Bar.** A thin persistent strip across the top of every stage showing PC, IR, MAR,
MBR, ACC as live mono hex. Idles with a faint pulse in Stages 00–11, is genuinely live in 12–15,
and shows your question index as the PC during an assessment. It teaches register names by
osmosis over 14 weeks and makes the "bare metal" arc visible on every screen. **Spend your
boldness here and keep everything else quiet.**

### Motion
One orchestrated moment per stage, not scattered effects. Stage unlock traces a bus line from the
previous node (~700ms). The FDE cycle is the only place with continuous animation, because there
it *is* the content. Correct answers get a 120ms accent flash — no confetti on every question, it
degrades to noise by week 3. `prefers-reduced-motion` disables all of it.

### Accessibility floor (non-negotiable, and it's also a marking rubric item)
- WCAG 2.2 AA: https://www.w3.org/WAI/WCAG22/quickref/
- ARIA Authoring Practices, for the tab/dialog/combobox patterns you'll build:
  https://www.w3.org/WAI/ARIA/apg/patterns/
- Every drag interaction (matching, ordering) needs a **tap-to-select fallback**. A large share
  of your students are on phones.
- `aria-live="polite"` on answer feedback.
- Visible focus rings everywhere. Test one full stage keyboard-only before calling P9 done.

---

## 5. Security practices — read these before P0

The single highest-value external reading on this project.

| Source | Link |
|---|---|
| Supabase production checklist | https://supabase.com/docs/guides/deployment/going-into-production |
| Supabase RLS docs | https://supabase.com/docs/guides/database/postgres/row-level-security |
| MakerKit — RLS production patterns | https://makerkit.dev/blog/tutorials/supabase-rls-best-practices |
| Supabase security checklist for AI-built apps | https://ubserve.com/platform-guides/supabase-security-checklist-ai-built-apps |
| Pre-launch checklist | https://zeriflow.com/blog/supabase-security-checklist-before-launch |

**The three findings that apply directly to us:**

1. <cite index="48-1">CVE-2025-48757 affected 170+ production apps built with AI tools through a single missing RLS policy that compiled cleanly and passed manual code review — AI tools optimize for code that compiles, migrates and returns data, not for authorization correctness, which requires testing denied-access scenarios.</cite> **This is exactly our project.** Hence hard rule #8: test denial, not just success.

2. <cite index="50-1">A table with RLS enabled but no policies blocks all access except `service_role`, so always add at least one policy after enabling RLS; and for INSERT/UPDATE use `WITH CHECK` to validate what's being written.</cite> Our `profiles` update policy depends on exactly this to stop a student self-promoting to teacher.

3. <cite index="49-1">Supabase's built-in Security Advisor is a database linter that flags RLS disabled on public tables, RLS enabled with no policy, security definer views, functions with mutable search path, and sensitive columns exposed through the API — it's free and it's the fastest way to find the obvious holes.</cite> Run it at the end of every phase, not just before launch. Note our `is_stage_unlocked()` is `security definer` with an explicit `set search_path = public` — that's deliberate, and the advisor will be happy with it.

Also: <cite index="49-1">Storage buckets are private by default and enforce policies on every operation including downloads; only mark a bucket public when the files are genuinely meant for the open web.</cite> Our diagram and audio buckets stay private except `/public/audio`, which is genuinely public.

And from the auth hardening list: <cite index="51-1">enable email enumeration protection, set your Site URL and remove default wildcard redirect entries, and disable public signup if your app is invitation-only.</cite> **Ours is invitation-only** — signup goes through the roster-gated API, so public signup must be off in the Supabase dashboard.

---

## 6. Feedback & usability measurement practices

The teacher feedback system (see `PAGE-SPECS.md` §4) uses the **System Usability Scale** as its
quantitative backbone, because it's the instrument a thesis panel will recognise.

- SUS reference: https://www.usability.gov/how-to-and-tools/methods/system-usability-scale.html
- Template + scoring: https://formbricks.com/survey-templates/system-usability-scale
- Maze template: https://maze.co/templates/system-usability-scale-test/

**What the research says, and how it shapes the design:**

- <cite index="40-1">SUS is 10 standardized statements rated 1–5 that produce a single 0–100 score, created in 1986 with robust benchmarking data behind it.</cite> <cite index="36-1">Average product scores sit around 68.</cite> That gives you a number to defend and a benchmark to defend it against.
- <cite index="40-1">Survey only after meaningful use — SUS measures usability perception, which requires experience, and a user who just logged in cannot meaningfully rate the ten statements.</cite> → **Trigger gate: ≥3 sessions and ≥1 completed core workflow.**
- <cite index="40-1">Aim for at least 20 responses for reliable averages, and don't over-interpret small differences.</cite> → With a handful of teachers you will *not* hit n=20. Be honest about that in the writeup, and extend the survey to student respondents to get a usable sample.
- <cite index="36-1">Passive feedback widgets typically see 1–3% response rates, while well-targeted in-context popups pull 5–15%.</cite> → **Do not rely on a passive "Feedback" button alone.** The contextual flag and the inline bad-question report are what will actually get used.
- <cite index="37-1">Watch for double negatives and confusing language, and have someone else proofread the items.</cite> → SUS items 2, 4, 6, 8 are negatively phrased by design; render them verbatim, don't "fix" them, and score them inverted.

Complementary lightweight instruments, if you want a second signal:
- **CSAT**, one question after a completed workflow ("How was setting up this assessment?")
- **CES** (Customer Effort Score) — arguably better than NPS for an internal tool, since nobody
  "recommends" software their university mandates.

Skip NPS. "Would you recommend this to a colleague?" is close to meaningless for a required
course tool, and a panel will ask why you used it.

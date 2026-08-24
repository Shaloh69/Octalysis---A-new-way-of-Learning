# START-PROMPT.md

Copy the block below into Claude Code as your **very first message**, in a fresh session, from
the repo root.

Do not add anything to it. Do not ask it to start building in the same message. The whole point
is that it reads and argues before it writes.

---

```
Read START-HERE.md, CLAUDE.md, docs/MASTER-PLAN.md, docs/VERIFICATION.md, and
db/schema.sql completely before writing any code. Do not skim. Then also read
docs/LESSON-PLAN-AND-LEVELS.md — it defines the four stage archetypes and the
level system, and it corrects an earlier design that did not fit the source
material.

When you're done reading, do NOT start building. Reply with the following and
then stop:

1. A one-paragraph summary of what OCTA is, in your own words.

2. The eight hard rules from CLAUDE.md, restated in your own words, with one
   sentence each on how you could violate it by accident.

3. Explain, in your own words, why a student's paper is unique but still fair.
   If you can't state the fairness argument clearly, you haven't understood the
   blueprint and you should re-read MASTER-PLAN.md §3.

4. Three things in db/schema.sql you think are underspecified or that you'd
   design differently, and why. Be blunt — I want disagreement here, not
   agreement. Note that VERIFICATION.md already documents nine findings that
   have been applied; don't just repeat those. Find new ones.

5. Every environment variable the system needs, split into client-safe and
   server-only.

6. Your proposed order of work for Phase P0 only, as a checklist, with the six
   RLS denial tests named explicitly.

Then stop and wait for my go-ahead. Do not create files, do not run commands,
do not scaffold anything in this session.

Context you need up front:
- pnpm monorepo. apps/web + apps/console (Vite/React/TS -> Vercel),
  services/api (Fastify/TS -> Render), Supabase Postgres.
- The single most important invariant: a student's browser must never be able to
  obtain an answer key, a locked or unpublished stage's content, or another
  student's data.
- The app this replaces shipped every answer to the browser in a lessonData.js
  bundle. That is the bug we exist to fix. Treat it as the thing most likely to
  recur.
- I would rather you tell me something is a bad idea than build it silently.
```

---

## Why the prompt is shaped this way

**Step 4 is the load-bearing one.** If it comes back agreeing with everything, it did not read
the schema, and you should re-run the session rather than proceed. A model that has genuinely
read 20KB of DDL will have opinions about it.

**Step 3 exists because the fairness argument is the thesis.** If Claude Code can't articulate
why different papers are still equivalent, it will build a random-draw generator, which is the
single most damaging thing it could get wrong — it would look correct and be unfair.

**Ending with "stop and wait"** is what prevents an eager scaffold. The failure mode on a project
this size is a confident, good-looking monorepo that quietly has the security model wrong.

## After it replies

Read its three disagreements carefully. Accept the good ones and update the docs before you
build — a doc fix costs a minute now and a migration later.

Then, in the same session, give it the P0 prompt from `docs/PHASES.md`.

One phase per session. `/clear` between phases. Every session ends with:

> **"Which parts of this did you actually run, and what are you unsure about?"**

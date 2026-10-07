# The assistant as a chat bot, and the Study Session — plan v1, APPROVED in its rulings 7 Oct 2026 (night); §4's features await the instructor's pick; nothing built

Instructor, 7 Oct 2026 (night):

> "For the Assistant Bot, if not in the AI Assistant page, he is also a chat
> bot. Find templates online for that too." … "Students too, to help them
> during studying for exams. A Study Session page also, where they can make
> custom study sheets from different stages, topics, planets or moons, or
> ask the AI for help; of course students can edit and change at will; can
> also be shared with the class. This AI is the one that is the API in
> Render, so that students don't need to install the AI Assistant app." …
> "Like in the teacher, use multiple engines that we can move to if one runs
> out. Remember to have it remember from last session. The rules from the
> teacher AI still apply here."

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | Who talks to the bot outside `/assistant` | **Teachers, the admin AND students** |
| 2 | What it does | **Answers from the book; helps use OCTA; starts drafting jobs (teachers); reports on the teacher's own classes**; and "think of features that could help immensely during classes or management of classes" (§4, proposed) |
| 3 | Where a TEACHER's bot runs | **Through the teacher's own app**, on their keys and token log (round six). With the app offline the bubble says "Connect your AI Assistant to chat" |
| 4 | Where the STUDENT bot runs | **On the API on Render**, so students install nothing. **An engine chain** like the teacher's (move on when one runs out). **It remembers from the last session.** **Every rule of the teacher AI applies** (`.claude/rules/assistant.md`) |
| 5 | A student's daily limit | **Set by the teacher, per class** (default 30 messages) |
| 6 | A study sheet shared with the class | **Shown at once, removable** by a teacher (audited), as profile pictures |
| 7 | The student's own mistakes | **Yes, their own only**: graded answers, never an open paper, never another student's |

Templates, captured and opened 7 Oct 2026: `design/templates/web/assistant-bot/`
(and the console's copy) and `design/templates/web/study/`.

## 1. The student bot (API on Render)

- **The engine chain comes back to the API, for students only.** The code
  built and retired the same night (`f1d87d3`: one `draft()`, four adapters,
  the chain; `.claude/rules/assistant.md`) is the starting point. Its keys
  are the **instructor's, in Render's environment** (`ANTHROPIC_API_KEY`,
  `OLLAMA_API_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_*`), never in a table, never
  `VITE_*`. Only engines that do not train on or keep input. Teachers' own
  keys stay in their app (round six); the two never mix.
- **Memory (plan §4a's principle):** no engine remembers; OCTA does. Per
  student, a running summary of what they studied and where they struggle,
  plus the last few turns, saved after each reply; never the full transcript
  sent back.
- **Grounded:** it answers from **approved** lesson text, approved figures
  and the book's text the teacher uploaded, with the page or section it came
  from; outside the course it says so. Never `items.correct_value` beyond the
  student's own graded answers (RLS already allows those after submit).
- **Off during a sitting (hard rule 9):** the bubble does not exist on a
  stage check, an exam or Lecture Mode, and **the API refuses a student's
  message while they have an open attempt**, so another tab cannot reach it.
- **Limits:** per class, set by the teacher (default 30 a day); every reply
  records engine, model, tokens and cost per student; the teacher sees their
  class's totals.
- **Denial tests, red first:** a student reads only their own conversation
  and memory; no reply while an attempt is open; another student's mistakes
  never reach the context; anon gets nothing.

## 2. The Study Session `/app/study` (student)

- **A study sheet** is the student's own document of blocks (headings, text,
  lists, a figure, a definition, a worked step). They build it by **adding
  from sources** (a stage, a topic, a planet, a moon: approved lesson text
  and figures, quoted with their source) or by **asking the AI** (the student
  bot drafts a section from those sources; the student keeps, edits or
  deletes it). Edited at will; saved to the server (never `localStorage`
  for anything shared).
- **Share with the class:** a read-only copy classmates see at once; a
  teacher can unshare it (audited); the author can unshare it too.
- **Never gradeable, never on a paper.** A sheet is study material, not
  course content: it is labelled as the student's (and "AI-assisted" where
  the AI wrote a block), so hard rule 5 is not bent.
- **Off during a sitting**, like the bot.

## 3. The teacher's bot (through their app)

The same bubble in the console. A message goes to Supabase; the teacher's
app picks it up, calls the engines on the teacher's keys, and replies. It can
answer from the book, help with OCTA, start a drafting job, and report on the
teacher's **own** classes (T2's scoping), through API routes on the teacher's
own session. With the app offline: "Connect your AI Assistant to chat".

## 4. Features PROPOSED for class time and class management (not yet chosen)

Each uses data OCTA already holds; none decides a lock, a grade or an item
by itself (hard rules 1, 4, 5):

1. **Misconception digest after a check:** every distractor names a real
   misconception (`services/api/CLAUDE.md`), so the bot can say "a third of
   2A chose the 'forwarding fixes every hazard' answer" and point to the
   lesson that answers it.
2. **Who is stuck:** students whose mastery on an objective has not moved,
   or who have not opened the current stage, per class.
3. **The pre-class brief:** before a lecture, the stage of the day, who has
   finished it, the three things the class missed most.
4. **Unlock suggestions:** "2A averages 82% on stage 03; unlock 04?"; the
   teacher decides on `/locks` (hard rule 4: the bot never unlocks).
5. **A review sheet for the class:** a study sheet drafted from the class's
   most-missed objectives, which the teacher edits and shares.
6. **Warm-ups for Lecture Mode** from **approved** practice items on the
   class's weak objectives (never unapproved questions).
7. **Message drafts** to the class chat (an announcement, a nudge to
   inactive students); the teacher sends them, never the bot.
8. **Gradebook explainer:** "why does Ana have 71?", from the components.
9. **For students: explain-my-mistake** (their own graded answers) and
   **quiz-me** from moons' approved practice only, labelled practice.
10. **Feedback digest:** the week's platform feedback, grouped, for the admin.

## 5. Order and what is still open

**APPROVED (instructor, 7 Oct 2026, night: "do the proposed order"):** T1
(teachers) → profiles → T2 (own classes) → the student bot and the Study
Session (they need the class scoping and per-class limits) → the assistant's
app and the teacher's bot.

Open: which of §4 to build, and in what order; whether a teacher may read a
student's bot conversations (privacy; proposed: no, totals only, as the
admin with teachers' logs).

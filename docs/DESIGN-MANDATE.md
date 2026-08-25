# DESIGN-MANDATE.md
### Every interaction earns its place. The checklist that proves it.

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

---

## 1. The mandate

> **A control exists only if pressing it changes what the student knows, can do, or can see.
> If it only changes a number, delete it.**

Four tests. Any control that fails one gets cut, not redesigned.

| Test | Question | Fails if |
|---|---|---|
| **Consequence** | Does the system state differ after this press? | It only increments a counter |
| **Legibility** | Can the student predict what will happen *before* pressing? | The label is a verb with no object ("Continue", "Go") |
| **Reversibility** | Can they undo it, or is the risk stated up front? | It silently commits something graded |
| **Teaching** | Does the interaction itself carry meaning? | The same UI would work for a history quiz |

The fourth test is the strict one and the one worth holding. Stage 09's bit-toggles teach two's
complement *by being toggles*. A dropdown listing "127, -128, 255" would test the same fact and
teach nothing. **When the interaction and the concept are the same shape, you've designed it
right.**

### Applied — things this rule kills

- ❌ "Continue" buttons that only scroll. Content scrolls; a button means commitment.
- ❌ XP counters. They change a number and nothing else. (This is why OCTA has none.)
- ❌ Confetti per question. No state change, no meaning, and it's noise by week three.
- ❌ A "Start" button on a stage page. Arriving *is* starting.
- ❌ Difficulty labels that don't change item selection.

### Applied — things it demands

- ✅ Every lock states its reason and the distance: *"Unlocks when Stage 09 reaches 70%. You're at 45%."*
- ✅ **Re-roll** exists because it changes the numbers — real consequence, and it's the honest way to practise a concept rather than memorise an answer.
- ✅ **Predict-before-run** in Stages 13 and 15: you commit a guess, then step. The commit is the assessment.
- ✅ Submitting the POST asks once. It's the only confirmation dialog in the student app.

---

## 1B. The gaming mandate

`GAME-DESIGN.md` is the full treatment. These are the rules that bind every page.

### What kind of game this is

**Gameful design, not gamification, and not a serious game.** Game *design* is
used to make the real activity legible and motivating; game *tokens* are not
bolted onto an unchanged activity. This is why OCTA has no XP, no currency and no
global leaderboard, and it is not squeamishness — those are the elements that
research cannot show produce learning, and the ones that read as manipulative.

The genre OCTA resembles is **Zachtronics** — Turing Complete, TIS-100,
Shenzhen I/O — not Duolingo. Those games have no points and no avatars. What
they have is a real system with real rules and the freedom to solve it wrongly
first, and the satisfaction is *comprehension*.

### The five rules

1. **Theatre dresses the practice. It never dresses the assessment.**
   `STAGE-ENCOUNTERS.md` already says vary the practice, keep the assessment
   steady. Visual language obeys the same rule: a lab may be a pixel-art
   workbench; the Self-Test that follows is the same calm flat surface every
   time. **No encounter theme class may appear on an assessment route**, and
   that is a test, not a request.

2. **A skin must say something true.** Stage 02's switchboard is honest because
   the deck describes literal switches. Stage 15's DOS skin is honest because the
   toolchain is 16-bit TASM. A theme chosen only because it looks different is
   decoration, and decoration fails the mandate's fourth test.

3. **Spectacle is capped at one moment per stage.** The Bring-Up, two seconds,
   once. Adding a second celebration does not double the feeling; it halves the
   first one.

4. **The game layer may never be the only carrier of meaning.** Every fact the
   3D scene expresses — state, depth, prerequisite — exists in text on the flat
   route and in the star dialog. A `<canvas>` has no accessibility semantics at
   all.

5. **A playful mechanic is safe when its VERB is the objective's verb.**
   Flipping bits IS representing a number; wiring gates IS building an adder.
   Those are content, not decoration, and they can be as playful as you like.
   Collecting coins while answering questions is not the objective — that is a
   **seductive detail**, and the research is clear that interesting-but-unnecessary
   material *measurably reduces* comprehension and transfer, even when it does
   not visibly disrupt the lesson. The test is in `GAME-DESIGN.md` §8.3.

6. **Difficulty comes from the material, never from the interface.** A student
   fighting a drag interaction is not learning about cache associativity. Every
   drag has a tap fallback and a keyboard path; that is a floor, not a feature.

### What this explicitly does not authorise

Streaks that punish · hearts or lives · timers on anything graded · loot boxes or
random rewards attached to grades · a mascot with a face · confetti per question ·
sound effects on failure. Every one of these was on the anti-pattern list before
the gaming layer existed, and adding a galaxy does not change the argument.

---

## 2. Introductions — earn the interface before it appears

Every new interaction gets a **30-second first-run**, once, at the moment of first use. Never a
tour, never a modal carousel at signup.

| Element | Introduced at | Form |
|---|---|---|
| Stage map | Stage 00 | Two locked nodes light in sequence — "this is how unlocking looks" |
| Register Bar | Stage 00 | Idles. Unlabelled. **Deliberately unexplained** — curiosity, and it pays off in Stage 12 |
| Depth Gauge | Stage 00 | Present but dim. **Named only in Stage 11**, ten weeks later. That reveal is designed. |
| Re-roll | Stage 07 | The first drill item arrives already re-rolled once, with the numbers visibly changing |
| Card sort | Stage 01 | Two cards pre-placed as worked examples |
| Node canvas | Stage 10 | One gate pre-wired; you complete the second half |
| Code editor | Stage 15 | Loaded with a working program. Run it first, then modify it |
| Self-Test | Stage 01 | One practice item in the real format, ungraded, labelled as practice |

**The rule:** a student must have used an interaction at least once, ungraded, before it can
appear in something scored.

**INV-31:** every interaction component has a registered first-run, and no graded item uses a
format the student hasn't met ungraded. Checkable, and worth checking.

---

## 3. Animation specification

The whole motion vocabulary is in `packages/tokens/tokens.css`. Nothing outside this table.

| Moment | Token | Duration | Curve | Notes |
|---|---|---|---|---|
| Correct answer | `--dur-flash` | 120ms | `--ease-out` | Accent flash on the chosen option. That's all. |
| Incorrect answer | — | 0ms | — | **No motion.** A left border and a calm rationale. Never red, never a shake. |
| Hover / toggle | `--dur-fast` | 160ms | `--ease-out` | |
| Panel, sheet, dialog | `--dur-base` | 240ms | `--ease-out` | |
| Stage unlock | `--dur-trace` | 700ms | `--ease-inout` | A bus line traces from the previous node to the new one |
| **Bring-Up** | `--dur-bringup` | 2000ms | `--ease-inout` | Subsystem fades in, one jingle. **Once per stage. The only celebration.** |
| FDE stepper | — | tempo-linked | linear | The only continuous animation, because here motion *is* the content |
| Depth Gauge descent | `--dur-trace` | 700ms | `--ease-inout` | Stratum lights, gauge scrolls one notch |
| POST submit | `--dur-bringup` | 2000ms | `--ease-inout` | Gauge lights bottom to top. Once per semester. |

**`prefers-reduced-motion` sets every duration to 0ms** — already wired in `tokens.css`. Verify
by toggling the OS setting and running a full stage; state must still change, just instantly.

**Library:** Motion (`motion.dev`) for orchestration. Do not add GSAP, Lottie, or a second
animation library — the vocabulary above needs none of them.

---

## 4. The avatar system — a character that means something

The brainstorm template warns against a "childish arcade skin." A mascot with a face fails that.
But a student should still have a *presence*.

### Seeded from the student ID — the same principle as their exam paper

<cite index="35-1">DiceBear turns any string into an SVG avatar; the same seed always produces the same avatar, so you store a string instead of an image and never ask users to upload a profile picture.</cite>

Seed it with `student_id`. That gives you a thematic tie nobody has to explain: **your face and
your exam paper come from the same seed.** Uniqueness you didn't choose, but that's yours.

**Style — pick by register:**

| Style | Feel | License |
|---|---|---|
| **`identicon`** ← recommended | <cite index="32-1">Symmetrical pixel-grid patterns in a single colour on a tinted background — the classic identicon look popularised by developer tools and version control hosts.</cite> Technical, adult, zero cuteness. | <cite index="32-1">CC0 1.0</cite> |
| `rings` / `shapes` / `thumbs` | Abstract, quiet | <cite index="40-1">CC0, public domain, no attribution</cite> |
| `bottts` | Modular robot heads — if you genuinely want a creature | <cite index="40-1">Free commercial use</cite> |

**Recommendation: `identicon`, tinted with the student's accent hue.** It reads as a developer
tool, not a game, and it composes with the accent system you already have. Offer `bottts` as an
alternate in settings if you want the option — that's Ownership (Petal 4) at zero cost.

**Self-host, don't call the API.** <cite index="40-1">Prefer the npm package so avatars are generated client-side or at build time — no API rate limits, no latency, no external dependency.</cite> A lecture hall on campus wifi should not wait on `api.dicebear.com`.

**Attribution:** <cite index="40-1">DiceBear core is MIT; each visual style has its own license, and CC-BY styles require visible credit.</cite> Identicon is CC0 so nothing is required — credit it on `/about` anyway.

### Where the avatar appears

Their own profile, their notebook cover, their certificate, and cohort study-pair matching.
**Never in Lecture Mode aggregates** — those are anonymous, and a recognisable avatar defeats
that.

---

## 5. Per-page checklist

Two layers: a universal gate every page must clear, then page-specific must-haves.

### 5.1 Universal — no page ships without all nine

- [ ] **Six states** implemented: loading (skeleton, not a spinner), empty, locked, error, offline, saving
- [ ] **380px** wide with no horizontal scroll and no clipped controls
- [ ] **Keyboard-only** completable, visible focus on every interactive element
- [ ] **All three base themes AND every encounter theme** pass WCAG AA, verified by computation
      not by eye. A theme that fails contrast does not ship
- [ ] **Zero literal hex** — every colour from `packages/tokens` (the hook enforces this)
- [ ] **Mono for every number**, register value, hex, listing
- [ ] **`prefers-reduced-motion`** honoured
- [ ] **Every control passes the four tests** in §1
- [ ] **Error copy says what happened and how to fix it** — no bare codes, no stack traces

### 5.2 Public

| Page | Must have |
|---|---|
| `/` | Live 17-node map as hero · **re-rollable sample item** (the one interaction that sells the product) · "Sign in with your student ID", not "Get started free" |
| `/course` | All 19 stages with objectives, act, prereqs, minutes |
| `/how-it-works` | The fairness argument in plain language · re-roll demo repeated |
| `/for-teachers` | Roster, lock matrix, analytics, gradebook, feedback loop — with screenshots |
| `/accessibility` | What's supported, what isn't yet, how to report a barrier |
| `/about` | **Octalysis framework credit to Yu-kai Chou** · instructor credit · full third-party license list incl. every audio file and avatar style |
| `/login` | One field: "Student ID or email" · **identical error for unknown user and wrong password** · 60s cooldown with visible countdown after 5 failures |
| `/register` | ID + email + password · **identical error for unknown ID and already-claimed ID** · password rules shown before typing |

### 5.3 Student

| Page | Must have |
|---|---|
| `/app` | Dependency graph, not a progress bar · **locked nodes state reason + distance** · read-only preview of next stage's objectives · resume card · Register Bar idling |
| `/app/stage/:id` | Archetype-correct beat sequence · figures verbatim in mono · objectives checklist · add-to-notebook · lock card names the prerequisite |
| `/app/stage/:id/check` | One item per screen · **tap fallback on every drag** · autosave every answer · `aria-live` verdict · hint tokens · re-roll on wrong · **no answer key in any response body** |
| `/app/stage/:id/results/:id` | Per-objective breakdown · every item with their answer and the correct one · direct "review this" links · what unlocked |
| `/app/final` | Item palette (answered / flagged / unanswered) · review-before-submit · server-enforced window · **one confirmation** |
| `/app/lab/*` | Predict-before-run · break-it-on-purpose · works at 380px · keyboard operable |
| `/app/notebook` | Auto-curated · **PDF export** · avatar on cover |
| `/app/mistakes` | Grouped by objective · spaced-repetition order · **re-roll into a fresh variant** |
| `/app/progress` | **7×3 competency grid** · compare-to-past-self only, never peers · competency-named badges, no XP |
| `/app/settings` | Theme (live preview) · 12 accent presets · per-channel audio (ambient defaults 0) · reduce motion · avatar style |

### 5.4 Console

| Page | Must have |
|---|---|
| `/console/roster` | CSV import with **dry-run preview** · claim status · audit_log on every write |
| `/console/students/:id` | **The exact variant regenerated from their seed** · their answer vs correct · time on item |
| `/console/locks` | Students × stages grid · **reason prompt on every toggle** · three visual states · hover shows who and why |
| `/console/items` | Stats inline (p-value, discrimination, exposures) · **preview instance with re-roll** · review queue |
| `/console/items/:id/edit` | Confirm dialog says **"stats do not carry over"** in those words |
| `/console/live/present` | Large type, high contrast, **no names ever** |
| `/console/feedback` | "My feedback" with status and **"Released in v1.4.2"** badge · admin triage tab |
| `/console/audit/system` | Invariant results, on-demand run, failing checks link to offending rows |

---

## 6. Cross-reference: where each design decision comes from

| Decision | Source | Doc |
|---|---|---|
| Console shell | [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) · [demo](https://shadcn-admin.netlify.app) | `DESIGN-REFERENCES.md` §1 |
| Landing rhythm | [Cruip Simple Light](https://github.com/cruip/tailwind-landing-page-template) | §2 |
| Components | [ui.shadcn.com](https://ui.shadcn.com) · [blocks](https://ui.shadcn.com/blocks) | §3 |
| Theme building | [tweakcn.com](https://tweakcn.com) | §3 |
| Tables / charts | [TanStack Table](https://tanstack.com/table) · [Recharts](https://recharts.org) | §3 |
| Motion | [motion.dev](https://motion.dev) | this file §3 |
| Avatars | [dicebear.com](https://www.dicebear.com) · [identicon](https://www.dicebear.com/styles/identicon/) | this file §4 |
| Icons | [Tabler](https://tabler.io/icons) · [Lucide](https://lucide.dev) | `DESIGN-REFERENCES.md` §3 |
| Illustrations | [unDraw](https://undraw.co) · [Open Peeps](https://www.openpeeps.com) (CC0) | `LESSON-HANDLING.md` §5 |
| Audio | [Kenney](https://kenney.nl/assets) (CC0) · [Howler](https://howlerjs.com) | `DESIGN-REFERENCES.md` §4 |
| Colour system | OKLCH, fixed L per theme | `packages/tokens/tokens.css` |
| Accessibility | [WCAG 2.2 quickref](https://www.w3.org/WAI/WCAG22/quickref/) · [ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/) | `DESIGN-REFERENCES.md` §4 |
| Contrast checking | [inclusivecolors.com](https://www.inclusivecolors.com) | `GAME-LAYER.md` §4 |

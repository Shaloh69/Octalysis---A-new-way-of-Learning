# Anti-cheat during a paper — what a web page can and cannot do (15 Oct 2026)

Instructor, 15 Oct 2026: *"Add a new anti cheat. Detect keys or switching to a new desktop also, like the
Windows key, Ctrl and arrow keys and switching. Research what could be done on both phone and PC to avoid
cheating as much as possible."*

This builds on hard rule 9 (a paper is sat behind Start, in full screen; leaving hands it in) and ruling 4
(15 s away hands it in). Everything below is a **fact recorded in `attempt_events` for the instructor to
read** (append-only, API-written, staff-read, shown on `/students/:id` and `/attempts/:id`). Nothing new
fails a student by itself; the 15-second rule that already existed is the only automatic consequence.

## 1. Built today (in every stage check, moon check and exam)

| Signal | How the page sees it | What happens | Event |
|---|---|---|---|
| Windows / Command key, alone or in a chord (Win+D, Ctrl+Win+←/→ desktops) | `keydown` `Meta`/`OS`, `metaKey` | paper covered at once, recorded | `system_key` |
| Alt+Tab, Alt+Esc | `keydown` with `altKey` | covered, recorded | `system_key` |
| Ctrl+Alt+Arrow; Ctrl+Arrow outside a text field (desktop/Space switching) | `keydown` | covered, recorded (Ctrl+Arrow in an answer field is a word jump and ignored) | `system_key` |
| PrintScreen | `keyup` | covered, recorded | `system_key` |
| **The window loses focus while still visible** (Alt+Tab, Start menu, **another virtual desktop**, a second monitor, a dev-tools window) | `window` `blur` | covered, recorded; **away over 15 s hands it in** (the same rule as leaving the page) | `lost_focus` |
| Copy, cut, paste, drag, right-click, print, Ctrl+S/U/P, F12, Ctrl+Shift+I/J/C | events and keys | **refused**, a toast says so, recorded | `blocked_action` |
| Split screen, a floating window, a second screen | window width drops by a quarter (rotation ignored); `screen.isExtended` | recorded | `screen_changed` |
| The same paper in a second tab | `BroadcastChannel` per attempt | recorded | `second_tab` |
| Tab/app hidden, full screen left, page closed | (since 30 Sep / 6 Oct) | as before: covered / handed in | `left_page`, `left_fullscreen`, `closed` |

**Keyboard Lock** (Chrome and Edge, only in script-entered full screen): the runner asks the browser to
deliver Alt+Tab, the Windows key, Esc and the arrows to the page instead of the OS, so they are *seen*
(and covered) rather than only felt as a lost focus afterwards. Where the browser refuses, the `blur`
rule still catches the switch. Source: [Chrome, Keyboard Lock API](https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock).

Tested: `apps/web/test/sitting-guards.spec.ts` (the key rules, 9), `design/specs/web-stage-check.spec.ts`
"anti-cheat" (5, in a real browser; mutation-checked: removing the key listener turned 3 red),
`services/api/test/attempt-events.spec.ts` (the five kinds are the owner's to write, never staff's or
another student's; a lost focus counts as a leave). SQL: `db/addendum-sitting-guards.sql`.

## 2. What a web page cannot do, honestly

- **It is never told that the OS switched desktops.** It sees its own window lose focus or be hidden. That
  is enough to catch it (a switch always takes focus), and it is what we record.
- **It cannot stop** the Windows key, Ctrl+Alt+Del, Alt+Tab or a desktop switch (outside Keyboard Lock).
  It can only notice, cover and record.
- **It cannot see another device**: a phone photographing the screen, a classmate, notes on paper. No
  software on the student's own device can.
- **It cannot reliably detect a virtual machine, remote desktop or screen sharing** from a browser.
- On **iPhone**, full screen does not exist for pages (hence `fullscreen_unavailable`); the app switcher
  and Control Centre are seen only as the page being hidden or blurred.
- Every signal can be produced innocently (a notification steals focus; a laptop docks to a monitor). That
  is why each is a fact for the instructor, not a verdict.

## 3. Phone

| What | Web page today | Stronger option |
|---|---|---|
| Switching apps, Control Centre, notifications | `visibilitychange`/`blur`: covered, recorded, 15 s hands in | — |
| Split screen / floating window (Android, iPad) | width collapse: recorded | — |
| Screenshots | **not detectable** from a web page on iOS or Android | an installed app can (Android `FLAG_SECURE` blocks them; iOS can only be notified) |
| Leaving the browser at all | covered and recorded | **iOS Guided Access** (Settings → Accessibility → Guided Access, then triple-click the side button) and **Android App pinning** (Settings → Security → App pinning) lock the phone to one app until a passcode. Free, built in, no install. The instructor can require it for an exam and check it at the door |

## 4. PC

| What | Web page today | Stronger option |
|---|---|---|
| Other apps, desktops, monitors | `blur` + keys: covered, recorded, 15 s hands in | **Safe Exam Browser** (free, open source, Windows/macOS/iOS): a kiosk that blocks task switching, virtual desktops, screenshots, other apps and VMs. Would need a `.seb` config and the API to check SEB's request header; a real piece of work, and only worth it for supervised exams in a lab |
| Second monitor | `screen.isExtended` (Chrome/Edge): recorded | SEB refuses to start with one |
| Developer tools | keys refused; a determined student can still open them from the menu | SEB |

## 5. What OCTA already does that matters more than any lock

- **Every student gets a structurally different paper** from their own seed, so a copied answer is the
  answer to someone else's question.
- **The key never reaches the browser** (hard rule 1), so there is nothing in the page to read.
- **Leaving hands the paper in** (ruling 4): looking something up costs the attempt.

## 6. Ruled by the instructor, 15 Oct 2026 (later) (asked with the question tool)

1. **Guided Access / App pinning: yes, on every paper** (not only exams). The start prompt of every stage
   check, moon check and exam carries one more rule (`[data-rule=device-lock]` in `AttemptRunner`'s
   `StartPrompt`): turn on Guided Access (iPhone, iPad) or App pinning (Android) before you start; your
   instructor may check. Words only: a page cannot tell whether it is on. Tested in
   `design/specs/web-stage-check.spec.ts`.
2. **Safe Exam Browser: plan it.** Its plan is `docs/SAFE-EXAM-BROWSER-PLAN.md`, stopped for approval;
   nothing is built.
3. Camera proctoring: not proposed (unchanged, see below).
4. **No new signal hands a paper in.** Facts only; the 15-second rule stays the one automatic consequence.

The questions as they were put:

## 6a. The questions (15 Oct 2026)

1. **Require Guided Access / App pinning on phones for exams**, and say so on the start prompt? (Words only;
   nothing to build but the sentence.)
2. **Safe Exam Browser for the Prelim, Midterm and Finals** in a lab? (A config file and a header check in
   the API; its own small plan.)
3. **Camera proctoring** is deliberately not proposed: it records students' faces and rooms, is weak against
   a second device anyway, and is a privacy decision for the department, not a feature.
4. Should any of the new signals **hand the paper in** (today only leaving for 15 s does)? Recommendation: no.
   A notification or a docked monitor would then cost an honest student an attempt.

Also consulted: vendor descriptions of virtual-desktop and VM detection in lockdown browsers
([Talview](https://docs.talview.com/candidates/system-diagnostics/talview-secure-browser-tsb-compatibility/why-am-i-seeing-a-virtual-desktop-detected-error-in-the-secure-browser),
[OctoProctor](https://octoproctor.com/blog/what-is-lockdown-browser-and-how-it-work)): they need an installed
browser, which is the line between §1 and §4.

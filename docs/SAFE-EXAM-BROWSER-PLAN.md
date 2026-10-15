# Safe Exam Browser for the exams — plan v1, 15 Oct 2026 (for approval; nothing built)

Instructor, 15 Oct 2026 (question tool, `docs/ANTI-CHEAT.md` §6.2): **"Yes, plan it."**

## 1. What it buys

Safe Exam Browser (SEB, free, open source; Windows, macOS, iOS) is a kiosk browser. While it runs, the student
cannot switch tasks, change virtual desktop, take a screenshot, open another app, or use a second monitor. On
Windows it refuses to start inside a virtual machine. That is the line a web page cannot cross (`ANTI-CHEAT.md`
§2). It covers **PCs in a lab**. It does **not** cover Android, where there is no SEB. Phones keep Guided
Access / App pinning (§6.1, now said on every paper).

## 2. Scope (proposed)

- **Only the three exams:** Prelim, Midterm, Finals, the global papers of ruling 4. Stage checks and moon
  checks stay open in any browser: they are sat at home, where SEB would only lock students out.
- **Per exam, a switch**, set by the admin on `/assessments`: *Requires Safe Exam Browser*. Off by default.

## 3. How the API knows it is SEB (to be verified before building)

SEB can attach `X-SafeExamBrowser-ConfigKeyHash` to its requests: SHA-256 of the requested URL concatenated
with the exam's **Config Key**. The server recomputes that hash from the stored key and the URL, and compares
([SEB, Config Key](https://safeexambrowser.org/developer/seb-config-key.html)). The hash changes with every URL
and every config, so it cannot be replayed from one page to another.

**The open technical point.** OCTA is a single-page app on Vercel calling an API on Render. The header protects
the requests SEB makes to the *page*, and it is not yet known whether SEB adds it to the page's `fetch` calls to
another origin. Since SEB 3.0 (macOS, iOS) and 3.4 (Windows), the page can also ask SEB for the keys itself
(the JavaScript API Moodle's integration uses). The page could then send the hash to the API with
`POST /attempts`. **Step 1 of the build is a spike** on a real Windows SEB 3.x: a test exam, a test config, and
a record of which of the two reaches the API. Nothing else is built before that answer.

## 4. The pieces, once the spike answers

| Piece | What |
|---|---|
| SQL (`addendum-seb.sql`) | `assessments.requires_seb boolean default false`; the Config Key in a **service-role-only** table like `assessment_secrets` (RLS on, no policy) |
| API | at `POST /attempts` and every answer and submit of a `requires_seb` exam: verify the hash, else 403 *"This exam is sat in Safe Exam Browser."* A failed check is an `attempt_events` fact |
| `.seb` file | made once in SEB's own Config Tool (start URL = the exam's page, quit password the instructor's, no URL filter beyond OCTA's two hosts and the API). Kept by the instructor, never in the repo (it carries the quit password) |
| Console | the switch on an exam's row (admin), and where the Config Key is pasted (write-only; never shown back) |
| Web | the exam's start prompt says *"Open this exam in Safe Exam Browser"* when it is required and the page is not in SEB |

## 5. Tests (rule 8, red first)

A request without the header, with a wrong hash, with a hash for another URL, and with a hash for another
exam's key is refused. An exam with the switch off is unaffected. A stage check is never affected.

## 6. Asked with this plan

1. Exams only, as in §2? Or stage checks too, when they are sat in the lab?
2. Who holds the `.seb` file and the quit password: the instructor alone?
3. Does the lab have Windows PCs where SEB 3.x can be installed? (The spike needs one.)

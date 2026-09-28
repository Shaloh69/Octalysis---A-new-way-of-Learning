# Source of template.png

`TEMPLATE-LINKS.md` said **"No template, deliberately"** for
`/console/attempts/:attemptId` (2 Sep 2026): it is a document, "the right
reference is a printed exam paper", and an admin card/table pattern would make
it worse. The reasoning about the SHAPE stands. The conclusion does not: root
`CLAUDE.md` says a template is an artifact, never a reason. So a real graded
paper was captured, 29 Sep 2026: a published LMS page that shows one
student's handed-in quiz, marked, with their answer and the key.

## What was tried

| Lead | Result |
|---|---|
| Moodle's quiz **Review attempt** page (`review.php`), via MoodleDocs: https://docs.moodle.org/502/en/Using_Quiz, https://docs.moodle.org/502/en/Quiz_reports | **Rejected: not capturable.** Both timed out at 45s waiting for `networkidle`, twice (a bot challenge in front of MoodleDocs, by the look of it). The staff-side page is the closest analogue there is, and it is behind a login everywhere else |
| Oxford Brookes' "In Focus: Moodle Quiz (7) – Reporting", https://telsupport.brookes.ac.uk/in-focus-moodle-quiz-7-reporting/ | **Rejected: nothing to take.** 200, 15 images; none is a review-attempt page (grades report, statistics and manual grading only) |
| Tufts' "How do I view and grade student submissions in New Quizzes?", https://tuftsedtech.screenstepslive.com/s/18992/m/73355/l/1319282-how-do-i-view-and-grade-student-submissions-in-new-quizzes | **Rejected.** 200; its screenshots are SpeedGrader fragments (a comment editor, a points box). That is a marking tool; this page marks nothing |
| **Instructure's Canvas Student Guide, "How do I view quiz results as a student?"**, https://community.canvaslms.com/t5/Student-Guide/How-do-I-view-quiz-results-as-a-student/ta-p/335 | **Taken.** Below |

## The paper: `template.png`, `template-question.png`

| | |
|---|---|
| URL | https://community.canvaslms.com/t5/Student-Guide/How-do-I-view-quiz-results-as-a-student/ta-p/335 (the same images are served by Arkansas State's mirror, https://kb.astate.edu/books/canvas-student-how-tos/page/how-do-i-view-quiz-results-as-a-student) |
| Captured | 2026-09-29, Playwright (Chromium), `networkidle` + 1.5s. HTTP **200**, URL unchanged. The article's figures are Instructure's own screenshots of a Canvas quiz results page |
| `template.png` | The figure titled **"View Quiz Results"**, 855×698, fetched from its `src` (`us.v-cdn.net/…/088ddd46-….png`, 200) |
| `template-question.png` | The figure titled **"View Correct Answers"**, 617×442 (`…/d47381fe-….png`, 200) |
| `template-page.png`, `template-page-380.png` | The article itself at 1440×1500 and 380×1900, scrolled to the figure, so the capture shows where it came from. A OneTrust cookie banner sits over the lower left of both; it does not cover the figure |
| Rendered, `template.png` | One student's quiz results as a document: the quiz's facts on one line (due, points, questions, time limit, attempts allowed); **"Correct answers are hidden."** in a banner when the key is withheld; then **Score for this attempt: 4 out of 11 · Submitted Apr 10 at 9:10am · This attempt took 19 minutes**; then the questions, each a card headed **"Question 1 … 0 / 1 pts"**. To the right, a **Last Attempt Details** box: Time, Current Score, Kept Score |
| Rendered, `template-question.png` | One question: **"Question 5 · 0 / 1 pts"** heading a card, the stem, then the options in order with labels beside them: **"You Answered"** on the one they chose, **"Correct Answer"** on the key |
| Opened | Both PNGs and both page captures were opened and looked at before `SPEC.md` was written |

## What we take

- **A document, top to bottom.** Facts, then the questions in the order they
  were sat. No table, no tabs, no cards-as-dashboard.
- **The attempt's facts in words and numbers at the top**: score, when it was
  handed in, how long it took. Our facts box sits beside the paper at 1440,
  where Canvas puts *Last Attempt Details*.
- **A withheld key is a sentence, not an absence.** *"Correct answers are
  hidden."* is exactly the in-progress case: the page says why there is no key.
- **Each question is headed by its number and its result**, then the stem,
  then every option in the order they saw, **labelled** "their answer" and
  "key" in words beside the option, not by colour alone.

## What we do not take

- **Red for a wrong answer.** Canvas flags "Incorrect" and "You Answered" in
  red. Root `CLAUDE.md`: an incorrect answer gets a neutral response, never
  red, and this page goes on a projector. Ours is the word *Not correct*.
- **Points per question** ("0 / 1 pts"). Every OCTA item is worth one; the
  count correct says it.
- **Kept score / take the quiz again.** Those are the student's controls. This
  page has none of them: it changes nothing.
- The fonts and colours. Ours are `packages/tokens`.

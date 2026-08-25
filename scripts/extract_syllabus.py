# -*- coding: utf-8 -*-
"""OCTA -- read the CPE 412 teaching plan out of the syllabus DOCX.

WHY DOCX AND NOT THE PDF.

The PDF is a landscape table. `pdftotext -layout` interleaves the columns, so a
unit outcome comes out fused to an unrelated topic heading -- 93 fragments, none
cleanly transcribable, and chapter 18 vanished entirely because its topic cell is
empty. The DOCX keeps table cells as discrete XML. No reconstruction, no
guessing, no possibility of inventing content -- which matters, because hard rule
5 forbids exactly that.

THREE THINGS WORD DOES THAT NAIVE EXTRACTION GETS WRONG.

1. `cell.text` joins paragraphs and loses the bullet structure. Iterate
   `cell.paragraphs` instead.

2. `paragraph.text` SILENTLY DROPS <w:br/>. The syllabus uses soft breaks
   between chapter blocks, so whole topic groups ran together invisibly. Walk
   the XML and map <w:br/>, <w:cr/> and <w:tab/> to newlines.

3. The author typed several topics into ONE paragraph -- "Computer Memory System
   Overview" and "Characteristics of Memory Systems" share a line. Word kept
   them as separate RUNS, and the run boundary sits exactly on the semantic
   split. `cell_lines()` below recovers it, conservatively: see the four
   conditions there, each of which exists to prevent a false split that was
   observed in the real file.

Usage:  python scripts/extract_syllabus.py <path-to-docx>   -> JSON on stdout
"""

import io
import json
import re
import sys

import docx
from docx.oxml.ns import qn

# Windows defaults stdout to cp1252, which turns Intel's U+2019 apostrophe into
# U+FFFD before the caller ever sees it -- and that lands in a stage file.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="")

VERBS = (
    "Define", "Differentiate", "Illustrate", "Discuss", "Elaborate", "Outline",
    "Examine", "Identify", "Present", "Compute", "List", "Draw", "Compare",
    "Enumerate", "Explain", "Understand", "Summarize", "Describe", "Provide",
    "Distinguish", "Name", "State", "Analyze", "Apply", "Determine", "Classify",
    "Interpret", "Demonstrate", "Design", "Recall", "Solve", "Use", "Evaluate",
    "Assess", "Justify",
)

BREAKS = {qn("w:br"), qn("w:cr"), qn("w:tab")}


def norm(s):
    """Collapse runs of whitespace (NBSP included) and strip bullet glyphs."""
    s = re.sub(r"[^\S\n]+", " ", s.replace(" ", " "))
    return s.strip().strip("•●·-*– \t")


def run_text(run):
    """A run's text WITH its breaks. run.text drops <w:br/> silently."""
    buf = []
    for node in run._element.iter():
        if node.tag == qn("w:t"):
            buf.append(node.text or "")
        elif node.tag in BREAKS:
            buf.append("\n")
    return "".join(buf)


def cell_lines(cell, run_rule=False, protect_first=False):
    """Every bullet in a table cell, one per list entry.

    An explicit <w:br/> ALWAYS ends an entry. That alone is enough for every
    column except the topics outline, where the author typed several topics onto
    one line; `run_rule` turns on the extra recovery described below.

    THE RUN RULE IS FOR TOPIC LISTS ONLY. Outcomes are sentences, and running it
    there truncated "Discuss the evolution of Intel's Cache memory and ARM Cache
    Organization" at "...ARM Cache" -- the tail was emitted as its own entry
    and then dropped by the verb filter, silently losing an outcome. Title Case
    is a property of headings, not of prose, so the rule has no business in a
    prose column.

    `protect_first` additionally exempts the cell's FIRST paragraph. In the
    topics column that paragraph is the chapter title, and titles are the other
    place the rule reliably misfires: "Top Level View of Computer Function and |
    Interconnection" satisfies every condition and is still wrong.

    A run boundary splits only when ALL of these hold. Each condition exists
    because dropping it produced a wrong split in the real file:

      a. the next run starts with a capital letter  -- topics are Title Case
      b. the previous run ends with a literal space -- the author's separator
      c. the previous run is not whitespace-only    -- else "The | Memory
                                                      Hierarchy" splits, since
                                                      Word emits ' ' as its own
                                                      run constantly
      d. at least two words accumulated             -- a lone capitalised word
                                                      is never a topic

    Verified against chapter 4, whose topics exercise every branch:
    "Cache Size | Mapping Function" splits, "The Memory Hierarchy" does not.
    """
    out = []

    def flush(text):
        t = norm(text)
        if t:
            out.append(t)

    for pi, p in enumerate(cell.paragraphs):
        runs = p.runs
        cur = ""
        may_split = run_rule and not (protect_first and pi == 0)
        for i, run in enumerate(runs):
            t = run_text(run)

            if may_split and i > 0 and cur.strip():
                prev = run_text(runs[i - 1])
                if (
                    t[:1].isupper()                   # a
                    and prev.endswith(" ")            # b
                    and prev.strip() != ""            # c
                    and len(cur.split()) >= 2         # d
                ):
                    flush(cur)
                    cur = ""

            # An explicit break always ends the current topic.
            if "\n" in t:
                chunks = t.split("\n")
                cur += chunks[0]
                for c in chunks[1:-1]:
                    flush(cur)
                    cur = c
                if len(chunks) > 1:
                    flush(cur)
                    cur = chunks[-1]
            else:
                cur += t
        flush(cur)
    return out


def main():
    doc = docx.Document(sys.argv[1])
    rows = []
    for table in doc.tables:
        if len(table.columns) != 7:
            continue
        for r in table.rows:
            cells = r.cells
            outcomes = cell_lines(cells[1])
            topics = cell_lines(cells[2], run_rule=True, protect_first=True)
            if not topics:
                continue
            rows.append({
                "cilo": " ".join(cell_lines(cells[0])),
                # Unit outcomes are written verb-first; anything else in that
                # column is a heading or a stray, and is not an outcome.
                "outcomes": [o for o in outcomes if o.split()[0] in VERBS],
                "outcomes_raw": outcomes,
                "topics": topics,
                "time": " ".join(cell_lines(cells[6])),
            })
    print(json.dumps(rows, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

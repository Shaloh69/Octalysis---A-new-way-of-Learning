# -*- coding: utf-8 -*-
"""OCTA -- slice the course textbook into per-chapter source text.

WHY NOT CONVERT TO DOCX FIRST.

The obvious move is PDF -> DOCX -> read the DOCX, and there is a good free tool
for it (`pdf2docx`, MIT). It is the wrong step here, and it would actively lose
information:

  * This PDF is a clean Adobe InDesign export with a REAL TEXT LAYER -- 1.9
    million characters, no OCR needed -- and a 216-entry embedded outline giving
    the exact first page of every chapter and section. Nothing has to be
    guessed.
  * DOCX conversion is a LAYOUT reconstruction. It infers paragraphs, columns
    and tables from glyph positions, and on an 864-page textbook it will get
    some of that wrong. Every error it introduces is an error I would then
    transcribe into a lesson as though the book had said it.
  * A round trip through DOCX would DISCARD the outline, which is the single
    most useful thing in the file -- it is what makes "chapter 4 starts at page
    145 and ends at 189" a fact rather than a heuristic.

So: read the text layer directly, cut on the outline, keep the page numbers.
Fewer moving parts, and every span is traceable back to a page.

WHAT THIS DOES NOT DO. It does not write lesson content. It produces SOURCE
text, which `sync-content.mjs --verify` then diffs authored blocks against, so a
quoted definition can be proven to appear in the book character for character.
Hard rule 5 is unchanged: the book is now a source, not a licence to paraphrase
from memory.

Usage:  python scripts/extract_book.py <pdf> <outdir>
"""

import io
import json
import os
import re
import sys

import pymupdf

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="")

CHAPTER_RE = re.compile(r"^Chapter\s+(\d+)\s+(.*)$", re.I)


# Characters InDesign leaves in the text layer that are INVISIBLE on the page.
# They matter more than they look: `sync-content.mjs --verify` proves an authored
# quote appears in the source character for character, and a soft hyphen sitting
# inside "direct-mapped" makes an exact quote fail to match a phrase a reader
# would swear is identical. 429 soft hyphens and 218 zero-width spaces in the
# cache chapter alone.
INVISIBLE = {
    "­": "",   # SOFT HYPHEN -- a hyphenation hint, not a hyphen
    "​": "",   # ZERO WIDTH SPACE
    " ": " ",  # EN SPACE
    " ": " ",  # EM SPACE
    " ": " ",  # THIN SPACE
    " ": " ",  # HAIR SPACE
    " ": " ",  # NO-BREAK SPACE
}

# Ligatures the book sets as single glyphs. No reader would ever type these, so
# a quoted span containing one could never be matched.
GLYPHS = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}

# A bulleted item whose lead word is bold arrives as U+25A0 on BOTH sides:
#   "■Data■      processing: Data may take a wide variety of forms"
# PyMuPDF cannot map either glyph from the symbol and bold-font subsets, so both
# come out as a filled square. Replacing U+25A0 with "-" everywhere -- the
# obvious fix -- produced "-Data- processing:", which reads as a hyphenated
# compound and would be quoted that way into a lesson.
BOLD_BULLET = re.compile(r"■\s*([^■\n]{1,40}?)\s*■\s*")

# Running heads. These sit at a page boundary and therefore land IN THE MIDDLE
# of a sentence once wrapped lines are joined:
#   "...first introduced in 1970 and 1.2 / Structure and Function 3 included a
#    number of models."
# Left pages carry "4  Chapter 1 / Basic Concepts", right pages carry
# "1.2 / Structure and Function  3". Both must go BEFORE lines are joined, while
# each is still alone on its own line.
RUNNING_HEAD = re.compile(
    r"^[ \t]*(?:"
    r"\d+\.\d+\s*/\s*.+?\s+\d{1,3}"      # right page: section / title  page
    r"|\d{1,3}\s+Chapter\s+\d+\s*/\s*.+?"  # left page:  page  Chapter N / title
    r"|\d{1,3}\s+Part\s+\w+.*?"
    r")[ \t]*$",
    re.M | re.I,
)


def clean(text: str) -> str:
    """Undo the artefacts of a two-column-aware text extraction.

    Each of these was observed in this specific file; none is speculative, and
    the ORDER matters -- running heads have to go while they are still alone on
    a line, before wrapped lines are joined into paragraphs.
    """
    for bad, good in INVISIBLE.items():
        text = text.replace(bad, good)
    for bad, good in GLYPHS.items():
        text = text.replace(bad, good)

    # 1. Running heads and bare folios, while the line structure still exists.
    text = RUNNING_HEAD.sub("", text)
    text = re.sub(r"^[ \t]*\d{1,3}[ \t]*$", "", text, flags=re.M)

    # 2. Bulleted items with a bold lead word.
    text = BOLD_BULLET.sub(lambda m: "- **%s** " % m.group(1).strip(), text)
    text = text.replace("■", "- ").replace("•", "- ")

    # 3. Leading indentation from the PDF's text frames.
    #
    # THIS MUST COME BEFORE THE JOINS, and getting the order wrong is silent.
    # Every continuation line in this book arrives indented, and both joins
    # below refuse to fire across whitespace -- so with the strip last, "pro-\n
    # grammer" stayed broken across a line and would have been quoted into a
    # lesson with the hyphen still in it.
    text = re.sub(r"^[ \t]+", "", text, flags=re.M)

    # 4. Hyphen split across a line break: "archi-\ntecture" -> "architecture".
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

    # 5. A single newline inside a sentence is a wrap, not a paragraph break.
    text = re.sub(r"(?<![.!?:;])\n(?![\n\s])", " ", text)

    # 6. Collapse leftover runs.
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main() -> None:
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    doc = pymupdf.open(pdf_path)
    toc = doc.get_toc()

    # Chapter boundaries, from the outline. A chapter runs to the page before
    # the next chapter (or appendix) begins.
    chapters = []
    for lvl, title, page in toc:
        t = re.sub(r"\s+", " ", title).strip()
        m = CHAPTER_RE.match(t)
        if m:
            chapters.append({
                "n": int(m.group(1)),
                "title": m.group(2).strip(),
                "start": page,
                "sections": [],
            })
        elif re.match(r"^(Appendix\s+[A-Z]:|References|Index|Credits|Glossary)", t, re.I) and chapters:
            # Bounds the LAST chapter. Note the `[A-Z]:` -- a BOOK-level
            # appendix ("Appendix A: Projects for Teaching...") ends the
            # chapters, but a CHAPTER appendix ("Appendix 4A Performance
            # Characteristics of Two-Level Memories") belongs to its chapter and
            # must not. Treating both alike silently dropped 8 pages from
            # chapter 4 and 4 from chapter 12 -- and 4A is exactly the
            # two-level-memory maths the syllabus asks for in chapter 4.
            chapters[-1].setdefault("hard_end", page)

    # Section headings, so each chapter file carries the book's own structure.
    for lvl, title, page in toc:
        t = re.sub(r"\s+", " ", title).strip()
        sm = re.match(r"^(\d+)\.(\d+)\s+(.*)$", t)
        if not sm:
            continue
        for ch in chapters:
            if ch["n"] == int(sm.group(1)):
                ch["sections"].append({"num": f"{sm.group(1)}.{sm.group(2)}",
                                       "title": sm.group(3).strip(), "page": page})
                break

    chapters.sort(key=lambda c: c["start"])
    for i, ch in enumerate(chapters):
        nxt = chapters[i + 1]["start"] if i + 1 < len(chapters) else None
        end = ch.get("hard_end") or nxt or doc.page_count + 1
        ch["end"] = end - 1

    manifest = []
    for ch in chapters:
        parts = []
        for pno in range(ch["start"], min(ch["end"], doc.page_count) + 1):
            # `sort=True` reads in reading order rather than raw draw order,
            # which is what keeps a two-column page from interleaving.
            parts.append(doc[pno - 1].get_text("text", sort=True))
        body = clean("\n".join(parts))

        fname = "ch-%02d.md" % ch["n"]
        with io.open(os.path.join(out_dir, fname), "w", encoding="utf-8", newline="\n") as f:
            f.write("<!-- SOURCE TEXT, NOT LESSON CONTENT.\n")
            f.write("     Stallings, Computer Organization and Architecture, 10th ed.\n")
            f.write("     Chapter %d: %s (pdf pages %d-%d)\n" % (ch["n"], ch["title"], ch["start"], ch["end"]))
            f.write("     Extracted by scripts/extract_book.py. Gitignored: copyrighted.\n")
            f.write("-->\n\n")
            f.write("# Chapter %d — %s\n\n" % (ch["n"], ch["title"]))
            if ch["sections"]:
                f.write("## Sections\n\n")
                for s in ch["sections"]:
                    f.write("- %s %s (p%d)\n" % (s["num"], s["title"], s["page"]))
                f.write("\n")
            f.write(body)
            f.write("\n")

        manifest.append({
            "n": ch["n"], "title": ch["title"],
            "start": ch["start"], "end": ch["end"],
            "chars": len(body), "sections": len(ch["sections"]), "file": fname,
        })

    with io.open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

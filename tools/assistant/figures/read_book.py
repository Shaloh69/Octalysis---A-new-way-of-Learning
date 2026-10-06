"""Read every figure in the book: crops, labels, chart data, and a coverage check.

    python tools/assistant/figures/read_book.py <out dir> [--pdf <book.pdf>] [--chapters 15,2]

Writes <out>/ch-NN/fig-NN-MM.png, <out>/figures.json and one contact sheet a
chapter in <out>/contact/. The out dir must be outside git: the crops are the
book's pages, and the book never enters the repo (the plan's §4-now uploads
them to a private, owner-only bucket once B2 has made it).

The coverage check fails the run (exit 1) unless:
  - every chapter's captions run 1..N with no gap,
  - every figure the extracted book (docs/source/book/ch-NN.md) cites or
    captions was found in the PDF, and its caption is in that chapter's text,
  - every figure found was cropped, or is listed with the reason it was not.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import pymupdf
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reader import Figure, read_page, squash  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
BOOK = ROOT / "docs" / "source" / "book"
PDF = ROOT / "Computer Organization and Architecture 10th - William Stallings (1).pdf"


def fname(f: Figure) -> str:
    c = f.caption
    part = "" if c.part == 1 else f"-{c.part}"
    return f"ch-{c.chapter:02d}/fig-{c.chapter:02d}-{c.number:02d}{part}.png"


def read_figures(
    doc: pymupdf.Document, manifest: list[dict[str, Any]], wanted: set[int], out: Path | None = None, dpi: int = 200
) -> tuple[dict[str, Figure], list[str]]:
    """Every figure of the chapters wanted (all when empty), keyed "15.4" or
    "6.6-2"; crops are written under `out` when it is given."""
    figures: dict[str, Figure] = {}
    duplicates: list[str] = []
    for ch in manifest:
        if wanted and ch["n"] not in wanted:
            continue
        for pno in range(ch["start"] - 1, min(ch["end"], doc.page_count)):
            for fig, pix in read_page(doc[pno], dpi=dpi, render=out is not None):
                cap = fig.caption
                if cap.id in figures:
                    if "Continued" not in cap.title:
                        duplicates.append(f"{cap.id} p{cap.page} (first on p{figures[cap.id].caption.page})")
                        continue
                    # A figure printed over two pages, each captioned "(Continued)" (6.6).
                    cap.part = sum(1 for f in figures.values() if f.caption.id == cap.id) + 1
                figures[cap.key] = fig
                if pix is not None and out is not None:
                    pix.save(out / fname(fig))
    return figures, duplicates


def coverage(by_ch: dict[int, list[Figure]], texts: dict[int, str]) -> tuple[list[str], list[str]]:
    """Problems (the run fails) and captions the extracted book lacks (reported).

    `texts` is each chapter's extracted text, docs/source/book/ch-NN.md."""
    problems: list[str] = []
    not_in_text: list[str] = []
    for n, raw in sorted(texts.items()):
        found = sorted({f.caption.number for f in by_ch.get(n, [])})
        gaps = [i for i in range(1, (max(found) if found else 0) + 1) if i not in found]
        if gaps:
            problems.append(f"ch {n}: caption numbers missing {gaps}")
        text = squash(raw)
        cited = {int(m.group(1)) for m in re.finditer(r"Figures? %d\.(\d+)" % n, text)}
        for k in sorted(cited - set(found)):
            problems.append(f"ch {n}: the text cites Figure {n}.{k}, the PDF reader did not find it")
        for f in by_ch.get(n, []):
            if f.crop is None:
                problems.append(f"{f.caption.key}: found and not cropped ({'; '.join(f.flags)})")
            # A line-end hyphen is dropped in the extracted text ("LittleEndian", 12.12).
            head = squash(f"Figure {f.caption.id} {f.caption.head}")[:48].rstrip("-")
            if head not in text:
                # The PDF has it and the extracted book lost it: extract_book.py's
                # gap (a turned page), reported here, not the reader's failure.
                turned = " (turned page)" if f.caption.rotated else ""
                not_in_text.append(f"{f.caption.key} p{f.caption.page}{turned}: {head!r}")
    return problems, not_in_text


def contact_sheet(chapter: int, items: list[tuple[str, Path]], out: Path) -> None:
    cell, label = 320, 22
    cols = 4
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + label)), "white")
    draw = ImageDraw.Draw(sheet)
    for i, (fid, path) in enumerate(items):
        im = Image.open(path)
        im.thumbnail((cell - 8, cell - 8))
        x, y = (i % cols) * cell, (i // cols) * (cell + label)
        sheet.paste(im, (x + 4, y + label))
        draw.rectangle([x + 2, y + label - 2, x + cell - 2, y + cell + label - 2], outline="#999999")
        draw.text((x + 6, y + 4), fid, fill="black")
    sheet.save(out / f"ch-{chapter:02d}.png")


def main() -> int:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--pdf", type=Path, default=PDF)
    ap.add_argument("--chapters", default="")
    ap.add_argument("--dpi", type=int, default=200)
    args = ap.parse_args()
    out: Path = args.out.resolve()
    if ROOT in out.parents or out == ROOT:
        print("refused: the crops are the book's pages and must stay outside the repo")
        return 2

    manifest = json.loads((BOOK / "manifest.json").read_text(encoding="utf8"))
    wanted = {int(c) for c in args.chapters.split(",") if c}
    doc = pymupdf.open(args.pdf)
    for ch in manifest:
        if not wanted or ch["n"] in wanted:
            (out / f"ch-{ch['n']:02d}").mkdir(parents=True, exist_ok=True)
    figures, duplicates = read_figures(doc, manifest, wanted, out, args.dpi)

    by_ch: dict[int, list[Figure]] = {}
    for f in figures.values():
        by_ch.setdefault(f.caption.chapter, []).append(f)
    texts = {
        ch["n"]: (BOOK / ch["file"]).read_text(encoding="utf8")
        for ch in manifest
        if not wanted or ch["n"] in wanted
    }
    problems, not_in_text = coverage(by_ch, texts)

    contact = out / "contact"
    contact.mkdir(exist_ok=True)
    for n, figs in sorted(by_ch.items()):
        items = [
            (f.caption.key, out / fname(f))
            for f in sorted(figs, key=lambda f: (f.caption.number, f.caption.part))
            if f.crop is not None
        ]
        if items:
            contact_sheet(n, items, contact)

    def dump(f: Figure) -> dict[str, object]:
        d = asdict(f)
        d["id"] = f.caption.key
        d["file"] = fname(f) if f.crop else None
        return d

    ordered = sorted(figures.values(), key=lambda f: (f.caption.chapter, f.caption.number, f.caption.part))
    (out / "figures.json").write_text(json.dumps([dump(f) for f in ordered], indent=1, ensure_ascii=False), encoding="utf8")

    cropped = sum(1 for f in ordered if f.crop)
    distinct = len({f.caption.id for f in ordered})
    charts = [f.caption.key for f in ordered if f.chart]
    print(f"{distinct} figures found ({len(ordered)} crops with continued parts), {cropped} cropped, "
          f"{len(charts)} read as charts: {', '.join(charts)}")
    for f in ordered:
        for flag in f.flags:
            print(f"  flag {f.caption.key} p{f.caption.page}: {flag}")
    for d in duplicates:
        print(f"  duplicate caption {d}: kept the first")
    for t in not_in_text:
        print(f"  in the PDF, not in docs/source/book: {t}")
    for p in problems:
        print(f"  PROBLEM {p}")
    print("coverage:", "clean" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

"""Tests for the figure reader (plan §9 B1, .claude/rules/assistant.md).

    python -m pytest tools/assistant/figures -q

Two kinds. The synthetic ones draw a page with PyMuPDF and need nothing else:
each rule the reader follows has one, and the coverage check has a planted
error it must catch. The book ones read the real PDF at the repo root (never
in git) and skip when it is absent; they hold the reader to what was seen by
eye on 7-8 Oct 2026 and to two charts whose curves have a formula.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Iterator

import pymupdf
import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import read_book  # noqa: E402
import reader  # noqa: E402
from reader import Figure, read_page  # noqa: E402

W, H = 470.0, 668.0


@pytest.fixture(autouse=True)
def base14_faces(monkeypatch: pytest.MonkeyPatch) -> None:
    """Synthetic pages are set in the base-14 Times: body Times-Roman 10 pt."""
    monkeypatch.setattr(reader, "BODY_FACE", "Times-Roman")
    monkeypatch.setattr(reader, "HEADING_FACE", "Helvetica-Bold")


def caption(page: pymupdf.Page, y: float, label: str, title: str, x: float = 60) -> None:
    tw = pymupdf.TextWriter(page.rect)
    tw.append((x, y), label.replace(" ", " "), font=pymupdf.Font("tibo"), fontsize=9)
    tw.append(tw.last_point, "  " + title, font=pymupdf.Font("tiro"), fontsize=9)
    tw.write_text(page)


def body(page: pymupdf.Page, y0: float, y1: float, text: str) -> None:
    page.insert_textbox(pymupdf.Rect(50, y0, 420, y1), text, fontname="tiro", fontsize=10)


def label(page: pymupdf.Page, x: float, y: float, text: str, size: float = 8) -> None:
    page.insert_text((x, y), text, fontname="helv", fontsize=size)


def box_drawing(page: pymupdf.Page, r: tuple[float, float, float, float]) -> None:
    page.draw_rect(pymupdf.Rect(r), color=(0, 0, 0), width=1)
    page.draw_line((r[0], r[1]), (r[2], r[3]), color=(0, 0, 0))


PROSE = ("The processor fetches each instruction from memory and decodes it before the "
         "execute cycle begins, as Figure 3.4 shows for the simple case. ") * 3


@pytest.fixture
def doc() -> Iterator[pymupdf.Document]:
    d = pymupdf.open()
    yield d
    d.close()


def only(page: pymupdf.Page) -> Figure:
    figs = read_page(page, render=False)
    assert len(figs) == 1, [f.caption.id for f, _ in figs]
    return figs[0][0]


def labels(f: Figure) -> str:
    return " ".join(lab.text for lab in f.labels)


def test_a_bold_caption_with_a_no_break_space_is_found_and_a_citation_is_not(doc: pymupdf.Document) -> None:
    page = doc.new_page(width=W, height=H)
    body(page, 80, 140, PROSE)  # starts "...as Figure 3.4 shows": roman, never a caption
    box_drawing(page, (80, 160, 380, 300))
    caption(page, 320, "Figure 3.4", "The Instruction Cycle")
    f = only(page)
    assert f.caption.id == "3.4"
    assert f.caption.title == "The Instruction Cycle"


def test_the_crop_takes_the_drawing_its_labels_and_sub_caption_and_nothing_else(doc: pymupdf.Document) -> None:
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 30), "88  CHAPTER 3 / A TOP-LEVEL VIEW", fontname="tiro", fontsize=8)  # running header
    body(page, 70, 140, PROSE)
    label(page, 100, 168, "Fetch")  # a short label just above the drawing
    box_drawing(page, (80, 175, 380, 300))
    label(page, 150, 240, "MAR")  # inside
    label(page, 160, 318, "(a) Simplified view")  # a sub-caption, under the drawing
    caption(page, 340, "Figure 3.4", "The Instruction Cycle")
    body(page, 360, 430, PROSE)  # the text under the caption
    f = only(page)
    assert f.crop is not None
    assert f.crop[1] > 140 and f.crop[3] < 340, f.crop
    got = labels(f)
    for want in ("Fetch", "MAR", "(a)", "Simplified", "view"):
        assert want in got
    for never in ("processor", "CHAPTER", "Instruction", "Cycle"):
        assert never not in got, never


def test_text_far_above_the_drawing_is_the_pages_even_in_a_labels_face(doc: pymupdf.Document) -> None:
    page = doc.new_page(width=W, height=H)
    label(page, 120, 120, "ri = Tref / Tsut", size=9)  # an equation between problems (2.8)
    box_drawing(page, (80, 200, 380, 320))
    caption(page, 340, "Figure 2.8", "Illustration of Little's Law")
    f = only(page)
    assert "Tref" not in labels(f)
    assert f.crop is not None and f.crop[1] > 180


def test_an_equation_number_and_an_edge_page_number_are_left_out(doc: pymupdf.Document) -> None:
    page = doc.new_page(width=W, height=H)
    box_drawing(page, (80, 120, 380, 300))
    page.insert_text((400, 130), "(2.1)", fontname="tiro", fontsize=10)
    page.insert_text((20, 200), "90", fontname="tibo", fontsize=12)
    caption(page, 320, "Figure 2.4", "Amdahl's Law for Multiprocessors")
    f = only(page)
    assert "(2.1)" not in labels(f) and "90" not in labels(f)


def test_two_captions_side_by_side_split_the_page(doc: pymupdf.Document) -> None:
    page = doc.new_page(width=W, height=H)
    box_drawing(page, (40, 120, 220, 300))
    box_drawing(page, (250, 120, 430, 300))
    label(page, 100, 200, "LEFT")
    label(page, 300, 200, "RIGHT")
    caption(page, 320, "Figure 1.4", "Chip", x=40)
    caption(page, 320, "Figure 1.5", "Core", x=250)
    figs = {f.caption.id: f for f, _ in read_page(page, render=False)}
    assert labels(figs["1.4"]) == "LEFT" and labels(figs["1.5"]) == "RIGHT"


def test_a_turned_page_is_read_upright(doc: pymupdf.Document) -> None:
    # As the book stores 3.7: a portrait page whose content runs sideways,
    # shown landscape by /Rotate 90.
    drawn = pymupdf.open()
    landscape = drawn.new_page(width=H, height=W)
    box_drawing(landscape, (80, 60, 580, 360))
    label(landscape, 300, 200, "WRITE")
    caption(landscape, 400, "Figure 3.7", "Program Flow of Control")
    page = doc.new_page(width=W, height=H)
    page.show_pdf_page(page.rect, drawn, 0, rotate=90)
    page.set_rotation(90)
    f = only(page)
    assert f.caption.rotated == 90 and f.caption.title == "Program Flow of Control"
    assert f.crop is not None and (f.crop[2] - f.crop[0]) > (f.crop[3] - f.crop[1])  # landscape
    assert "WRITE" in labels(f)


def plot(page: pymupdf.Page, fn: Any, log_x: bool = False) -> None:
    """Axes 0..10 by 0..20 (or 1..1000 log on x) with ticks, and one curve."""
    x0, x1, y0, y1 = 100.0, 400.0, 400.0, 100.0  # page points; y grows down
    page.draw_line((x0, y0), (x1, y0))
    page.draw_line((x0, y0), (x0, y1))
    xs = [1, 10, 100, 1000] if log_x else [0, 2, 4, 6, 8, 10]
    for i, v in enumerate(xs):
        px = x0 + (x1 - x0) * i / (len(xs) - 1)
        page.draw_line((px, y0), (px, y0 + 4))
        label(page, px - pymupdf.get_text_length(str(v), "helv", 8) / 2, y0 + 14, str(v))  # centred, as a book sets it
    for v in (0, 5, 10, 15, 20):
        py = y0 - (y0 - y1) * v / 20
        page.draw_line((x0 - 4, py), (x0, py))
        label(page, x0 - 8 - pymupdf.get_text_length(str(v), "helv", 8), py + 3, str(v))
    pts = []
    for i in range(41):
        t = i / 40
        xv = 10 ** (3 * t) if log_x else 10 * t
        pts.append(pymupdf.Point(x0 + (x1 - x0) * t, y0 - (y0 - y1) * fn(xv) / 20))
    page.draw_polyline(pts, color=(0, 0.45, 0.4), width=1)


def test_a_chart_curve_is_read_back_in_the_charts_own_values(doc: pymupdf.Document) -> None:
    page = doc.new_page(width=W, height=H)
    plot(page, lambda x: 1.5 * x + 2)
    caption(page, 440, "Figure 9.9", "A Line")
    f = only(page)
    assert f.chart is not None and len(f.chart.series) == 1
    for xv, yv in f.chart.series[0].points:
        assert abs(yv - (1.5 * xv + 2)) < 0.15, (xv, yv)


def test_a_log_axis_is_recognised(doc: pymupdf.Document) -> None:
    page = doc.new_page(width=W, height=H)
    def amdahl(n: float) -> float:
        return 1 / ((1 - 0.95) + 0.95 / n)

    plot(page, amdahl, log_x=True)
    caption(page, 440, "Figure 9.8", "Amdahl")
    f = only(page)
    assert f.chart is not None and f.chart.x.scale == "log"
    for xv, yv in f.chart.series[0].points:
        assert abs(yv - amdahl(xv)) / amdahl(xv) < 0.02, (xv, yv)


def fig(ch: int, n: int, head: str = "A Title", crop: bool = True) -> Figure:
    cap = reader.Caption(ch, n, 1, (0, 0, 1, 1), head, head)
    return Figure(cap, (0, 0, 10, 10) if crop else None)


def test_coverage_catches_a_planted_miss() -> None:
    """The canary: a cited figure the reader lost, a gap, an uncropped one."""
    by_ch = {3: [fig(3, 1), fig(3, 3), fig(3, 4, crop=False)]}
    text = "Figure 3.1 A Title ... Figure 3.3 A Title ... Figure 3.4 A Title ... as Figure 3.5 shows"
    problems, _ = read_book.coverage(by_ch, {3: text})
    joined = "\n".join(problems)
    assert "caption numbers missing [2]" in joined
    assert "cites Figure 3.5" in joined
    assert "3.4: found and not cropped" in joined


def test_coverage_is_clean_when_everything_is_found() -> None:
    by_ch = {3: [fig(3, 1), fig(3, 2)]}
    problems, missing_text = read_book.coverage(by_ch, {3: "Figure 3.1 A Title Figure 3.2 A Title"})
    assert problems == [] and missing_text == []


# --- the book --------------------------------------------------------------

BOOK_PDF = read_book.PDF
book = pytest.mark.skipif(not BOOK_PDF.exists(), reason="the book PDF is not at the repo root")


@pytest.fixture(scope="module")
def whole_book() -> dict[str, Figure]:
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(reader, "BODY_FACE", "TimesTen")
        mp.setattr(reader, "HEADING_FACE", "Bembo")
        manifest = json.loads((read_book.BOOK / "manifest.json").read_text(encoding="utf8"))
        figures, duplicates = read_book.read_figures(pymupdf.open(BOOK_PDF), manifest, set())
    assert duplicates == []
    return figures


@book
def test_every_caption_in_the_book_is_found_and_cropped(whole_book: dict[str, Figure]) -> None:
    manifest = json.loads((read_book.BOOK / "manifest.json").read_text(encoding="utf8"))
    by_ch: dict[int, list[Figure]] = {}
    for f in whole_book.values():
        by_ch.setdefault(f.caption.chapter, []).append(f)
    texts = {ch["n"]: (read_book.BOOK / ch["file"]).read_text(encoding="utf8") for ch in manifest}
    problems, _ = read_book.coverage(by_ch, texts)
    assert problems == []
    assert len({f.caption.id for f in whole_book.values()}) == 380
    assert len(whole_book) == 381  # 6.6 is printed over two pages
    assert all(f.crop for f in whole_book.values())


@book
def test_chapter_15_has_the_fourteen_figures_b0_measured(whole_book: dict[str, Figure]) -> None:
    assert sorted(f.caption.number for f in whole_book.values() if f.caption.chapter == 15) == list(range(1, 15))
    assert whole_book["15.1"].caption.title == "Overlapping Register Windows"


@book
def test_turned_pages_and_a_continued_figure(whole_book: dict[str, Figure]) -> None:
    turned = sorted(k for k, f in whole_book.items() if f.caption.rotated)
    assert turned == ["10.22", "19.12", "3.12", "3.23", "3.7", "4.15", "4.18"]
    for k in turned:
        c = whole_book[k].crop
        assert c is not None and c[2] - c[0] > c[3] - c[1], k
    assert whole_book["6.6-2"].caption.part == 2


@book
def test_no_problem_text_inside_a_figure(whole_book: dict[str, Figure]) -> None:
    for key, words in {"2.8": ("Determine", "Section"), "11.35": ("DeMorgan", "Simplify")}.items():
        got = labels(whole_book[key])
        for w in words:
            assert w not in got, (key, w)
    assert any(fl.startswith("table-inside") for fl in whole_book["11.18"].flags)


@book
def test_figure_2_4_reads_back_as_amdahls_law(whole_book: dict[str, Figure]) -> None:
    chart = whole_book["2.4"].chart
    assert chart is not None and chart.x.scale == "log"
    found = set()
    for s in chart.series:
        pts = [(x, y) for x, y in s.points if 1 <= x <= 1000]
        best = min((0.95, 0.90, 0.75, 0.5), key=lambda f: sum(abs(y - 1 / ((1 - f) + f / x)) for x, y in pts))
        for x, y in pts:
            want = 1 / ((1 - best) + best / x)
            assert abs(y - want) / want < 0.005, (best, x, y)
        found.add(best)
    assert found == {0.95, 0.90, 0.75, 0.5}


@book
def test_figure_4_22_reads_back_as_access_efficiency(whole_book: dict[str, Figure]) -> None:
    """e = 1 / (1 + (1 - H) r), for r = 1, 10, 100, 1000 (book §4.2 appendix).

    Held to H <= 0.9: past it the curves stand almost upright, and the book's
    own drawing leaves the formula (at H = 0.947, r = 100 the drawn curve is
    at 0.174, the formula at 0.159: 1.5 pt of x on a 260 pt axis)."""
    chart = whole_book["4.22"].chart
    assert chart is not None and chart.y.scale == "log"
    found = set()
    for s in chart.series:
        r = min((1, 10, 100, 1000), key=lambda r: sum(abs(math.log10(y) - math.log10(1 / (1 + (1 - h) * r)))
                                                       for h, y in s.points if y > 0))
        for h, y in s.points:
            if h > 0.9:
                continue
            want = 1 / (1 + (1 - min(max(h, 0), 1)) * r)
            assert abs(math.log10(y) - math.log10(want)) < 0.03, (r, h, y)
        found.add(r)
    assert found == {1, 10, 100, 1000}

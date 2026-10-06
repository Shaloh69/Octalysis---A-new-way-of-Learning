"""The figure reader (docs/AI-ASSISTANT-PLAN.md §5 B, §9 B1).

Code, not a model: for every figure in a book PDF it finds the caption, cuts
the figure out of the page, and keeps the labels exactly as the PDF's own
text layer prints them, with their positions. For a chart drawn as vectors it
also reads the axes and turns each plotted line back into data points.

Everything here is read from the PDF and nothing is guessed: a figure the
reader cannot cut is reported with its reason, never skipped. The rules come
from the B0 trial on book chapter 15 (scripts/.b0-crop.tmp.py) and from
reading all 381 captions of this book:

- A caption is a line whose first span is "Figure N.M" in a BOLD face. The
  space inside it is a no-break space, which is why a plain-text search for
  "Figure 15.1" missed half of them on 7 Oct. A sentence that cites a figure
  starts in the roman face and is never a caption.
- The caption sits BELOW its figure. The figure is everything between the
  caption and whatever bounds it above: the running header band, another
  caption, or a body paragraph.
- A body paragraph is told apart from a label by its face (the body is set in
  TimesTen at 10 pt; labels are smaller, or another face) and by its shape.
- Sub-captions ("(a) Symbolic program") sit between the drawing and the
  caption and belong to the figure; the caption itself never does.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any, Iterable

import pymupdf

# Characters InDesign leaves in the text layer that are invisible on the page.
# The same table as scripts/extract_book.py, so a label read here matches the
# same words in docs/source/book character for character.
INVISIBLE = {
    "­": "",  # SOFT HYPHEN
    "​": "",  # ZERO WIDTH SPACE
    " ": " ",  # EN SPACE
    " ": " ",  # EM SPACE
    " ": " ",  # THIN SPACE
    " ": " ",  # HAIR SPACE
    " ": " ",  # NO-BREAK SPACE
}
GLYPHS = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}

HEADER = 52.0  # points: the running header band at the top of every page
# This book's faces: the running text is TimesTen, the headings Bembo. A new
# book (plan §5 A, B9) states its own; the tests set theirs.
BODY_FACE = "TimesTen"
HEADING_FACE = "Bembo"
PAD = 6.0  # points of white kept around a crop
CAPTION_RE = re.compile(r"^Figure\s*(\d+)\.(\d+)$")
NUMBER_RE = re.compile(r"^[-−]?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?$|^[-−]?\d+(?:\.\d+)?%?$")


def clean(text: str) -> str:
    for a, b in INVISIBLE.items():
        text = text.replace(a, b)
    for a, b in GLYPHS.items():
        text = text.replace(a, b)
    return text


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", clean(text)).strip()


Box = tuple[float, float, float, float]


def _box(r: Any) -> Box:
    return (float(r[0]), float(r[1]), float(r[2]), float(r[3]))


def _union(a: Box, b: Box) -> Box:
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _x_overlap(a: Box, x0: float, x1: float) -> bool:
    return a[2] > x0 + 1 and a[0] < x1 - 1


@dataclass
class Caption:
    chapter: int
    number: int
    page: int  # 1-based PDF page
    box: Box  # the caption block's first line
    title: str  # "Overlapping Register Windows"
    head: str  # the caption's first line, which is what the extracted book holds whole
    credit: str = ""  # "Source: ..." when the book prints one under the caption
    part: int = 1  # 2 for the second page of a figure printed "(Continued)"
    rotated: int = 0  # the page's /Rotate: a landscape figure is read upright

    @property
    def id(self) -> str:
        return f"{self.chapter}.{self.number}"

    @property
    def key(self) -> str:
        return self.id if self.part == 1 else f"{self.id}-{self.part}"


@dataclass
class Label:
    text: str
    box: Box  # points, relative to the crop's top-left corner


@dataclass
class Axis:
    scale: str  # "linear" | "log"
    ticks: list[tuple[float, float]]  # (value, position in crop points)
    a: float  # value = a * pos + b (log: log10(value) = a * pos + b)
    b: float
    edge: float  # where its labels end: an x axis's label tops, a y axis's label right edges

    def value(self, pos: float) -> float:
        v = self.a * pos + self.b
        return 10**v if self.scale == "log" else v


@dataclass
class Series:
    stroke: str  # "#rrggbb" of the drawn line, or "" when it has none
    dashes: str
    points: list[tuple[float, float]]  # data coordinates


@dataclass
class Chart:
    x: Axis
    y: Axis
    series: list[Series]  # lines and curves
    bars: list[tuple[float, float, float, str]] = field(default_factory=list)  # x from, x to, top value, fill
    markers: list[tuple[float, float, str]] = field(default_factory=list)  # x, y, fill: plotted points


@dataclass
class Figure:
    caption: Caption
    crop: Box | None  # points, on the page
    labels: list[Label] = field(default_factory=list)
    paths: int = 0
    images: int = 0
    chart: Chart | None = None
    flags: list[str] = field(default_factory=list)


def _is_bold_caption_line(line: dict[str, Any]) -> re.Match[str] | None:
    spans = line.get("spans") or []
    if not spans or "Bold" not in spans[0]["font"]:
        return None
    return CAPTION_RE.match(squash(spans[0]["text"]))


@dataclass
class PageView:
    """A page's text, drawings and images in the frame its reader sees.

    A landscape figure is stored as a portrait page with /Rotate 90: PyMuPDF
    gives its text and paths in the stored frame, where the caption runs up
    the page, and gives `page.rect` in the turned one. Every box is moved into
    the turned frame here, so one set of rules reads both. (Taking the
    rotation into the content with remove_rotation() instead loses the whole
    text layer of pages 168 and 385.)"""

    number: int  # 0-based
    rect: Box
    rotation: int
    blocks: list[dict[str, Any]]
    drawings: list[dict[str, Any]]  # rect, color, dashes, runs (vertex lists)
    images: list[Box]
    words: list[tuple[Box, str]]


def _same(a: tuple[float, float], b: tuple[float, float]) -> bool:
    return abs(a[0] - b[0]) <= 0.05 and abs(a[1] - b[1]) <= 0.05


def _monotone(run: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    """Cut a stroke where it turns back along x: a series is a function of x,
    and curves that meet at a point are drawn as one stroke (4.22 at (1, 1))."""
    pieces: list[list[tuple[float, float]]] = [run[:2]]
    for pt in run[2:]:
        cur = pieces[-1]
        step = cur[-1][0] - cur[-2][0]
        nxt = pt[0] - cur[-1][0]
        if step * nxt < 0 and abs(nxt) > 0.05 and abs(step) > 0.05:
            pieces.append([cur[-1], pt])
        else:
            cur.append(pt)
    return pieces


def view(page: pymupdf.Page) -> PageView:
    m = page.rotation_matrix

    def tr(b: Any) -> Box:
        return _box(pymupdf.Rect(b) * m)

    blocks = []
    for b in page.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        b["bbox"] = tr(b["bbox"])
        for line in b.get("lines") or []:
            line["bbox"] = tr(line["bbox"])
        blocks.append(b)
    drawings = []
    for d in page.get_drawings():
        # One path can hold many strokes (a frame and its ticks): a new run
        # starts wherever a segment does not begin where the last one ended.
        runs: list[list[tuple[float, float]]] = []
        for item in d["items"]:
            if item[0] == "l":
                seg = [item[1], item[2]]
            elif item[0] == "c":
                # A Bezier is sampled along its length, not just at its ends:
                # a chart's curve is often one or two of them (4.23).
                p0, c1, c2, p3 = item[1], item[2], item[3], item[4]
                seg = [p0] + [
                    p0 * (1 - t) ** 3 + c1 * (3 * (1 - t) ** 2 * t) + c2 * (3 * (1 - t) * t**2) + p3 * t**3
                    for t in (0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0)
                ]
            else:
                continue
            pts = [(float(q.x), float(q.y)) for q in (pp * m for pp in seg)]
            # A curve may come as thousands of strokes drawn backwards, each
            # ending where the last began (2.4's solid curves): join either way.
            if runs and _same(runs[-1][-1], pts[0]):
                runs[-1] += pts[1:]
            elif runs and _same(runs[-1][0], pts[-1]):
                runs[-1][:0] = pts[:-1]
            else:
                runs.append(pts)
        rects = [tr(item[1]) for item in d["items"] if item[0] == "re"]
        drawings.append({"rect": tr(d["rect"]), "color": d.get("color"), "fill": d.get("fill"),
                         "dashes": d.get("dashes"), "runs": runs, "rects": rects})
    images = [tr(i["bbox"]) for i in page.get_image_info()]
    words = [(tr(w[:4]), w[4]) for w in page.get_text("words")]
    return PageView(page.number, _box(page.rect), page.rotation, blocks, drawings, images, words)


def find_captions(pv: PageView) -> list[Caption]:
    """Every figure caption on the page, in reading order.

    The title runs on in the caption's own lines: the same size, directly
    under the line before, never left of the caption. That keeps out a page
    number set beside the last line (14.6 on p523)."""
    out: list[Caption] = []
    for block in pv.blocks:
        lines = block.get("lines") or []
        for i, line in enumerate(lines):
            m = _is_bold_caption_line(line)
            if not m:
                continue
            size = line["spans"][-1]["size"]
            first = squash("".join(s["text"] for s in line["spans"][1:]))
            title = first
            credit = ""
            prev = _box(line["bbox"])
            for nxt in lines[i + 1 :]:
                nb = _box(nxt["bbox"])
                t = squash("".join(s["text"] for s in nxt["spans"]))
                if _is_bold_caption_line(nxt) or not t:
                    break
                if nb[0] < line["bbox"][0] - 3 or nb[1] > prev[3] + 4 or abs(nxt["spans"][0]["size"] - size) > 0.6:
                    break
                prev = nb
                if t.startswith("Source:") or credit:
                    credit = (credit + " " + t).strip()
                elif title.endswith("-"):
                    title += t  # a compound broken at its hyphen: "Little-" + "Endian"
                else:
                    title = f"{title} {t}"
            out.append(Caption(int(m.group(1)), int(m.group(2)), pv.number + 1, _box(line["bbox"]), title, first,
                               credit, rotated=pv.rotation))
    out.sort(key=lambda c: (c.box[1], c.box[0]))
    return out


def _block_is_body(block: dict[str, Any], page_width: float) -> bool:
    """A paragraph of running text (or a heading), never a figure's label."""
    chars = 0
    body = 0
    small_body = 0  # TimesTen at 9 pt: the problems, and some legends
    for line in block.get("lines") or []:
        for s in line["spans"]:
            n = len(s["text"].strip())
            chars += n
            f = s["font"]
            if (BODY_FACE in f and s["size"] >= 9.5) or f.startswith(HEADING_FACE):
                body += n
            elif BODY_FACE in f and s["size"] >= 8.5:
                small_body += n
    if chars == 0:
        return False
    width = block["bbox"][2] - block["bbox"][0]
    nlines = len(block.get("lines") or [])
    if body / chars >= 0.6 and (width > 0.4 * page_width or nlines >= 2) and chars >= 25:
        return True
    # The end-of-chapter problems are set at 9 pt, the size of a label, so a
    # face rule alone takes them in (2.8): a wide block of long lines is prose
    # in that face. A figure's legend is shorter or narrower, and a note set
    # inside a figure ("Shading indicates...", 14.26) is 8 pt.
    return (body + small_body) / chars >= 0.6 and nlines >= 3 and width > 0.5 * page_width and chars / nlines >= 50


def _never_in_figure(block: dict[str, Any], rect: Box) -> bool:
    """An equation number set beside a drawing ("(2.1)", 2.4), or the page
    number a turned page carries at its edge ("90", 3.7)."""
    text = squash(" ".join(s["text"] for line in block.get("lines") or [] for s in line["spans"]))
    if re.fullmatch(r"\(\d+\.\d+\)", text):
        return True
    bb = block["bbox"]
    at_edge = bb[0] < rect[0] + 40 or bb[2] > rect[2] - 40 or bb[1] < rect[1] + 40 or bb[3] > rect[3] - 40
    return bool(re.fullmatch(r"\d{1,4}", text)) and at_edge


def _columns(captions: list[Caption], cap: Caption, rect: Box) -> tuple[float, float]:
    """The horizontal span of a figure: the page, or its share when two
    captions stand side by side at the same height. A caption starts at its
    figure's left edge, so the split is just left of the right-hand one."""
    x0, x1 = rect[0], rect[2]
    for other in captions:
        if other is cap or abs(other.box[1] - cap.box[1]) > 20:
            continue
        left, right = (other, cap) if other.box[0] < cap.box[0] else (cap, other)
        mid = right.box[0] - 4
        if other is left:
            x0 = max(x0, mid)
        else:
            x1 = min(x1, mid)
    return x0, x1


def read_page(page: pymupdf.Page, dpi: int = 200, render: bool = True) -> list[tuple[Figure, pymupdf.Pixmap | None]]:
    pv = view(page)
    captions = find_captions(pv)
    if not captions:
        return []
    header = 0.0 if pv.rotation else HEADER  # a turned page has no running header across its top
    width = pv.rect[2] - pv.rect[0]
    caption_tops = [c.box[1] for c in captions]

    def is_caption(b: dict[str, Any]) -> bool:
        return any(abs(b["bbox"][1] - t) < 1 for t in caption_tops)

    out: list[tuple[Figure, pymupdf.Pixmap | None]] = []
    for cap in captions:
        fig = Figure(cap, None)
        x0, x1 = _columns(captions, cap, pv.rect)
        top = pv.rect[1] + header
        bottom = cap.box[1]
        # The nearest thing above the caption that cannot be part of the figure:
        # another caption's whole block, or a body paragraph.
        for b in pv.blocks:
            bb = _box(b["bbox"])
            if bb[3] <= bottom - 1 and _x_overlap(bb, x0, x1) and (is_caption(b) or _block_is_body(b, width)):
                top = max(top, bb[3])
        region = (x0, top - 1, x1, bottom - 0.5)

        def inside(r: Box) -> bool:
            return r[0] >= region[0] - 2 and r[2] <= region[2] + 2 and r[1] >= region[1] - 2 and r[3] <= region[3] + 2

        # What is drawn, joined from the caption upward. A drawn part further up
        # joins only if no paragraph lies between it and the figure: the
        # overbars of a problem's Boolean expression are paths too (11.35).
        def char_count(b: dict[str, Any]) -> int:
            return sum(len(s["text"].strip()) for line in b["lines"] for s in line["spans"])

        prose = [_box(b["bbox"]) for b in pv.blocks if inside(_box(b["bbox"])) and char_count(b) >= 80]
        parts: list[tuple[Box, dict[str, Any] | None]] = [
            (d["rect"], d) for d in pv.drawings
            if (d["rect"][2] - d["rect"][0] > 1 or d["rect"][3] - d["rect"][1] > 1) and inside(d["rect"])
        ]
        parts += [(r, None) for r in pv.images if inside(r)]
        parts.sort(key=lambda p: -p[0][3])
        box: Box | None = None
        drawn = []
        for r, d in parts:
            if box is not None and r[3] < box[1]:
                gap = (box[0], r[3], box[2], box[1])
                if any(p[1] >= gap[1] - 1 and p[3] <= gap[3] + 1 for p in prose):
                    continue
            box = r if box is None else _union(box, r)
            if d is None:
                fig.images += 1
            else:
                drawn.append(d)
        fig.paths = len(drawn)
        # Text joins what is drawn: anything level with it or below it (labels,
        # sub-captions), and above it only a short label within 24 pt of the
        # figure's top, climbing one label at a time ("N(t)", a column head).
        # Text further up is the page's, even when its face looks like a
        # label's: the problems over 2.8, an equation set between them.
        texts = [
            (_box(b["bbox"]), b) for b in pv.blocks
            if inside(_box(b["bbox"])) and not _block_is_body(b, width) and not is_caption(b)
            and not _never_in_figure(b, pv.rect)
        ]
        if box is not None:
            grew = True
            while grew:
                grew = False
                for bb, b in list(texts):
                    chars = sum(len(s["text"]) for line in b["lines"] for s in line["spans"])
                    if bb[3] > box[1] or (bb[3] >= box[1] - 24 and chars < 80):
                        box = _union(box, bb)
                        texts.remove((bb, b))
                        grew = True
        if box is None or (fig.paths == 0 and fig.images == 0):
            fig.flags.append("no-drawing: nothing drawn between the caption and the text above it")
            out.append((fig, None))
            continue
        crop = (
            max(box[0] - PAD, region[0], pv.rect[0]),
            max(box[1] - PAD, region[1]),
            min(box[2] + PAD, region[2], pv.rect[2]),
            min(box[3] + PAD, cap.box[1] - 1),
        )
        fig.crop = crop
        # A numbered table set above the figure, with its own caption, cannot be
        # told from the figure's own grid by position alone (11.18 under Table
        # 11.8). Say so rather than guess.
        for b in pv.blocks:
            for line in b.get("lines") or []:
                sp = line["spans"]
                lb = _box(line["bbox"])
                if sp and "Bold" in sp[0]["font"] and re.match(r"Table\s*\d+\.\d+$", squash(sp[0]["text"])):
                    if lb[1] >= crop[1] - 1 and lb[3] <= crop[3] + 1 and _x_overlap(lb, crop[0], crop[2]):
                        fig.flags.append(f"table-inside: {squash(sp[0]['text'])} sits in the crop; check by eye")
        for wb, text in pv.words:
            cx, cy = (wb[0] + wb[2]) / 2, (wb[1] + wb[3]) / 2
            t = clean(text).strip()
            if t and crop[0] <= cx <= crop[2] and crop[1] <= cy <= crop[3]:
                fig.labels.append(Label(t, (wb[0] - crop[0], wb[1] - crop[1], wb[2] - crop[0], wb[3] - crop[1])))
        if not fig.labels and fig.images == 0:
            fig.flags.append("no-labels: a drawing with no text in it")
        fig.chart = read_chart(fig.labels, drawn, crop)
        out.append((fig, page.get_pixmap(clip=pymupdf.Rect(crop), dpi=dpi) if render else None))
    return out


def _number(text: str) -> float | None:
    if not NUMBER_RE.match(text):
        return None
    return float(text.replace("−", "-").replace(",", "").rstrip("%"))


def _fit(pairs: list[tuple[float, float]]) -> tuple[float, float, float]:
    """Least squares value = a*pos + b; returns a, b and r squared."""
    n = len(pairs)
    sx = sum(p for p, _ in pairs)
    sy = sum(v for _, v in pairs)
    sxx = sum(p * p for p, _ in pairs)
    sxy = sum(p * v for p, v in pairs)
    den = n * sxx - sx * sx
    if den == 0:
        return 0.0, 0.0, 0.0
    a = (n * sxy - sx * sy) / den
    b = (sy - a * sx) / n
    mean = sy / n
    tot = sum((v - mean) ** 2 for _, v in pairs)
    res = sum((v - (a * p + b)) ** 2 for p, v in pairs)
    return a, b, (1 - res / tot) if tot else 0.0


def _axis(groups: Iterable[list[tuple[float, float, Box]]], rising: bool) -> Axis | None:
    """The best run of evenly spaced tick labels: (position, value, label box).
    `rising` is True when values grow with the position (an x axis)."""
    best: Axis | None = None
    for g in groups:
        pts = sorted({(round(p, 1), v) for p, v, _ in g})
        vals = [v for _, v in pts]
        if len(pts) < 3 or len(set(vals)) < 3:
            continue
        if any((vals[i + 1] > vals[i]) != rising for i in range(len(vals) - 1)):
            continue
        a, b, r2 = _fit(pts)
        scale = "linear"
        if r2 < 0.9995 and all(v > 0 for v in vals):
            la, lb, lr2 = _fit([(p, math.log10(v)) for p, v in pts])
            if lr2 >= 0.9995:
                a, b, r2, scale = la, lb, lr2, "log"
        if r2 < 0.9995:
            continue
        edge = min(bx[1] for _, _, bx in g) if rising else max(bx[2] for _, _, bx in g)
        if best is None or len(pts) > len(best.ticks):
            best = Axis(scale, [(v, p) for p, v in pts], a, b, edge)
    return best


def _hex(color: Any) -> str:
    if not color:
        return ""
    return "#" + "".join(f"{round(c * 255):02x}" for c in color[:3])


def read_chart(labels: list[Label], drawings: list[dict[str, Any]], crop: Box) -> Chart | None:
    """Axes from the numeric tick labels; lines, bars and plotted points from
    the vector drawing inside them, turned back into the chart's own values.

    `drawings` are PageView drawings: every coordinate is in the upright frame.
    The plot is everything right of the y labels and above the x labels: a
    curve may run below the lowest tick (2.4 starts at speedup 1, its lowest
    tick is 5)."""
    nums = [(lab, v) for lab in labels if (v := _number(lab.text)) is not None]
    if len(nums) < 6:
        return None
    # Tick marks: short two-point strokes. A label's centre sits a little off
    # its tick (2.4 read 0.92 where the curve starts at 1), so each label is
    # snapped to the tick beside it when there is one.
    ticks: list[tuple[float, float, float, float]] = []
    for d in drawings:
        for run in d["runs"]:
            if len(run) == 2:
                (ax, ay), (bx, by) = ((run[0][0] - crop[0], run[0][1] - crop[1]), (run[1][0] - crop[0], run[1][1] - crop[1]))
                if abs(ax - bx) + abs(ay - by) < 10:
                    ticks.append((ax, ay, bx, by))

    def snap_y(lab: Label, cy: float) -> float:
        near = [(t[1] + t[3]) / 2 for t in ticks
                if abs(t[1] - t[3]) < 0.5 and abs((t[1] + t[3]) / 2 - cy) < 4 and 0 <= min(t[0], t[2]) - lab.box[2] < 14]
        return min(near, key=lambda v: abs(v - cy)) if near else cy

    def snap_x(lab: Label, cx: float) -> float:
        near = [(t[0] + t[2]) / 2 for t in ticks
                if abs(t[0] - t[2]) < 0.5 and abs((t[0] + t[2]) / 2 - cx) < 4 and 0 <= lab.box[1] - max(t[1], t[3]) < 14]
        return min(near, key=lambda v: abs(v - cx)) if near else cx

    by_right: dict[int, list[tuple[float, float, Box]]] = {}
    by_row: dict[int, list[tuple[float, float, Box]]] = {}
    for lab, v in nums:
        cy = (lab.box[1] + lab.box[3]) / 2
        cx = (lab.box[0] + lab.box[2]) / 2
        by_right.setdefault(round(lab.box[2] / 4), []).append((snap_y(lab, cy), v, lab.box))
        by_row.setdefault(round(cy / 3), []).append((snap_x(lab, cx), v, lab.box))
    y = _axis(by_right.values(), rising=False)
    x = _axis(by_row.values(), rising=True)
    if x is None or y is None:
        return None
    if x.edge < max(p for _, p in y.ticks) - 2:
        return None  # "x ticks" above the y axis's foot are a key's numbers (16.6's 8/16/32)
    left, bottom = y.edge, x.edge

    def plotted(px: float, py: float) -> bool:
        return px > left and py < bottom

    chart = Chart(x, y, [])
    for d in drawings:
        r = (d["rect"][0] - crop[0], d["rect"][1] - crop[1], d["rect"][2] - crop[0], d["rect"][3] - crop[1])
        fill = _hex(d.get("fill"))
        if r[2] - r[0] < 8 and r[3] - r[1] < 8 and fill and plotted(r[0], r[3] - 0.5):
            # A plotted point: a small filled mark, read at its centre.
            cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
            chart.markers.append((round(x.value(cx), 4), round(y.value(cy), 4), fill))
            continue
        if d["rects"] and fill and not d["runs"]:
            for rr in d["rects"]:
                bx0, by0, bx1 = rr[0] - crop[0], rr[1] - crop[1], rr[2] - crop[0]
                if rr[3] - crop[1] > bottom + 2 or bx1 - bx0 > 0.5 * (crop[2] - crop[0]):
                    continue  # the plot's own background, not a bar
                chart.bars.append((round(x.value(bx0), 4), round(x.value(bx1), 4), round(y.value(by0), 4), fill))
            continue
        # Each stroke is one series: a path may hold several curves (4.22).
        span = math.hypot(bottom, crop[2] - crop[0] - left)
        for whole in d["runs"]:
            run = [(px - crop[0], py - crop[1]) for px, py in whole]
            if fill and len(run) > 2 and _same(run[0], run[-1]):
                continue  # a closed, filled shape: an arrowhead or a key's swatch
            for rp in _monotone(run):
                if all(abs(a[0] - b[0]) < 0.3 or abs(a[1] - b[1]) < 0.3 for a, b in zip(rp, rp[1:])):
                    continue  # only straight across and up: the frame, a grid line, a tick
                if len(rp) < 3 and math.hypot(rp[-1][0] - rp[0][0], rp[-1][1] - rp[0][1]) < 0.3 * span:
                    continue  # a short stroke: a pointer to a label, not data
                if not all(plotted(px, py) for px, py in rp):
                    continue
                chart.series.append(
                    Series(
                        _hex(d.get("color")),
                        str(d.get("dashes") or ""),
                        [(round(x.value(px), 4), round(y.value(py), 4)) for px, py in rp],
                    )
                )
    return chart

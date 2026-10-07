"""Upload what the figure reader read to the deployment (plan §9 B1, §4-now).

    python tools/assistant/upload/upload_figures.py <out dir> --ref <project ref> \
        --owner <staff uuid> [--course "CPE 412"] [--reuse]

Runs the reader (`pnpm book:figures <out dir>`) unless --reuse, then writes,
with the service role from the root .env (names only, never printed):

  - one `assistant_books` row: the owner, the course, the PDF's SHA-256 and
    page count. Never the PDF.
  - one `assistant_figures` row a crop (381 for this book), its crop at
    `<owner_id>/<book_id>/fig-NN-MM.png` in the private `assistant-figures`
    bucket.

Idempotent: it reads what is there first and writes only the difference, so a
re-run over the same book and the same reader reports "0 to insert, 0 to
update, 0 to upload" and changes nothing. A crop is re-uploaded only when its
SHA-256 changed. A row the reader no longer produces is reported, not deleted.

Refused: a URL that does not name --ref (the root .env has pointed at an older
project before), an owner who is not staff, an out dir inside the repo, a
reader run whose coverage is not clean.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
import pymupdf

ROOT = Path(__file__).resolve().parents[3]
READER = ROOT / "tools" / "assistant" / "figures" / "reader.py"
READ_BOOK = ROOT / "tools" / "assistant" / "figures" / "read_book.py"
PDF = ROOT / "Computer Organization and Architecture 10th - William Stallings (1).pdf"
BUCKET = "assistant-figures"
TITLE = "Computer Organization and Architecture: Designing for Performance"
EDITION = "10th"

# The columns the reader decides. A row whose columns all match is left alone.
COMPARED = ("chapter", "number", "part", "page", "caption", "crop_path", "crop_sha256",
            "labels", "chart", "flags", "reader_version")

Row = dict[str, Any]


def read_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env


def check_ref(url: str, ref: str) -> str:
    """The host, once it is the project named; anything else is refused."""
    host = urlparse(url).hostname or ""
    if host != f"{ref}.supabase.co":
        raise SystemExit(f"refused: SUPABASE_URL's host is {host!r}, not the project {ref!r}")
    return host


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def reader_version() -> str:
    """The reader's own hash: the same code reads the same figures."""
    return "b1-" + sha256(READER.read_bytes())[:12]


def r2(v: float) -> float:
    return round(float(v), 2)


def crop_name(fig: dict[str, Any]) -> str:
    return Path(str(fig["file"])).name  # "ch-15/fig-15-04.png" -> "fig-15-04.png"


def labels_of(fig: dict[str, Any]) -> list[dict[str, Any]]:
    return [{"text": lb["text"], "box": [r2(x) for x in lb["box"]]} for lb in fig["labels"]]


def chart_of(fig: dict[str, Any]) -> dict[str, Any] | None:
    c = fig.get("chart")
    if not c:
        return None

    def axis(a: dict[str, Any]) -> dict[str, Any]:
        return {"scale": a["scale"], "ticks": [[float(v), r2(p)] for v, p in a["ticks"]],
                "a": a["a"], "b": a["b"], "edge": r2(a["edge"])}

    return {
        "x": axis(c["x"]), "y": axis(c["y"]),
        "series": [{"stroke": s["stroke"], "dashes": s["dashes"],
                    "points": [[round(x, 6), round(y, 6)] for x, y in s["points"]]} for s in c["series"]],
        "bars": [[round(a, 6), round(b, 6), round(t, 6), f] for a, b, t, f in c.get("bars", [])],
        "markers": [[round(x, 6), round(y, 6), f] for x, y, f in c.get("markers", [])],
    }


def figure_row(fig: dict[str, Any], book: Row, crop_sha: str | None, version: str) -> Row:
    cap = fig["caption"]
    owner = book["owner_id"]
    return {
        "book_id": book["id"], "owner_id": owner, "course": book["course"],
        "figure_key": fig["id"], "chapter": cap["chapter"], "number": cap["number"],
        "part": cap["part"], "page": cap["page"], "caption": cap["title"],
        "crop_path": f"{owner}/{book['id']}/{crop_name(fig)}" if fig.get("file") else None,
        "crop_sha256": crop_sha, "labels": labels_of(fig), "chart": chart_of(fig),
        "flags": list(fig["flags"]), "reader_version": version,
    }


@dataclass
class Plan:
    insert: list[Row] = field(default_factory=list)
    update: list[tuple[str, Row]] = field(default_factory=list)  # (row id, changed columns)
    upload: list[str] = field(default_factory=list)  # crop paths
    stale: list[str] = field(default_factory=list)  # figure keys the reader no longer makes

    def empty(self) -> bool:
        return not (self.insert or self.update or self.upload)


def same(a: Any, b: Any) -> bool:
    """jsonb round-trips numbers as numerics; compare as JSON, keys sorted."""
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def plan(wanted: list[Row], existing: list[Row], objects: set[str]) -> Plan:
    """What to write so the deployment holds `wanted`; nothing when it already does."""
    have = {r["figure_key"]: r for r in existing}
    p = Plan()
    for row in wanted:
        old = have.get(row["figure_key"])
        path = row["crop_path"]
        if path and (path not in objects or old is None or old.get("crop_sha256") != row["crop_sha256"]):
            p.upload.append(path)
        if old is None:
            p.insert.append(row)
            continue
        changed = {k: row[k] for k in COMPARED if not same(row[k], old.get(k))}
        if changed:
            p.update.append((str(old["id"]), changed))
    keys = {r["figure_key"] for r in wanted}
    p.stale = sorted(k for k in have if k not in keys)
    return p


class Supabase:
    def __init__(self, url: str, key: str) -> None:
        self.http = httpx.Client(
            base_url=url.rstrip("/"), timeout=60,
            headers={"apikey": key, "authorization": f"Bearer {key}"},
        )

    def get(self, table: str, params: dict[str, str]) -> list[Row]:
        r = self.http.get(f"/rest/v1/{table}", params=params)
        r.raise_for_status()
        out: list[Row] = r.json()
        return out

    def insert(self, table: str, rows: list[Row]) -> list[Row]:
        r = self.http.post(f"/rest/v1/{table}", json=rows, headers={"prefer": "return=representation"})
        r.raise_for_status()
        out: list[Row] = r.json()
        return out

    def patch(self, table: str, row_id: str, cols: Row) -> None:
        r = self.http.patch(f"/rest/v1/{table}", params={"id": f"eq.{row_id}"}, json=cols)
        r.raise_for_status()

    def objects(self, prefix: str) -> set[str]:
        names: set[str] = set()
        offset = 0
        while True:
            r = self.http.post(f"/storage/v1/object/list/{BUCKET}",
                               json={"prefix": prefix, "limit": 1000, "offset": offset})
            r.raise_for_status()
            page: list[Row] = r.json()
            names |= {f"{prefix}{o['name']}" for o in page if o.get("id")}
            if len(page) < 1000:
                return names
            offset += 1000

    def upload(self, path: str, data: bytes) -> None:
        r = self.http.post(f"/storage/v1/object/{BUCKET}/{path}", content=data,
                           headers={"content-type": "image/png", "x-upsert": "true"})
        r.raise_for_status()


def run_reader(out: Path, pdf: Path) -> None:
    r = subprocess.run([sys.executable, str(READ_BOOK), str(out), "--pdf", str(pdf)],
                       capture_output=True, text=True, encoding="utf8")
    tail = [ln for ln in r.stdout.splitlines() if ln.startswith(("coverage", "  PROBLEM")) or "figures found" in ln]
    print("\n".join(tail))
    if r.returncode != 0:
        raise SystemExit("refused: the reader's coverage is not clean")


def main() -> int:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--ref", required=True)
    ap.add_argument("--owner", required=True)
    ap.add_argument("--course", default="CPE 412")
    ap.add_argument("--pdf", type=Path, default=PDF)
    ap.add_argument("--reuse", action="store_true", help="read <out>/figures.json, do not run the reader")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    out: Path = args.out.resolve()
    if ROOT in out.parents or out == ROOT:
        print("refused: the crops are the book's pages and must stay outside the repo")
        return 2

    env = read_env(ROOT / ".env")
    url, key = env.get("SUPABASE_URL", ""), env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("refused: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY absent from the root .env")
        return 2
    print("project:", check_ref(url, args.ref))
    sb = Supabase(url, key)

    prof = sb.get("profiles", {"id": f"eq.{args.owner}", "select": "role,deleted_at"})
    if not prof or prof[0]["role"] not in ("teacher", "admin") or prof[0]["deleted_at"]:
        print("refused: the owner is not a staff account on this project")
        return 2

    if not args.reuse:
        run_reader(out, args.pdf)
    figures: list[dict[str, Any]] = json.loads((out / "figures.json").read_text(encoding="utf8"))
    pdf_bytes = args.pdf.read_bytes()
    pdf_sha = sha256(pdf_bytes)
    pages = pymupdf.open(stream=pdf_bytes, filetype="pdf").page_count
    del pdf_bytes

    books = sb.get("assistant_books", {"owner_id": f"eq.{args.owner}", "pdf_sha256": f"eq.{pdf_sha}", "select": "*"})
    if books:
        book = books[0]
        if book["course"] != args.course:
            print(f"refused: this PDF is already filed under {book['course']!r}")
            return 2
        print("book: present", book["id"])
    elif args.dry_run:
        print("book: would insert (dry run stops here)")
        return 0
    else:
        book = sb.insert("assistant_books", [{
            "owner_id": args.owner, "course": args.course, "title": TITLE, "edition": EDITION,
            "pdf_sha256": pdf_sha, "pages": pages,
        }])[0]
        print("book: inserted", book["id"])

    version = reader_version()
    crops: dict[str, bytes] = {}
    wanted: list[Row] = []
    for fig in figures:
        data = (out / str(fig["file"])).read_bytes() if fig.get("file") else None
        row = figure_row(fig, book, sha256(data) if data else None, version)
        if data is not None and row["crop_path"]:
            crops[row["crop_path"]] = data
        wanted.append(row)

    prefix = f"{args.owner}/{book['id']}/"
    existing = sb.get("assistant_figures", {"book_id": f"eq.{book['id']}", "select": "*"})
    p = plan(wanted, existing, sb.objects(prefix))
    print(f"plan: {len(p.insert)} to insert, {len(p.update)} to update, {len(p.upload)} to upload, "
          f"{len(p.stale)} stale (left alone){': ' + ', '.join(p.stale) if p.stale else ''}")
    if args.dry_run or p.empty():
        print("nothing written" if p.empty() else "dry run: nothing written")
    else:
        # Crops first, so no row ever names an object that is not there.
        for i, path in enumerate(p.upload, 1):
            sb.upload(path, crops[path])
            if i % 50 == 0:
                print(f"  uploaded {i}/{len(p.upload)}")
        for i in range(0, len(p.insert), 100):
            sb.insert("assistant_figures", p.insert[i:i + 100])
        for row_id, cols in p.update:
            sb.patch("assistant_figures", row_id, cols)
        print("written")

    rows = sb.get("assistant_figures", {"book_id": f"eq.{book['id']}", "select": "figure_key"})
    print(f"on the project now: {len(rows)} figure rows, {len(sb.objects(prefix))} objects under {prefix}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

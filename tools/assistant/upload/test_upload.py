"""Tests for the upload's plan (plan §9 B1, .claude/rules/assistant.md).

    python -m pytest tools/assistant/upload -q

The network half is thin (PostgREST and Storage calls); what decides what is
written is `plan()`, and a re-run that writes is the failure that matters. So
the canary is the unchanged state: it must plan nothing, and every planted
difference must plan exactly its own write.
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import upload_figures as up  # noqa: E402

OWNER = "ef2370d9-13b0-4c59-9b81-db257b88117f"
BOOK = {"id": "11111111-2222-3333-4444-555555555555", "owner_id": OWNER, "course": "CPE 412"}


def fig(key: str, n: int, chart: bool = False) -> dict[str, Any]:
    ch, num = (int(x) for x in key.split("-")[0].split("."))
    return {
        "id": key,
        "file": f"ch-{ch:02d}/fig-{ch:02d}-{num:02d}.png",
        "caption": {"chapter": ch, "number": num, "part": 1, "page": 100 + n, "title": f"Title {key}"},
        "labels": [{"text": "ALU", "box": [10.123456, 20.987654, 30.5, 40.25]}],
        "chart": {
            "x": {"scale": "linear", "ticks": [[0, 1.111], [10, 99.999]], "a": 0.1, "b": 0.0, "edge": 5.555},
            "y": {"scale": "log", "ticks": [[1, 2.0], [100, 50.0]], "a": -0.04, "b": 2.0, "edge": 3.0},
            "series": [{"stroke": "#000000", "dashes": "", "points": [[0.1234567, 1.0], [2.0, 3.0]]}],
            "bars": [], "markers": [],
        } if chart else None,
        "flags": [],
    }


def rows(figs: list[dict[str, Any]]) -> list[up.Row]:
    return [up.figure_row(f, BOOK, f"{i:064x}", "b1-test") for i, f in enumerate(figs)]


def deployed(wanted: list[up.Row]) -> tuple[list[up.Row], set[str]]:
    """What the project holds after a complete run: the rows with ids, every crop."""
    existing = [dict(copy.deepcopy(r), id=f"row-{i}") for i, r in enumerate(wanted)]
    return existing, {r["crop_path"] for r in wanted if r["crop_path"]}


FIGS = [fig("15.1", 1), fig("15.2", 2), fig("2.4", 3, chart=True)]


def test_a_rerun_over_the_same_state_plans_nothing() -> None:
    wanted = rows(FIGS)
    existing, objects = deployed(wanted)
    p = up.plan(wanted, existing, objects)
    assert p.empty() and p.stale == []


def test_a_first_run_inserts_every_row_and_uploads_every_crop() -> None:
    wanted = rows(FIGS)
    p = up.plan(wanted, [], set())
    assert [r["figure_key"] for r in p.insert] == ["15.1", "15.2", "2.4"]
    assert len(p.upload) == 3 and p.update == []


def test_a_changed_crop_uploads_and_updates_only_that_figure() -> None:
    wanted = rows(FIGS)
    existing, objects = deployed(wanted)
    existing[1]["crop_sha256"] = "f" * 64
    p = up.plan(wanted, existing, objects)
    assert p.upload == [wanted[1]["crop_path"]]
    assert p.update == [("row-1", {"crop_sha256": wanted[1]["crop_sha256"]})]
    assert p.insert == []


def test_a_missing_object_is_uploaded_again_without_touching_the_row() -> None:
    wanted = rows(FIGS)
    existing, objects = deployed(wanted)
    objects.discard(wanted[0]["crop_path"])
    p = up.plan(wanted, existing, objects)
    assert p.upload == [wanted[0]["crop_path"]] and p.update == [] and p.insert == []


def test_a_new_reader_version_updates_rows_and_uploads_nothing() -> None:
    wanted = rows(FIGS)
    existing, objects = deployed(wanted)
    newer = [dict(r, reader_version="b1-newer") for r in wanted]
    p = up.plan(newer, existing, objects)
    assert len(p.update) == 3 and all(c == {"reader_version": "b1-newer"} for _, c in p.update)
    assert p.upload == []


def test_a_figure_the_reader_no_longer_makes_is_reported_not_deleted() -> None:
    wanted = rows(FIGS)
    existing, objects = deployed(wanted)
    p = up.plan(wanted[:2], existing, objects)
    assert p.stale == ["2.4"] and p.empty()


def test_json_columns_compare_by_value_not_key_order() -> None:
    wanted = rows(FIGS)
    existing, objects = deployed(wanted)
    chart = existing[2]["chart"]
    existing[2]["chart"] = dict(reversed(list(chart.items())))
    assert up.plan(wanted, existing, objects).empty()


def test_rows_sit_in_the_owners_folder_and_round_positions() -> None:
    r = rows(FIGS)[2]
    assert r["crop_path"] == f"{OWNER}/{BOOK['id']}/fig-02-04.png"
    assert r["labels"] == [{"text": "ALU", "box": [10.12, 20.99, 30.5, 40.25]}]
    assert r["chart"]["series"][0]["points"][0] == [0.123457, 1.0]
    assert r["figure_key"] == "2.4" and r["caption"] == "Title 2.4"


def test_a_url_naming_another_project_is_refused() -> None:
    assert up.check_ref("https://ddvxkbcelpqydnjkffdr.supabase.co", "ddvxkbcelpqydnjkffdr") == \
        "ddvxkbcelpqydnjkffdr.supabase.co"
    with pytest.raises(SystemExit):
        up.check_ref("https://oldprojectref000000.supabase.co", "ddvxkbcelpqydnjkffdr")
    with pytest.raises(SystemExit):
        up.check_ref("https://ddvxkbcelpqydnjkffdr.supabase.co.evil.example", "ddvxkbcelpqydnjkffdr")

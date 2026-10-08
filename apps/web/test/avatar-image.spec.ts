import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cropRect, panned, NO_CROP, AVATAR_MAX_BYTES, AVATAR_SIZE } from "../src/lib/avatar-image";

/**
 * The crop arithmetic behind a profile picture (PROFILES, 8 Oct 2026). The
 * preview and the encoder both use `cropRect`, so these numbers are what a
 * person sees in the circle AND what is sent.
 */

describe("cropRect", () => {
  it("at zoom 1 shows the whole short side, centred on the long one", () => {
    expect(cropRect(400, 300, NO_CROP)).toEqual({ sx: 50, sy: 0, side: 300 });
    expect(cropRect(300, 400, NO_CROP)).toEqual({ sx: 0, sy: 50, side: 300 });
    expect(cropRect(300, 300, NO_CROP)).toEqual({ sx: 0, sy: 0, side: 300 });
  });
  it("x and y run the picture's slack end to end", () => {
    expect(cropRect(400, 300, { zoom: 1, x: -1, y: 0 }).sx).toBe(0);
    expect(cropRect(400, 300, { zoom: 1, x: 1, y: 0 }).sx).toBe(100);
  });
  it("zooming shrinks the square and opens slack on both axes", () => {
    expect(cropRect(400, 300, { zoom: 2, x: 0, y: 0 })).toEqual({ sx: 125, sy: 75, side: 150 });
  });
  it("never leaves the picture: zoom and offsets are clamped", () => {
    expect(cropRect(400, 300, { zoom: 0.2, x: 9, y: -9 })).toEqual({ sx: 100, sy: 0, side: 300 });
    const r = cropRect(400, 300, { zoom: 99, x: 1, y: 1 });
    expect(r.side).toBe(300 / 8);
    expect(r.sx + r.side).toBeLessThanOrEqual(400);
    expect(r.sy + r.side).toBeLessThanOrEqual(300);
  });
});

describe("panned", () => {
  it("dragging the picture right shows more of its left (the offset falls)", () => {
    const c = panned(400, 300, NO_CROP, 20, 0, 240);
    expect(c.x).toBeLessThan(0);
  });
  it("moves the source by exactly the drag, in source pixels", () => {
    const before = cropRect(400, 300, { zoom: 2, x: 0, y: 0 });
    const next = panned(400, 300, { zoom: 2, x: 0, y: 0 }, -24, 0, 240);
    const after = cropRect(400, 300, next);
    // 24 preview px at (150 / 240) source px per preview px = 15 source px, the other way.
    expect(after.sx - before.sx).toBeCloseTo(15, 6);
  });
  it("stops at the edge, and a square picture at zoom 1 cannot move at all", () => {
    expect(panned(400, 300, NO_CROP, 9999, 9999, 240).x).toBe(-1);
    expect(panned(300, 300, NO_CROP, 50, 50, 240)).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});

describe("the limits match the server's", () => {
  it("512 pixels square and 300 KB, as db/addendum-profiles.sql's bucket and the API check", () => {
    expect(AVATAR_SIZE).toBe(512);
    expect(AVATAR_MAX_BYTES).toBe(300 * 1024);
  });
});

describe("the two apps hold one copy", () => {
  // There is no shared UI package; the crop logic is duplicated on purpose and pinned here.
  const root = resolve(__dirname, "../../..");
  const same = (rel: string) => {
    const norm = (s: string) => s.replace(/\r\n/g, "\n");
    return norm(readFileSync(resolve(root, "apps/web/src", rel), "utf8")) === norm(readFileSync(resolve(root, "apps/console/src", rel), "utf8"));
  };
  it("lib/avatar-image.ts is identical in apps/web and apps/console", () => {
    expect(same("lib/avatar-image.ts")).toBe(true);
  });
  it("components/AvatarCropper.tsx is identical in apps/web and apps/console", () => {
    expect(same("components/AvatarCropper.tsx")).toBe(true);
  });
});

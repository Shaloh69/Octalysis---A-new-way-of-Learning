import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { allTextureFiles, moonSkin, MOON_SKINS, skinFor } from "../src/solar-system/bodies";
import { INNER_WORLDS, OUTER_WORLDS } from "../src/solar-system/world";

/**
 * The map's real textures: every file the scene can request exists, is small
 * enough for a phone, and is credited (CC BY 4.0 requires it); and a moon's skin
 * is a pure function of its objective and the student's seed. WHICH skin a
 * planet wears is the frost line's (instructor, 1 Oct 2026), tested in
 * `world.spec.ts`; it no longer follows the biome.
 */

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("the map's textures", () => {
  it("every file the scene can request is in public/textures, and none is over 200 KB", () => {
    for (const f of allTextureFiles()) {
      const p = resolve(WEB, "public/textures", f);
      expect(existsSync(p), f).toBe(true);
      expect(statSync(p).size, f).toBeLessThan(200 * 1024);
    }
  });

  it("every texture is credited, with its licence (CC BY 4.0 requires attribution)", () => {
    const credits = readFileSync(resolve(WEB, "public/CREDITS.md"), "utf8");
    expect(credits).toMatch(/Solar System Scope/);
    expect(credits).toMatch(/CC BY 4\.0/);
    for (const f of allTextureFiles()) expect(credits, f).toContain(f);
  });

  it("both sides of the frost line have more than one world, so neighbours can differ", () => {
    expect(new Set(INNER_WORLDS).size).toBeGreaterThan(1);
    expect(new Set(OUTER_WORLDS).size).toBeGreaterThan(1);
    for (const k of [...INNER_WORLDS, ...OUTER_WORLDS, ...MOON_SKINS]) expect(skinFor(k).map, k).toBeTruthy();
  });
});

describe("a moon's skin is seeded, never random", () => {
  it("the same moon and seed give the same skin, every time", () => {
    expect(moonSkin("04.5", 2.5)).toBe(moonSkin("04.5", 2.5));
  });

  it("different students see different moons (the seed moves the choice)", () => {
    const skins = new Set<string>();
    for (let s = 0; s < 40; s++) skins.add(moonSkin("05.1", s * 0.37).map);
    expect(skins.size).toBeGreaterThan(1);
  });
});

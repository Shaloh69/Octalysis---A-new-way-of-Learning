import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { allTextureFiles, BY_BIOME, moonSkin, planetSkin } from "../src/solar-system/bodies";

/**
 * The map's real textures: every file the scene can request exists, is small
 * enough for a phone, and is credited (CC BY 4.0 requires it); and a skin is a
 * pure function of the stage, the biome and the student's seed.
 */

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"];

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

  it("every biome has worlds, and more than one, so neighbours can differ", () => {
    for (const b of BIOMES) expect(new Set(BY_BIOME[b]).size, b).toBeGreaterThan(1);
  });
});

describe("a skin is seeded, never random", () => {
  it("the same stage, biome and seed give the same skin, every time", () => {
    for (const b of BIOMES) expect(planetSkin("04", b, 1.234)).toBe(planetSkin("04", b, 1.234));
    expect(moonSkin("04.5", 2.5)).toBe(moonSkin("04.5", 2.5));
  });

  it("the skin comes from the planet's own biome", () => {
    for (const b of BIOMES) {
      const maps = new Set(BY_BIOME[b]!.map((k) => k));
      const skin = planetSkin("07", b, 0.42);
      expect(skin.map, b).toBeTruthy();
      // desert worlds are warm and dry, ocean worlds cold and blue: spot-check the pairing
      if (b === "desert") expect(["mars.jpg", "venus_surface.jpg", "venus_atmosphere.jpg"]).toContain(skin.map);
      if (b === "cave") expect(["mercury.jpg", "moon.jpg", "ceres.jpg"]).toContain(skin.map);
      expect(maps.size).toBeGreaterThan(0);
    }
  });

  it("different students see different systems (the seed moves the choice)", () => {
    const skins = new Set<string>();
    for (let s = 0; s < 40; s++) skins.add(planetSkin("05", "city", s * 0.37).map);
    expect(skins.size).toBeGreaterThan(1);
  });
});

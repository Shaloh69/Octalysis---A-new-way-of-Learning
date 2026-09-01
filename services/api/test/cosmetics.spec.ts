import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  deriveCosmetics,
  BIOMES,
  PALETTE_VARIANTS,
  type Cosmetics,
} from "../src/routes/cosmetics.js";
import { makeAttemptSeed } from "../src/engine/seed.js";

/**
 * R2.3 — the boundary between "unique game" and "unique exam paper", as a test.
 *
 * The phase file is explicit that this is the enforcement: *"Write a test that
 * asserts this directly... This test is the actual enforcement of the boundary
 * — not the doc, this test."* So the assertions below are deliberately blunt
 * about the thing that must never be true, rather than only checking that the
 * happy path returns plausible values.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const A = "232129001";
const B = "232129002";

describe("cosmetics are deterministic and stable", () => {
  it("gives the same student the same look every time", () => {
    expect(deriveCosmetics(A)).toEqual(deriveCosmetics(A));
  });

  it("gives different students different looks", () => {
    // Not a guarantee for any specific pair -- with 4 palettes and 7 biomes two
    // students can legitimately share both. What must differ is the rotation,
    // which is continuous.
    expect(deriveCosmetics(A).rotationOffset).not.toBe(deriveCosmetics(B).rotationOffset);
  });

  it("spreads a whole cohort across every palette and biome", () => {
    // A "random" derivation that puts 24 students on one palette is a bug that
    // only shows up in a real class. Check against a real class size.
    const cohort = Array.from({ length: 24 }, (_, i) =>
      deriveCosmetics(`2321290${String(i + 1).padStart(2, "0")}`),
    );
    expect(new Set(cohort.map((c) => c.paletteVariant)).size).toBeGreaterThan(1);
    expect(new Set(cohort.map((c) => c.biomeIndex)).size).toBeGreaterThan(2);
    expect(new Set(cohort.map((c) => c.callsign)).size).toBeGreaterThan(20);
  });

  it("stays inside every declared range", () => {
    for (let i = 0; i < 500; i += 1) {
      const c = deriveCosmetics(`student-${i}`);
      expect(c.rotationOffset).toBeGreaterThanOrEqual(0);
      expect(c.rotationOffset).toBeLessThan(Math.PI * 2);
      expect(c.paletteVariant).toBeGreaterThanOrEqual(0);
      expect(c.paletteVariant).toBeLessThan(PALETTE_VARIANTS);
      expect(c.biomeIndex).toBeGreaterThanOrEqual(0);
      expect(c.biomeIndex).toBeLessThan(BIOMES.length);
    }
  });
});

describe("R2.3 — the cosmetic seed is NOT the exam seed", () => {
  it("shares no value with the exam-attempt seed for the same student", () => {
    // The exam seed embeds EXAM_SALT_SECRET. If any cosmetic were a function of
    // it, shipping that cosmetic to a browser would ship a value computed from
    // the salt -- and the hash construction is public.
    const examSeed = makeAttemptSeed({
      studentId: A,
      stageId: "09",
      attemptNo: 1,
      examSalt: "a-real-salt-at-least-forty-characters-long-00",
    });
    const cos = deriveCosmetics(A);

    expect(examSeed).not.toContain(cos.callsign);
    expect(String(cos.rotationOffset)).not.toContain(examSeed.slice(0, 8));
  });

  it("does not change when the exam salt changes", () => {
    // The decisive property. Rotating `exam_salt` between terms
    // (PAGE-SPECS.md §3, /console/assessments) must not repaint anyone's
    // system -- and cannot, because the salt is not an input here.
    const before = deriveCosmetics(A);
    const seedWithSaltOne = makeAttemptSeed({
      studentId: A, stageId: "09", attemptNo: 1, examSalt: "salt-one-".padEnd(40, "x"),
    });
    const seedWithSaltTwo = makeAttemptSeed({
      studentId: A, stageId: "09", attemptNo: 1, examSalt: "salt-two-".padEnd(40, "x"),
    });
    expect(seedWithSaltOne).not.toBe(seedWithSaltTwo); // the exam seed DOES move
    expect(deriveCosmetics(A)).toEqual(before);        // the cosmetic does not
  });

  it("takes exactly one argument — there is nowhere to pass a salt", () => {
    // A signature that cannot accept a salt is the strongest form of this
    // guarantee, so a future change has to argue with a red test.
    //
    // Asserted against the SOURCE, not `Function.length`. The first version of
    // this test used `.length`, and a mutation check caught it being useless:
    // `Function.length` ignores parameters with defaults, so
    // `deriveCosmetics(key, examSalt = "")` still reports 1 -- and a defaulted
    // parameter is precisely how a salt would actually get added.
    const src = readFileSync(
      resolve(ROOT, "services", "api", "src", "routes", "cosmetics.ts"),
      "utf8",
    );
    const sig = src.match(/export function deriveCosmetics\(([^)]*)\)/);
    expect(sig, "deriveCosmetics signature not found").not.toBeNull();
    const params = sig![1]!.split(",").map((x) => x.trim()).filter(Boolean);
    expect(params, `unexpected parameters: ${params.join(" | ")}`).toHaveLength(1);
    expect(params[0]).toMatch(/^key\s*:/);
  });

  it("the cosmetics module never imports the engine", () => {
    const src = readFileSync(
      resolve(ROOT, "services", "api", "src", "routes", "cosmetics.ts"),
      "utf8",
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/from\s+["'][^"']*engine\//);
    expect(code).not.toMatch(/EXAM_SALT/);
  });
});

describe("R2.3 — cosmetics cannot reach curriculum structure", () => {
  /**
   * The map's layout takes stages and objectives, and nothing else. Two
   * students must get an identical map and differ only in how it is dressed.
   *
   * This reads the real layout module rather than a copy of its rules, so it
   * fails if someone threads a seed into it later.
   */
  const LAYOUT = resolve(ROOT, "apps", "web", "src", "solar-system", "layout.ts");

  it("layout.ts has no notion of a student at all", () => {
    const code = readFileSync(LAYOUT, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["studentId", "student_id", "seed", "cosmetic", "rotationOffset"]) {
      expect(code, `layout.ts references ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("no client file derives cosmetics locally instead of reading the endpoint", () => {
    // The client is a thin consumer. If it grew its own hash, two things break:
    // the derivation could drift from the server's, and the "one owner per
    // fact" rule this project applies to documents would stop applying to code.
    const dir = resolve(ROOT, "apps", "web", "src");
    const walk = (d: string, out: string[] = []): string[] => {
      for (const name of readdirSync(d, { withFileTypes: true })) {
        const full = resolve(d, name.name);
        if (name.isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(name.name)) out.push(full);
      }
      return out;
    };
    for (const file of walk(dir)) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(code, `${file} hashes something client-side`).not.toMatch(
        /createHash|sha256|subtle\.digest/,
      );
    }
  });
});

describe("the callsign is a name, not an identifier", () => {
  it("can never be mistaken for a student number", () => {
    // Student numbers are nine digits. A callsign always contains a letter and
    // a hyphen, so the two namespaces cannot overlap.
    for (let i = 0; i < 200; i += 1) {
      const { callsign } = deriveCosmetics(`2321290${i}`);
      expect(callsign).toMatch(/^[A-Z]+-[0-9A-F]{2}$/);
      expect(callsign).not.toMatch(/^\d+$/);
    }
  });

  it("is stable for a student, because it is shown to them", () => {
    const first: Cosmetics = deriveCosmetics(A);
    expect(deriveCosmetics(A).callsign).toBe(first.callsign);
  });
});

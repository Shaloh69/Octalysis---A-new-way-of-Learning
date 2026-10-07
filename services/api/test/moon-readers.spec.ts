import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Nothing student-facing reads `objectives` directly (Studio E2, 8 Oct 2026).
 *
 * A draft moon must not reach a student and a retired one must not hold a
 * planet shut, so every reader that a student's request can reach goes through
 * `live_objectives` (or the lock functions, which count live moons only). About
 * twenty queries once read the table; a twenty-first that forgot the status
 * would show a student a moon nobody has published. This fails on it.
 *
 * Allowed to name the table, with why:
 *   moons.ts             the Studio's own management of moons (staff only)
 *   routes/items.ts      staff: the item editor's moon picker and an import's check
 *   routes/console.ts    staff: "does the table have any rows" for the invariant notes
 */

const SRC = join(__dirname, "..", "src");
const ALLOWED: Record<string, number> = {
  "moons.ts": 4,
  "routes/items.ts": 2,
  "routes/console.ts": 1,
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("moon readers", () => {
  it("only the allowed files read the objectives table directly, and no more often than listed", () => {
    const found: Record<string, number> = {};
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replaceAll("\\", "/");
      const n = [...readFileSync(file, "utf8").matchAll(/\b(?:from|join)\s+objectives\b/gi)].length;
      if (n > 0) found[rel] = n;
    }
    for (const [file, n] of Object.entries(found)) {
      expect(ALLOWED[file], `${file} reads "objectives" directly ${n} time(s); a student-facing reader must use live_objectives`).toBeDefined();
      expect(n, `${file} reads "objectives" more often than allowed`).toBeLessThanOrEqual(ALLOWED[file]!);
    }
  });

  it("the engine's pool, the journey and the map read live moons", () => {
    const read = (f: string) => readFileSync(join(SRC, f), "utf8");
    expect(read("repo/engine-repo.ts")).toMatch(/live_objectives/);
    expect(read("routes/journeys.ts")).toMatch(/live_objectives/);
    expect(read("routes/stages.ts")).toMatch(/live_objectives/);
  });
});

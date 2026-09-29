import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  contrast,
  over,
  parseRules,
  resolveToken,
  toRgb,
  type Declarations,
} from "../contrast";
import { readPng } from "./png";

/**
 * The student app's ten colour sets, held to WCAG AA by computation
 * (`docs/redesign/WEB-REMAKE.md` §0: "AA computed on every colour set that can
 * appear"). Three HUD variants for the star system and seven biomes for inside
 * a planet, each checked for every text/surface pair it uses, for the seeded
 * accent swept 0-359 in steps of 15.
 *
 * Why a sweep and not the twelve presets: the accent is SEEDED (`accentHue`
 * from `/api/v1/cosmetics`, any integer 0-359) before it is ever chosen, so
 * the twelve named presets are not the whole population. Lightness and chroma
 * are fixed per set; the sweep proves that fixing them was enough.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, "..");
const CSS = readFileSync(resolve(PKG, "looks.css"), "utf8");

export const HUD = ["bare-metal", "blueprint", "phosphor"] as const;
export const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;
const HUES = Array.from({ length: 24 }, (_, i) => i * 15);

/** Merge every rule that applies to one set, in source order. */
function setDecls(realm: "star" | "biome", name: string): Declarations {
  const attr = realm === "star" ? `[data-theme="${name}"]` : `[data-biome="${name}"]`;
  const merged: Declarations = new Map();
  for (const rule of parseRules(CSS)) {
    const applies = rule.selectors.some(
      (s) =>
        s === "[data-realm]" ||
        s === `[data-realm="${realm}"]` ||
        (s.includes(`[data-realm="${realm}"]`) && s.includes(attr)),
    );
    if (applies) for (const [k, v] of rule.decls) merged.set(k, v);
  }
  return merged;
}

type Kind = "text" | "non-text";
interface Pair {
  readonly fg: string;
  readonly bg: string;
  readonly kind: Kind;
  /** What the pair is for, printed when it fails. */
  readonly why: string;
}

const T = (fg: string, bg: string, why: string): Pair => ({ fg, bg, kind: "text", why });
const N = (fg: string, bg: string, why: string): Pair => ({ fg, bg, kind: "non-text", why });

/**
 * Every pair a set is used through. A pair missing from this list is a pair
 * nobody checked, so it is written out rather than generated.
 */
const PAIRS: readonly Pair[] = [
  T("--ink", "--surface-0", "body text on the page ground"),
  T("--ink", "--surface-1", "body text in a panel"),
  T("--ink", "--surface-2", "a row's text"),
  T("--ink", "--surface-3", "an active row's text"),
  T("--ink-muted", "--surface-0", "secondary text on the ground"),
  T("--ink-muted", "--surface-1", "secondary text in a panel"),
  T("--ink-muted", "--surface-2", "secondary text in a row"),
  T("--ink-faint", "--surface-0", "tertiary text on the ground"),
  T("--ink-faint", "--surface-1", "tertiary text in a panel"),
  T("--caption-ink", "--caption-bg", "a panel's caption bar"),
  T("--lit-ink", "--lit-bg", "the current tab, a selected row"),
  T("--accent", "--surface-0", "the student's own marker, as words"),
  T("--accent", "--surface-1", "the student's own marker in a panel"),
  T("--accent-fg", "--accent", "text on an accent fill"),
  T("--success", "--success-bg", "a DONE badge"),
  T("--success", "--surface-1", "success text in a panel"),
  T("--danger", "--danger-bg", "an error"),
  T("--danger", "--surface-1", "error text in a panel"),
  T("--warning", "--warning-bg", "a warning"),
  T("--warning", "--surface-1", "warning text in a panel"),
  T("--info", "--info-bg", "a NEW badge, a note"),
  T("--info", "--surface-1", "info text in a panel"),
  T("--locked", "--locked-bg", "a LOCKED badge"),
  T("--locked", "--surface-1", "a lock line in a panel"),
  T("--reg-pc", "--surface-1", "the Register Bar: PC"),
  T("--reg-ir", "--surface-1", "the Register Bar: IR"),
  T("--reg-mar", "--surface-1", "the Register Bar: MAR"),
  T("--reg-mbr", "--surface-1", "the Register Bar: MBR"),
  T("--reg-ac", "--surface-1", "the Register Bar: ACC"),
  T("--reg-alu", "--surface-1", "the Register Bar: ALU"),
  N("--line-strong", "--surface-0", "a control's edge on the ground"),
  N("--line-strong", "--surface-1", "a control's edge in a panel"),
  N("--frame-edge", "--surface-0", "a panel's edge against the page"),
  N("--frame-corner", "--surface-0", "the HUD's corner brackets"),
  N("--frame-inner", "--surface-1", "a frame's inner ring against its own panel"),
  N("--meter-fill", "--meter-track", "a meter's fill against its track"),
  N("--meter-fill", "--surface-1", "a meter's fill in a panel"),
  N("--accent", "--surface-2", "the student's own marker on a row"),
  N("--accent-ring", "--surface-1", "the focus ring in a panel"),
  N("--accent-ring", "--surface-0", "the focus ring on the ground"),
];

const MIN: Record<Kind, number> = { text: 4.5, "non-text": 3 };

interface Result {
  readonly set: string;
  readonly pair: Pair;
  readonly hue: number | null;
  readonly ratio: number;
}

function measure(set: string, decls: Declarations): { results: Result[]; missing: string[] } {
  const results: Result[] = [];
  const missing = new Set<string>();
  for (const pair of PAIRS) {
    const fg = resolveToken(decls, pair.fg);
    const bg = resolveToken(decls, pair.bg);
    if (!fg) missing.add(pair.fg);
    if (!bg) missing.add(pair.bg);
    if (!fg || !bg) continue;
    const usesAccent = fg.h === "accent" || bg.h === "accent";
    for (const hue of usesAccent ? HUES : [0]) {
      // A translucent background is composited over the page ground first.
      const ground = toRgb(resolveToken(decls, "--surface-0")!, hue);
      const bgRgb = bg.alpha < 1 ? over(toRgb(bg, hue), ground, bg.alpha) : toRgb(bg, hue);
      const fgRgb = fg.alpha < 1 ? over(toRgb(fg, hue), bgRgb, fg.alpha) : toRgb(fg, hue);
      results.push({ set, pair, hue: usesAccent ? hue : null, ratio: contrast(fgRgb, bgRgb) });
    }
  }
  return { results, missing: [...missing] };
}

const SETS: Array<{ label: string; decls: Declarations }> = [
  ...HUD.map((t) => ({ label: `hud/${t}`, decls: setDecls("star", t) })),
  ...BIOMES.map((b) => ({ label: `biome/${b}`, decls: setDecls("biome", b) })),
];

describe("looks.css — ten colour sets, AA by computation", () => {
  it("parses ten sets, each with declarations", () => {
    expect(SETS).toHaveLength(10);
    for (const s of SETS) expect(s.decls.size, `${s.label} declares nothing`).toBeGreaterThan(20);
  });

  for (const { label, decls } of SETS) {
    it(`${label}: declares every token its pairs use`, () => {
      expect(measure(label, decls).missing, `${label} is incomplete`).toEqual([]);
    });

    it(`${label}: every pair clears AA, for accent hues 0-359 step 15`, () => {
      const { results } = measure(label, decls);
      const failing = results
        .filter((r) => r.ratio < MIN[r.pair.kind])
        .map(
          (r) =>
            `${r.pair.fg} on ${r.pair.bg}${r.hue === null ? "" : ` @hue ${r.hue}`}: ` +
            `${r.ratio.toFixed(2)} < ${MIN[r.pair.kind]} (${r.pair.why})`,
        );
      // Print the worst ratio per pair, so LOOK.md can quote a measured number.
      const worst = new Map<string, number>();
      for (const r of results) {
        const k = `${r.pair.fg} on ${r.pair.bg}`;
        worst.set(k, Math.min(worst.get(k) ?? Infinity, r.ratio));
      }
      const floor = Math.min(
        ...results.filter((r) => r.pair.kind === "text").map((r) => r.ratio),
      );
      console.log(`${label}: ${results.length} checks, text floor ${floor.toFixed(2)}:1`);
      expect(failing, `${label} fails AA`).toEqual([]);
    });
  }
});

/**
 * The biome frames are Kenney's CC0 sprites (instructor ruling, 30 Sep 2026),
 * so their colours are paint rather than tokens. What a test CAN hold them to:
 * each biome has one, it is the art we measured, its frame band is solid (no
 * scene showing through the frame), and the licence travels with it. The
 * edge a reader sees against the text is the --frame-inner token ring, which
 * the AA sweep above already checks on every surface.
 */
describe("looks.css — the vendored pixel frames", () => {
  const urls = [...CSS.matchAll(/url\("\.\/(pixel\/[\w-]+\.png)"\)/g)].map((m) => m[1]!);

  it("the Kenney licence travels with the sprites", () => {
    expect(existsSync(resolve(PKG, "pixel", "LICENSE-kenney-pixel-ui-pack.txt"))).toBe(true);
  });

  for (const biome of BIOMES) {
    it(`${biome}: a frame and a pressed frame, both referenced and both on disk`, () => {
      for (const f of [`pixel/${biome}.png`, `pixel/${biome}-pressed.png`]) {
        expect(urls, `looks.css never names ${f}`).toContain(f);
        expect(existsSync(resolve(PKG, f)), `${f} is missing`).toBe(true);
      }
    });

    it(`${biome}: 48 by 48, and the 6-pixel frame band is opaque`, () => {
      for (const f of [`pixel/${biome}.png`, `pixel/${biome}-pressed.png`]) {
        const png = readPng(readFileSync(resolve(PKG, f)));
        expect([png.width, png.height], f).toEqual([48, 48]);
        // The four edges between the corners: every pixel the slice keeps.
        const holes: string[] = [];
        for (let i = 6; i < 42; i += 1) {
          for (let d = 0; d < 6; d += 1) {
            for (const [x, y] of [[d, i], [47 - d, i], [i, d], [i, 47 - d]] as const) {
              if (png.pixel(x, y)[3] !== 255) holes.push(`${x},${y}`);
            }
          }
        }
        expect(holes, `${f} has see-through pixels in its frame`).toEqual([]);
      }
    });
  }

  it("every url() in looks.css and fonts.css resolves to a file", () => {
    const fonts = readFileSync(resolve(PKG, "fonts.css"), "utf8");
    const all = [...`${CSS}\n${fonts}`.matchAll(/url\("\.\/([^"]+)"\)/g)].map((m) => m[1]!);
    expect(all.length).toBeGreaterThan(14);
    for (const f of all) expect(existsSync(resolve(PKG, f)), `${f} is missing`).toBe(true);
  });

  it("every face fonts.css loads has its OFL licence beside it", () => {
    const fonts = readFileSync(resolve(PKG, "fonts.css"), "utf8");
    const families = [...fonts.matchAll(/font-family:\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(families).toEqual(["Oxanium", "Inter", "JetBrains Mono"]);
    for (const fam of families) {
      const slug = fam.toLowerCase().replace(/\s+/g, "-");
      expect(existsSync(resolve(PKG, "fonts", `OFL-${slug}.txt`)), `no licence for ${fam}`).toBe(true);
    }
  });
});

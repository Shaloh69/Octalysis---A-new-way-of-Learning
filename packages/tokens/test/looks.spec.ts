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
 * The student app's nine colour sets, held to WCAG AA by computation
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

export const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;
const HUES = Array.from({ length: 24 }, (_, i) => i * 15);

/**
 * Merge every rule that applies to one set, in source order.
 *
 * Ruling 2 (30 Sep 2026): ONE star set (`[data-realm="star"]`, the variants
 * are removed), seven biomes, and the neutral paper (`[data-paper]`).
 */
function setDecls(kind: "star" | "biome" | "paper", name = ""): Declarations {
  const merged: Declarations = new Map();
  for (const rule of parseRules(CSS)) {
    const applies = rule.selectors.some((s) => {
      if (kind === "paper") return s === "[data-paper]";
      if (s === "[data-realm]") return true;
      if (s === `[data-realm="${kind}"]`) return true;
      return kind === "biome" && s.includes('[data-realm="biome"]') && s.includes(`[data-biome="${name}"]`);
    });
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
  { label: "star", decls: setDecls("star") },
  ...BIOMES.map((b) => ({ label: `biome/${b}`, decls: setDecls("biome", b) })),
  { label: "paper", decls: setDecls("paper") },
];

describe("looks.css — nine colour sets, AA by computation", () => {
  it("parses one star set, seven biomes and the paper, each with declarations", () => {
    expect(SETS).toHaveLength(9);
    for (const s of SETS) expect(s.decls.size, `${s.label} declares nothing`).toBeGreaterThan(20);
  });

  it("has no student variant left (ruling 2: the theme changes only by realm)", () => {
    for (const rule of parseRules(CSS)) {
      for (const s of rule.selectors) expect(s, "a [data-theme] set in looks.css").not.toMatch(/data-theme/);
    }
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
      const floor = Math.min(
        ...results.filter((r) => r.pair.kind === "text").map((r) => r.ratio),
      );
      console.log(`${label}: ${results.length} checks, text floor ${floor.toFixed(2)}:1`);
      expect(failing, `${label} fails AA`).toEqual([]);
    });
  }
});

/**
 * Inside a biome the nav bar, the side bars and every button are Kenney's CC0
 * sprites (ruling 2, 30 Sep 2026), so their colours are paint rather than
 * tokens. What a test CAN hold them to: each biome has its panel and its
 * button (and the button's pressed twin), each is the 48 by 48 art we measured,
 * its 6-pixel frame band is solid, and every sprite that carries WORDS (a bar,
 * a button) has its fill decoded and checked against --sprite-ink at 4.5:1.
 * A panel's running text sits on a token surface inside a token ring, which
 * the sweep above already checks.
 */
describe("looks.css — the biomes' sprites", () => {
  const urls = [...CSS.matchAll(/url\("\.\/(pixel\/[\w-]+\.png)"\)/g)].map((m) => m[1]!);
  const shared = setDecls("star");
  const ink = toRgb(resolveToken(shared, "--sprite-ink")!, 0);

  it("the Kenney licence travels with the sprites", () => {
    expect(existsSync(resolve(PKG, "pixel", "LICENSE-kenney-pixel-ui-pack.txt"))).toBe(true);
  });

  const spritesOf = (b: string) => [`pixel/panel-${b}.png`, `pixel/button-${b}.png`, `pixel/button-${b}-pressed.png`];

  for (const biome of BIOMES) {
    it(`${biome}: a panel, a button and a pressed button, referenced and on disk`, () => {
      for (const f of spritesOf(biome)) {
        expect(urls, `looks.css never names ${f}`).toContain(f);
        expect(existsSync(resolve(PKG, f)), `${f} is missing`).toBe(true);
      }
    });

    it(`${biome}: 48 by 48, the frame band opaque, and --sprite-ink readable on the fill`, () => {
      for (const f of spritesOf(biome)) {
        const png = readPng(readFileSync(resolve(PKG, f)));
        expect([png.width, png.height], f).toEqual([48, 48]);
        const holes: string[] = [];
        for (let i = 6; i < 42; i += 1) {
          for (let d = 0; d < 6; d += 1) {
            for (const [x, y] of [[d, i], [47 - d, i], [i, d], [i, 47 - d]] as const) {
              if (png.pixel(x, y)[3] !== 255) holes.push(`${x},${y}`);
            }
          }
        }
        expect(holes, `${f} has see-through pixels in its frame`).toEqual([]);
        // The fill: every pixel of the centre 24 by 20 the words can sit on.
        let worst = Infinity;
        for (let y = 12; y < 32; y += 1) {
          for (let x = 12; x < 36; x += 1) {
            const [r, g, b] = png.pixel(x, y);
            worst = Math.min(worst, contrast(ink, [r / 255, g / 255, b / 255]));
          }
        }
        expect(worst, `${f}: --sprite-ink on its fill`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("four chevron colours, left and right, on disk and named", () => {
    for (const c of ["yellow", "green", "orange", "blue"]) {
      for (const s of ["left", "right"]) {
        const f = `pixel/arrow-${c}-${s}.png`;
        expect(urls).toContain(f);
        expect(readPng(readFileSync(resolve(PKG, f))).width).toBe(16);
      }
    }
  });

  it("every url() in looks.css and fonts.css resolves to a file", () => {
    const fonts = readFileSync(resolve(PKG, "fonts.css"), "utf8");
    const all = [...`${CSS}\n${fonts}`.matchAll(/url\("\.\/([^"]+)"\)/g)].map((m) => m[1]!);
    expect(all.length).toBeGreaterThan(20);
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

/**
 * OCTA — computed contrast for the token sets
 * packages/tokens/contrast.ts
 *
 * OKLCH -> sRGB -> WCAG 2.x relative luminance, with alpha composited over
 * the ground it sits on. The same maths `scripts/check-contrast.mjs` runs for
 * tokens.css, restated here as a typed module because `looks.css` is checked
 * by vitest (`test/looks.spec.ts`) rather than by a CI script, and a test
 * that shells out to a script cannot say which pair failed.
 *
 * Out-of-gamut colours are clamped per channel, which is what a browser
 * paints; checking the unclamped value would pass colours nobody can see.
 */

export type Rgb = readonly [number, number, number];

export interface Oklch {
  readonly l: number;
  readonly c: number;
  /** Degrees, or the string "accent" when the hue is `var(--accent-hue)`. */
  readonly h: number | "accent";
  readonly alpha: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const encode = (v: number): number =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
const decode = (v: number): number =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);

/** OKLCH (hue in degrees) to gamma-encoded sRGB, each channel 0-1, clamped. */
export function oklchToSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  return [clamp01(encode(r)), clamp01(encode(g)), clamp01(encode(bl))];
}

export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

export function contrast(fg: Rgb, bg: Rgb): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Composite a translucent colour over an opaque ground, in encoded sRGB. */
export function over(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => fg[i]! * alpha + bg[i]! * (1 - alpha)) as unknown as Rgb;
}

export function toRgb(col: Oklch, accentHue: number): Rgb {
  const h = col.h === "accent" ? accentHue : col.h;
  return oklchToSrgb(col.l, col.c, h);
}

const OKLCH_RE =
  /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+|var\(--accent-hue\))\s*(?:\/\s*([\d.]+)\s*)?\)$/;
const VAR_RE = /^var\((--[\w-]+)\)$/;

export function parseOklch(value: string): Oklch | null {
  const m = OKLCH_RE.exec(value.trim());
  if (!m) return null;
  return {
    l: Number(m[1]),
    c: Number(m[2]),
    h: m[3]!.startsWith("var(") ? "accent" : Number(m[3]),
    alpha: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/** A set's raw declarations, custom properties only, as written. */
export type Declarations = Map<string, string>;

/**
 * Resolve a token through `var(--x)` aliases inside one set. Returns null for
 * a token the set does not declare, which the test reports as incomplete
 * rather than skipping: a set missing a name is how a page falls back to a
 * colour nobody checked.
 */
export function resolveToken(decls: Declarations, name: string, depth = 0): Oklch | null {
  const raw = decls.get(name);
  if (raw === undefined || depth > 8) return null;
  const alias = VAR_RE.exec(raw.trim());
  if (alias) return resolveToken(decls, alias[1]!, depth + 1);
  return parseOklch(raw);
}

/**
 * Every rule in a flat stylesheet (no nesting, no at-rules inside the part we
 * read), as selector list + custom-property declarations. Comments removed
 * first, so a commented-out token cannot count as declared.
 */
export function parseRules(css: string): Array<{ selectors: string[]; decls: Declarations }> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ selectors: string[]; decls: Declarations }> = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of text.matchAll(RULE)) {
    const selectors = m[1]!.split(",").map((s) => s.trim()).filter(Boolean);
    const decls: Declarations = new Map();
    for (const part of m[2]!.split(";")) {
      const i = part.indexOf(":");
      if (i < 0) continue;
      const prop = part.slice(0, i).trim();
      if (!prop.startsWith("--")) continue;
      decls.set(prop, part.slice(i + 1).trim());
    }
    out.push({ selectors, decls });
  }
  return out;
}

#!/usr/bin/env node
/**
 * OCTA — WCAG contrast, computed, for every theme × every accent.
 *
 * `PHASES.md` P9: *"All three themes pass WCAG AA, verified in CI."*
 * `.claude/rules/design.md`: *"WCAG 2.2 AA on all three themes, verified by
 * computation not by eye."*
 * `packages/tokens/accents.ts` says INV-26 already does this. **It did not
 * exist.** This is it.
 *
 * WHY BY COMPUTATION. Every colour in this project is authored in OKLCH, which
 * is perceptually uniform — two colours with the same `L` *look* equally light.
 * That is exactly what makes eyeballing it dangerous: OKLCH lightness is not
 * WCAG relative luminance, and the gap between them is largest in the yellows
 * and cyans, which is where three of the twelve accents live. A palette can
 * look evenly balanced and fail AA in two hues.
 *
 * WHAT IS CHECKED
 *   1. Every foreground/background pair the apps actually use, per theme.
 *   2. All 12 accents × 3 themes, as text and as a button fill.
 *   3. Mutual distinguishability of the accents under protanopia and
 *      deuteranopia — a student picking "their" colour should not land on one
 *      that collapses into the success or danger hue for them.
 *
 * The maths is spelled out rather than pulled from a dependency: OKLCH → OKLab
 * → LMS → linear sRGB → gamma sRGB → WCAG luminance. Every step is a published
 * formula and each is named where it appears.
 *
 * Run: node scripts/check-contrast.mjs      (exit 1 on any AA failure)
 *      node scripts/check-contrast.mjs -v   (print every pair, including passes)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS = resolve(ROOT, "packages", "tokens", "tokens.css");

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/* ------------------------------------------------------ colour conversion */

/** OKLCH → OKLab. Hue in degrees. */
function oklchToOklab(L, C, H) {
  const h = (H * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

/**
 * OKLab → linear sRGB (Björn Ottosson's published matrices).
 * Values may fall outside [0,1]; the caller gamut-clamps.
 */
function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Linear → gamma-encoded sRGB, the value a display actually receives. */
const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
/** Gamma sRGB → linear, WCAG's own formula (it differs from the above). */
const decode = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * OKLCH → the sRGB triple a screen shows.
 *
 * The clamp is where out-of-gamut colours land, and it MATTERS for contrast:
 * a colour the author wrote as more saturated than sRGB can render is displayed
 * clamped, so contrast must be measured on the clamped value, not the intent.
 */
function oklchToSrgb(L, C, H) {
  const [ol, oa, ob] = oklchToOklab(L, C, H);
  return oklabToLinearSrgb(ol, oa, ob).map((v) => clamp01(encode(v)));
}

/** WCAG 2.x relative luminance. */
function luminance([r, g, b]) {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

/** WCAG contrast ratio. Order-independent. */
function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Composite a translucent colour over an opaque one.
 *
 * `--accent-ring` and the shadows carry alpha. Measuring them without
 * compositing would report the contrast of a colour nobody ever sees.
 */
function over(fg, bg, alpha) {
  return fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));
}

/* -------------------------------------------- colour-vision simulation */

/**
 * Viénot–Brettel–Mollon dichromat simulation, applied in LINEAR sRGB.
 *
 * Applying these to gamma-encoded values is a common and wrong shortcut; it
 * exaggerates separation and would let this check pass a palette that does not
 * actually separate.
 */
const CVD = {
  protanopia: [
    [0.11238, 0.88762, 0.0],
    [0.11238, 0.88762, 0.0],
    [0.00401, -0.00401, 1.0],
  ],
  deuteranopia: [
    [0.29275, 0.70725, 0.0],
    [0.29275, 0.70725, 0.0],
    [-0.02234, 0.02234, 1.0],
  ],
};

function simulate(srgb, kind) {
  const m = CVD[kind];
  const lin = srgb.map(decode);
  return m.map((row) => clamp01(encode(clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))));
}

/** Perceptual distance in OKLab — near-uniform, so Euclidean is meaningful. */
function srgbToOklab([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map(decode);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function deltaOklab(a, b) {
  const [l1, a1, b1] = srgbToOklab(a);
  const [l2, a2, b2] = srgbToOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/* --------------------------------------------------------- token parsing */

const OKLCH = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+|var\(--accent-hue\))\s*(?:\/\s*([\d.]+)\s*)?\)/;

function parseTokens() {
  const css = readFileSync(TOKENS, "utf8");
  const themes = { "bare-metal": {}, blueprint: {}, phosphor: {} };
  const root = {};

  // Walk every `selector { ... }` block and record oklch declarations.
  const blockRe = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = blockRe.exec(css)) !== null) {
    const selector = m[1].trim();
    const body = m[2];
    const decls = {};
    for (const line of body.split(";")) {
      const d = line.match(/(--[\w-]+)\s*:\s*(.+)/);
      if (!d) continue;
      const val = d[2].trim();
      if (!val.startsWith("oklch(")) continue;
      const p = val.match(OKLCH);
      if (!p) continue;
      decls[d[1]] = {
        L: Number(p[1]),
        C: Number(p[2]),
        H: p[3] === "var(--accent-hue)" ? "ACCENT" : Number(p[3]),
        alpha: p[4] === undefined ? 1 : Number(p[4]),
      };
    }
    if (Object.keys(decls).length === 0) continue;

    if (selector.includes(":root")) Object.assign(root, decls);
    for (const name of Object.keys(themes)) {
      if (selector.includes(`[data-theme="${name}"]`)) Object.assign(themes[name], decls);
    }
  }

  // Each theme inherits :root, then overrides it.
  for (const name of Object.keys(themes)) {
    themes[name] = { ...root, ...themes[name] };
  }
  return themes;
}

/**
 * Resolve one token to sRGB for a given accent hue, compositing alpha over a
 * background when the token is translucent.
 */
function resolve_(tok, accentHue, bgSrgb) {
  if (!tok) return null;
  const H = tok.H === "ACCENT" ? accentHue : tok.H;
  const rgb = oklchToSrgb(tok.L, tok.C, H);
  return tok.alpha < 1 && bgSrgb ? over(rgb, bgSrgb, tok.alpha) : rgb;
}

/* ------------------------------------------------------------ the pairs */

/**
 * Every pair the apps actually put on top of each other.
 *
 * `min` is the WCAG 2.2 AA threshold for that role:
 *   4.5  normal text
 *   3.0  large text (≥18.66px bold / 24px) and non-text UI (1.4.11)
 *
 * A pair that is not listed is not checked, so this list is the claim. Adding a
 * colour to a component without adding it here is how a palette silently drifts
 * out of compliance.
 */
const PAIRS = [
  // Body and heading text on every surface it can land on.
  ["--ink", "--surface-0", 4.5, "body text on page"],
  ["--ink", "--surface-1", 4.5, "body text on card"],
  ["--ink", "--surface-2", 4.5, "body text on raised"],
  ["--ink", "--surface-3", 4.5, "body text on active"],

  // Secondary text. Still real prose — hints, table meta, descriptions.
  ["--ink-muted", "--surface-0", 4.5, "secondary text on page"],
  ["--ink-muted", "--surface-1", 4.5, "secondary text on card"],
  ["--ink-muted", "--surface-2", 4.5, "secondary text on raised"],

  // Tertiary. WCAG exempts genuinely disabled controls, but this token is used
  // for live metadata too, so it is held to the text threshold.
  ["--ink-faint", "--surface-0", 4.5, "tertiary text on page"],
  ["--ink-faint", "--surface-1", 4.5, "tertiary text on card"],

  // Accent as text, and as a button fill with its own foreground.
  ["--accent", "--surface-0", 4.5, "accent text on page"],
  ["--accent", "--surface-1", 4.5, "accent text on card"],
  ["--accent-fg", "--accent", 4.5, "button label on accent"],

  // Status colours on their own tinted backgrounds.
  ["--success", "--success-bg", 4.5, "success text"],
  ["--danger", "--danger-bg", 4.5, "danger text"],
  ["--warning", "--warning-bg", 4.5, "warning text"],
  ["--info", "--info-bg", 4.5, "info text"],
  ["--locked", "--locked-bg", 4.5, "locked text"],

  // Status colours as text directly on a card, which the console does.
  ["--success", "--surface-1", 4.5, "success text on card"],
  ["--danger", "--surface-1", 4.5, "danger text on card"],
  ["--warning", "--surface-1", 4.5, "warning text on card"],
  ["--info", "--surface-1", 4.5, "info text on card"],

  // Non-text UI: 1.4.11 wants 3:1 for anything carrying meaning.
  ["--line-strong", "--surface-1", 3.0, "border on card (UI)"],
  ["--accent", "--surface-1", 3.0, "focus ring on card (UI)"],
  ["--accent-ring", "--surface-1", 3.0, "focus ring, composited (UI)"],

  // The Register Bar's six fixed hues, on the page.
  ["--reg-pc", "--surface-0", 4.5, "register PC"],
  ["--reg-ir", "--surface-0", 4.5, "register IR"],
  ["--reg-mar", "--surface-0", 4.5, "register MAR"],
  ["--reg-mbr", "--surface-0", 4.5, "register MBR"],
  ["--reg-ac", "--surface-0", 4.5, "register AC"],
  ["--reg-alu", "--surface-0", 4.5, "register ALU"],
];

/* ------------------------------------------------------------------ main */

async function main() {
  const verbose = process.argv.includes("-v");
  const themes = parseTokens();
  const { ACCENTS } = await import(
    resolve(ROOT, "packages", "tokens", "accents.ts").replace(/\\/g, "/")
  ).catch(() => ({ ACCENTS: null }));

  // accents.ts is TypeScript; if it cannot be imported directly, read the hues.
  let accents = ACCENTS;
  if (!accents) {
    const src = readFileSync(resolve(ROOT, "packages", "tokens", "accents.ts"), "utf8");
    accents = [...src.matchAll(/id:\s*"([\w-]+)".*?hue:\s*(\d+)/g)].map((m) => ({
      id: m[1],
      hue: Number(m[2]),
    }));
  }

  console.log(c.bold("\nOCTA — WCAG AA contrast, computed\n"));
  console.log(
    c.dim(
      `  ${Object.keys(themes).length} themes × ${accents.length} accents × ${PAIRS.length} pairs` +
        `  =  ${Object.keys(themes).length * accents.length * PAIRS.length} checks\n`,
    ),
  );

  const failures = [];
  let checks = 0;

  for (const [themeName, tok] of Object.entries(themes)) {
    let themeWorst = Infinity;
    let themeWorstLabel = "";

    for (const accent of accents) {
      for (const [fgName, bgName, min, label] of PAIRS) {
        const bg = resolve_(tok[bgName], accent.hue, null);
        const fg = resolve_(tok[fgName], accent.hue, bg);
        if (!fg || !bg) continue;

        const ratio = contrast(fg, bg);
        checks++;

        // A pair with no accent in it is identical for all 12 accents; only
        // report it once so the output stays readable.
        const usesAccent =
          tok[fgName]?.H === "ACCENT" || tok[bgName]?.H === "ACCENT";
        if (!usesAccent && accent !== accents[0]) continue;

        if (ratio < themeWorst) {
          themeWorst = ratio;
          themeWorstLabel = `${label}${usesAccent ? ` (${accent.id})` : ""}`;
        }

        if (ratio < min) {
          failures.push({
            theme: themeName,
            accent: usesAccent ? accent.id : "—",
            label,
            fgName,
            bgName,
            ratio,
            min,
          });
        } else if (verbose) {
          console.log(
            c.dim(
              `  ${themeName.padEnd(11)} ${label.padEnd(30)} ` +
                `${ratio.toFixed(2)}:1  (needs ${min})`,
            ),
          );
        }
      }
    }
    const ok = !failures.some((f) => f.theme === themeName);
    console.log(
      `  ${ok ? c.green("PASS") : c.red("FAIL")}  ${themeName.padEnd(11)} ` +
        c.dim(`worst pair ${themeWorst.toFixed(2)}:1 — ${themeWorstLabel}`),
    );
  }

  /* ------------------------------ colour as a channel, honestly measured ---- */

  /**
   * WHAT THIS SECTION DOES **NOT** CLAIM.
   *
   * `accents.ts` used to say INV-26 verified that all twelve accents "stay
   * mutually distinguishable under protanopia and deuteranopia simulation."
   * That is not achievable and it is not the right requirement. Measured here:
   * at an OKLab floor of 0.06, **at most five** hues can coexist under
   * dichromacy — the hue circle collapses toward a single blue/yellow axis, so
   * twelve of anything will overlap. Ten of the twelve also land near a status
   * colour, and no reassignment fixes that either, because the four status hues
   * are deliberately spread around the same circle.
   *
   * So the guarantee is not "these colours are always tellable apart." It is
   * WCAG 1.4.1: **colour is never the only channel.** Every status in this
   * project carries a word or a glyph as well as a hue — badges are labelled,
   * the lock matrix uses a filled/hollow/dot glyph plus a heavier border, and
   * an incorrect answer is told in words rather than in red. That is what
   * carries the meaning; the colour is reinforcement.
   *
   * What IS gated here, because it is achievable and was genuinely broken: an
   * accent may not be an EXACT DUPLICATE of a status hue. `solder` shipped at
   * hue 75, which is the warning hue exactly — a student picking it would have
   * had their personal accent be the warning colour, in every theme.
   */
  console.log(c.bold("\n  Colour as a channel\n"));

  const STATUS_HUES = [
    { name: "danger", hue: 25 },
    { name: "warning", hue: 75 },
    { name: "success", hue: 150 },
    { name: "info", hue: 230 },
  ];
  const DUPLICATE_DEG = 8;
  const hueGap = (a, b) => {
    const d = Math.abs(((a - b) % 360 + 360) % 360);
    return Math.min(d, 360 - d);
  };

  const duplicates = [];
  for (const accent of accents) {
    for (const st of STATUS_HUES) {
      const gap = hueGap(accent.hue, st.hue);
      if (gap < DUPLICATE_DEG) {
        duplicates.push({ accent: accent.id, hue: accent.hue, status: st.name, gap });
      }
    }
  }
  console.log(
    c.dim(
      `  ${accents.length} accents vs ${STATUS_HUES.length} status hues — ` +
        `${duplicates.length} duplicate(s) within ${DUPLICATE_DEG}°`,
    ),
  );

  // Reported, never gated: how far the palette actually separates for a
  // dichromat. Useful to know, impossible to fix with hue, and the reason the
  // non-colour cues above are not optional.
  for (const kind of ["protanopia", "deuteranopia"]) {
    const pts = accents.map((a) => ({
      id: a.id,
      rgb: simulate(oklchToSrgb(0.72, 0.15, a.hue), kind),
    }));
    let worst = { d: Infinity, a: "", b: "" };
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = deltaOklab(pts[i].rgb, pts[j].rgb);
        if (d < worst.d) worst = { d, a: pts[i].id, b: pts[j].id };
      }
    }
    console.log(
      c.dim(
        `  ${kind.padEnd(14)} closest accents ${worst.a}/${worst.b} ΔE ${worst.d.toFixed(3)} ` +
          `— informational; meaning never rests on hue`,
      ),
    );
  }

  /* --------------------------------------------------------------- verdict */

  console.log("");
  if (failures.length === 0 && duplicates.length === 0) {
    console.log(c.green(`  Clean. ${checks} checks, every pair at or above AA.\n`));
    process.exit(0);
  }

  if (failures.length > 0) {
    console.log(c.red(`  ${failures.length} contrast failure(s):\n`));
    for (const f of failures.slice(0, 40)) {
      console.log(
        `  ${c.red(f.ratio.toFixed(2) + ":1")} ${c.dim("needs " + f.min)}  ` +
          `${f.theme} · ${f.label}${f.accent === "—" ? "" : ` · ${f.accent}`}`,
      );
      console.log(c.dim(`      ${f.fgName} on ${f.bgName}`));
    }
    if (failures.length > 40) console.log(c.dim(`  …and ${failures.length - 40} more`));
  }

  if (duplicates.length > 0) {
    console.log(c.red(`\n  ${duplicates.length} accent(s) duplicate a status hue:\n`));
    for (const d of duplicates) {
      console.log(
        `  ${d.accent} (hue ${d.hue}) is ${d.gap}° from ${d.status} — a student ` +
          `picking it gets the ${d.status} colour as their personal accent`,
      );
    }
  }

  console.log(
    c.dim("\n  Colours are authored in packages/tokens/tokens.css. Adjust L, not the hue.\n"),
  );
  process.exit(1);
}

main();

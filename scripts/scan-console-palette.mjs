#!/usr/bin/env node
/**
 * OCTA -- prove the console never reintroduces the upstream palette.
 *
 * `apps/console/CLAUDE.md`: "Never reintroduce slate/blue; a lint rule fails the
 * build on `slate-` or `blue-` utility classes." `PHASES.md` P4 makes it an exit
 * criterion. This is that rule.
 *
 * The console shell is adapted from shadcn-admin, whose palette is slate and
 * blue. Those classes do not error at build time -- with Tailwind's default
 * palette deleted (see apps/console/tailwind.config.ts) they simply produce no
 * CSS, so the element renders unstyled and the violation is invisible in review
 * until someone notices a washed-out table three weeks later.
 *
 * Two further things this checks, both of which are the same failure wearing a
 * different hat:
 *
 *   - a LITERAL HEX anywhere outside packages/tokens (CLAUDE.md, "Design")
 *   - a `dark:` variant, which would mean someone reached for Tailwind's theme
 *     mechanism instead of [data-theme], splitting the palette in two
 *
 * Run: node scripts/scan-console-palette.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = resolve(ROOT, "apps", "console");
const EXTS = new Set([".ts", ".tsx", ".css", ".html"]);

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

/**
 * Tailwind colour utilities from the upstream palette.
 *
 * Anchored to a utility PREFIX (`bg-`, `text-`, `border-`, ...) so the word
 * "slate" in a comment or a student's name is not a finding. `scan-bundle.mjs`
 * learned this the hard way in V-45, where "tera" matched inside "iterate".
 */
const BANNED_HUES = [
  "slate", "blue", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];
const UTILITY_PREFIXES = [
  "bg", "text", "border", "ring", "fill", "stroke", "from", "via", "to",
  "divide", "outline", "accent", "caret", "shadow", "decoration", "placeholder",
];

const paletteRe = new RegExp(
  String.raw`\b(?:${UTILITY_PREFIXES.join("|")})-(?:${BANNED_HUES.join("|")})-\d{2,3}\b`,
  "g",
);
// #abc / #aabbcc / #aabbccdd, but not a fragment like "#a" or an id selector.
const hexRe = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1,5})?\b/g;
const darkVariantRe = /\bdark:[a-z[]/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

const findings = [];
const files = walk(TARGET);

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;

    for (const m of line.matchAll(paletteRe)) {
      findings.push({ at, kind: "upstream palette", hit: m[0], line: line.trim() });
    }
    for (const m of line.matchAll(darkVariantRe)) {
      findings.push({ at, kind: "dark: variant", hit: m[0], line: line.trim() });
    }
    for (const m of line.matchAll(hexRe)) {
      findings.push({ at, kind: "literal hex", hit: m[0], line: line.trim() });
    }
  });
}

console.log(c.bold("\nOCTA -- console palette scan\n"));
console.log(c.dim(`  ${files.length} file(s) scanned under apps/console`));
console.log(
  c.dim(
    `  ${BANNED_HUES.length} banned hues x ${UTILITY_PREFIXES.length} utility prefixes, ` +
      `plus literal hex and dark: variants`,
  ),
);

if (findings.length === 0) {
  console.log(c.green("\n  Clean. The palette is packages/tokens and nothing else.\n"));
  process.exit(0);
}

console.log(c.red(`\n  ${findings.length} finding(s):\n`));
for (const f of findings) {
  console.log(`  ${c.red(f.kind.padEnd(18))} ${f.hit}`);
  console.log(c.dim(`    ${f.at}`));
  console.log(c.dim(`    ${f.line.slice(0, 100)}`));
}
console.log(
  c.dim(
    "\n  Colours come from packages/tokens as CSS custom properties. " +
      "See apps/console/tailwind.config.ts.\n",
  ),
);
process.exit(1);

/**
 * OCTA — the twelve accent presets
 * packages/tokens/accents.ts
 *
 * We ship twelve named hues, not a colour wheel.
 *
 * Why: a free picker gives infinite untested combinations. A student
 * choosing #FFEE00 on the Blueprint (light) theme would make their own
 * progress UI unreadable, and some hues collapse into the success/danger
 * hues under deuteranopia. Twelve pre-verified hues give the same
 * ownership feeling with none of that risk — and names are more
 * memorable than a hex anyway.
 *
 * Names come from the subject's own world, not from a paint catalogue.
 *
 * Store `hue` in profiles.accent_hue. Never store a hex.
 * Lightness and chroma are fixed per theme in tokens.css, which is what
 * keeps contrast constant across every hue in this list.
 *
 * `scripts/check-contrast.mjs` verifies in CI that all twelve pass WCAG AA
 * against all three themes -- 1080 computed checks, and it has failed and
 * been fixed once.
 *
 * IT DOES NOT VERIFY that the twelve stay mutually distinguishable under
 * protanopia and deuteranopia. This file used to claim that, and the claim was
 * not achievable: measured at an OKLab floor of 0.06, **at most five** hues can
 * coexist under dichromacy, because the hue circle collapses toward a single
 * blue/yellow axis. Ten of these twelve also land near a status colour, and no
 * reassignment fixes that either -- the four status hues are deliberately
 * spread around the same circle.
 *
 * The real guarantee is WCAG 1.4.1: **colour is never the only channel.** Every
 * status carries a word or a glyph as well as a hue. The accent is
 * personalisation -- it is never compared to another accent and never encodes
 * meaning -- so its hue only has to avoid being an EXACT duplicate of a status
 * hue, which is gated at 8 degrees.
 */

export type AccentPreset = {
  id: string;
  name: string;
  hue: number;      // OKLCH hue, degrees
  blurb: string;    // shown in the settings picker
};

export const ACCENTS: AccentPreset[] = [
  { id: "copper",       name: "Copper",       hue:  45, blurb: "Trace metal. The default." },
  // Was hue 75, which is the WARNING hue exactly: a student picking Solder got
  // the warning colour as their personal accent, in all three themes. Moved to
  // 90 (brassier, still warm) -- 15 degrees clear of warning and 10 of Ground.
  { id: "solder",       name: "Solder",       hue:  90, blurb: "Warm brass-and-tin sheen." },
  { id: "phosphor",     name: "Phosphor",     hue: 140, blurb: "CRT green." },
  { id: "trace",        name: "Trace",        hue: 160, blurb: "Etched board." },
  { id: "oscilloscope", name: "Oscilloscope", hue: 185, blurb: "Signal cyan." },
  { id: "bus",          name: "Bus",          hue: 210, blurb: "Data line blue." },
  { id: "silicon",      name: "Silicon",      hue: 240, blurb: "Wafer indigo." },
  { id: "anode",        name: "Anode",        hue: 280, blurb: "Bias violet." },
  { id: "magnet",       name: "Magnet",       hue: 310, blurb: "Core memory." },
  { id: "flux",         name: "Flux",         hue: 340, blurb: "Rosin pink." },
  { id: "ferrite",      name: "Ferrite",      hue:  15, blurb: "Iron oxide red." },
  { id: "ground",       name: "Ground",       hue: 100, blurb: "Earth line." },
];

export const DEFAULT_ACCENT = "copper";

/** Apply a student's accent. Call once on boot and on change. */
export function applyAccent(hue: number, el: HTMLElement = document.documentElement) {
  el.style.setProperty("--accent-hue", String(hue));
}

/**
 * The default, as a value rather than an index.
 *
 * `ACCENTS[0]` is `AccentPreset | undefined` under `noUncheckedIndexedAccess`,
 * so the old fallback did not typecheck once anything strict imported this
 * file -- which nothing did until the student settings page arrived. Naming the
 * default explicitly is both type-safe and clearer than trusting array order.
 */
const COPPER: AccentPreset = {
  id: "copper",
  name: "Copper",
  hue: 45,
  blurb: "Trace metal. The default.",
};

export function accentById(id: string): AccentPreset {
  return ACCENTS.find((a) => a.id === id) ?? COPPER;
}

/**
 * Scope rules — enforced by review, not by the type system.
 *
 * Accent MAY colour:  the student's own progress, their node on the stage
 *                     map, Register Bar highlight, focus rings, selection,
 *                     their Engineer's Log cover and certificate.
 *
 * Accent MAY NOT colour: correct/incorrect feedback, danger, warning,
 *                     success, lock states, or anything in Lecture Mode
 *                     aggregates (those are anonymous).
 *
 * Semantic colours are never derived from the accent. Red must always
 * mean danger regardless of what hue the student picked.
 */

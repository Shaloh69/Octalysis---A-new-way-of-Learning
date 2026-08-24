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
 * INV-26 (docs/AUDITS.md) verifies in CI that all twelve pass WCAG AA
 * against all three themes and stay mutually distinguishable under
 * protanopia and deuteranopia simulation.
 */

export type AccentPreset = {
  id: string;
  name: string;
  hue: number;      // OKLCH hue, degrees
  blurb: string;    // shown in the settings picker
};

export const ACCENTS: AccentPreset[] = [
  { id: "copper",       name: "Copper",       hue:  45, blurb: "Trace metal. The default." },
  { id: "solder",       name: "Solder",       hue:  75, blurb: "Warm tin-lead sheen." },
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

export function accentById(id: string): AccentPreset {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
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

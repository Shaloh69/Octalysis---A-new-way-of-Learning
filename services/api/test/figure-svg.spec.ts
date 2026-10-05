import { describe, it, expect } from "vitest";
import { checkFigureSvg } from "../../../scripts/lib/figure-svg.mjs";

/**
 * The gate every course figure passes before sync writes it (instructor
 * rulings, 6 Oct 2026; docs/FIGURES-AND-AUDIO.md). Figures render INLINE, so
 * this is the line between a diagram and a script running on a student's page.
 * Refusals first: each one is a way a figure could carry code, colour or an
 * unreadable size into the course.
 */

const ID = "10-format";
const ok = (inner = "", root = 'viewBox="0 0 480 120"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${root}>
  <title>A 16-bit instruction format</title>
  <desc>Three fields: a 4-bit opcode and two 6-bit operand references.</desc>
  <defs><marker id="${ID}-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="fig-ink" fill="currentColor"/></marker></defs>
  <rect x="10" y="10" width="120" height="40" class="fig-box" fill="none" stroke="currentColor"/>
  <text x="70" y="36" font-size="14" text-anchor="middle" class="fig-ink">Opcode &amp; mode</text>
  <line x1="130" y1="30" x2="200" y2="30" stroke="currentColor" marker-end="url(#${ID}-arrow)"/>
  ${inner}
</svg>`;

const problemsOf = (svg: string, id = ID) => checkFigureSvg(svg, id).problems;

describe("refused: a figure is a drawing, never code", () => {
  it("a <script> element", () => {
    expect(problemsOf(ok('<script>alert(1)</script>')).join(" ")).toMatch(/<script> is not a drawing element/);
  });
  it("an on* handler", () => {
    expect(problemsOf(ok('<rect x="0" y="0" width="1" height="1" onclick="alert(1)"/>')).join(" ")).toMatch(/onclick handlers/);
  });
  it("foreignObject, image and use", () => {
    for (const el of ["foreignObject", "image", "use"]) {
      expect(problemsOf(ok(`<${el} x="0" y="0"/>`)).join(" ")).toMatch(new RegExp(`<${el}> is not a drawing element`));
    }
  });
  it("a reference outside the figure", () => {
    expect(problemsOf(ok('<line x1="0" y1="0" x2="1" y2="1" marker-end="url(https://x.test/a.svg#m)"/>')).length).toBeGreaterThan(0);
  });
  it("a DOCTYPE or an entity, the classic XML expansion attack", () => {
    expect(problemsOf(`<!DOCTYPE svg [<!ENTITY a "aaaa">]>${ok()}`).join(" ")).toMatch(/DOCTYPE/);
  });
  it("an attribute in single quotes slips no markup past the walk", () => {
    expect(problemsOf(ok("<rect x='0' onclick='alert(1)'/>")).length).toBeGreaterThan(0);
  });
  it("a style attribute or element", () => {
    expect(problemsOf(ok('<rect x="0" y="0" width="1" height="1" style="fill:red"/>')).join(" ")).toMatch(/style is not allowed/);
    expect(problemsOf(ok("<style>rect{fill:red}</style>")).join(" ")).toMatch(/<style> is not a drawing element/);
  });
});

describe("refused: colour and size are the page's, not the figure's", () => {
  it("a literal colour on fill or stroke", () => {
    expect(problemsOf(ok('<rect x="0" y="0" width="1" height="1" fill="#ff0000"/>')).join(" ")).toMatch(/colour comes from a fig-\* class/);
    expect(problemsOf(ok('<rect x="0" y="0" width="1" height="1" stroke="red"/>')).join(" ")).toMatch(/colour comes from/);
  });
  it("a class that is not fig-*", () => {
    expect(problemsOf(ok('<rect x="0" y="0" width="1" height="1" class="danger"/>')).join(" ")).toMatch(/only the fig-\* classes/);
    // fig-* is not enough: it must be one figure.css actually styles.
    expect(problemsOf(ok('<rect x="0" y="0" width="1" height="1" class="fig-red"/>')).join(" ")).toMatch(/only the fig-\* classes/);
  });
  it("text under 12 units", () => {
    expect(problemsOf(ok('<text x="0" y="10" font-size="9">tiny</text>')).join(" ")).toMatch(/unreadable at 380px/);
  });
  it("a viewBox wider than 640", () => {
    expect(problemsOf(ok("", 'viewBox="0 0 900 200"')).join(" ")).toMatch(/at most 640/);
  });
  it("a fixed width or height on the root", () => {
    expect(problemsOf(ok("", 'viewBox="0 0 480 120" width="480"')).join(" ")).toMatch(/no width or height/);
  });
});

describe("refused: what a reader and a page need", () => {
  it("no <title>, so no accessible name", () => {
    const svg = ok().replace(/<title>.*<\/title>/, "");
    expect(problemsOf(svg).join(" ")).toMatch(/needs a <title>/);
  });
  it("no <desc>", () => {
    const svg = ok().replace(/<desc>.*<\/desc>/, "");
    expect(problemsOf(svg).join(" ")).toMatch(/needs a <desc>/);
  });
  it("an id that could collide with another figure's on the same page", () => {
    expect(problemsOf(ok('<g id="arrow"></g>')).join(" ")).toMatch(/must start with "10-format-"/);
  });
  it("a double hyphen inside a comment, which makes the file malformed", () => {
    expect(problemsOf(`<!-- a -- b -->${ok()}`).join(" ")).toMatch(/double hyphen/);
  });
  it("an unclosed element", () => {
    expect(problemsOf(ok("<g>")).join(" ")).toMatch(/never closed|closes/);
  });
  it("an id that is not NN-slug", () => {
    expect(problemsOf(ok(), "Format").join(" ")).toMatch(/not NN-slug/);
  });
});

describe("accepted", () => {
  it("a well-formed figure passes and yields its title", () => {
    const r = checkFigureSvg(ok(), ID);
    expect(r.problems).toEqual([]);
    expect(r.title).toBe("A 16-bit instruction format");
  });
  it("an XML declaration and a clean comment are fine", () => {
    expect(problemsOf(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- drawn for OCTA -->\n${ok()}`)).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { prepareFigure } from "../src/lib/figure";

/**
 * The student app's second guard on a course figure before it is drawn inline.
 * The gate is scripts/lib/figure-svg.mjs at sync; this refuses outright
 * anything that could run, in case a drawing ever reached the database by
 * another road.
 */

const OK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><title>Probe</title><desc>Two boxes &amp; a line.</desc><rect x="1" y="1" width="10" height="10" class="fig-box"/></svg>`;

describe("refused", () => {
  it.each([
    ["a script", OK.replace("</svg>", "<script>alert(1)</script></svg>")],
    ["a handler", OK.replace("<rect ", '<rect onclick="alert(1)" ')],
    ["foreignObject", OK.replace("</svg>", "<foreignObject></foreignObject></svg>")],
    ["a javascript: link", OK.replace("</svg>", '<a href="javascript:alert(1)"></a></svg>')],
    ["not an svg at all", "<div>hello</div>"],
  ])("%s is not drawn", (_, svg) => {
    expect(prepareFigure(svg).html).toBeNull();
  });
});

describe("drawn", () => {
  it("hides the drawing from assistive tech and returns its description as text", () => {
    const p = prepareFigure(OK);
    expect(p.html).toMatch(/^<svg aria-hidden="true" focusable="false" xmlns=/);
    expect(p.desc).toBe("Two boxes & a line.");
  });

  it("an XML declaration and a comment before the root are fine", () => {
    expect(prepareFigure(`<?xml version="1.0"?>\n<!-- drawn for OCTA -->\n${OK}`).html).not.toBeNull();
  });
});

describe("the two copies", () => {
  it("apps/web and apps/console prepare a figure with the same code", async () => {
    const { readFile } = await import("node:fs/promises");
    const strip = (s: string) => s.replace(/\/\*\*[\s\S]*?\*\/\n/, "").trim();
    const web = await readFile(new URL("../src/lib/figure.ts", import.meta.url), "utf8");
    const con = await readFile(new URL("../../console/src/lib/figure.ts", import.meta.url), "utf8");
    expect(strip(web)).toBe(strip(con));
  });
});

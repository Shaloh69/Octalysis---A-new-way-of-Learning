import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * R3: "Shared icon — packages/tokens/icon.svg wired into both apps and
 * verified rendering at 96/48/32/16 on light and dark chrome."
 *
 * Wired: each app's built index.html links /icon.svg, and each app SERVES the
 * token package's file byte for byte (a copy that drifts is a second icon).
 * Rendering: the file parses as XML (the first icon.svg printed "ok" and drew
 * a broken-image glyph, root CLAUDE.md), and at every size on both chromes it
 * decodes and draws real pixels, the lit body included at 16. The preview is
 * written to design/templates/icon-preview.png, both rows, and must be opened.
 */

const SOURCE = readFileSync("packages/tokens/icon.svg", "utf8");
const APPS = [
  { name: "web", url: process.env.OCTA_WEB_URL ?? "http://localhost:5173", dist: "apps/web/dist/index.html" },
  { name: "console", url: process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174", dist: "apps/console/dist/index.html" },
];
const SIZES = [96, 48, 32, 16];

for (const app of APPS) {
  test(`${app.name}: links and serves the token package's icon, byte for byte`, async ({ request }) => {
    expect(readFileSync(app.dist, "utf8")).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/icon\.svg"/);
    const res = await request.get(`${app.url}/icon.svg`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/svg+xml");
    expect((await res.text()).replace(/\r\n/g, "\n")).toBe(SOURCE.replace(/\r\n/g, "\n"));
  });
}

test("it parses, and draws at 96/48/32/16 on dark and light chrome", async ({ page }, info) => {
  const doc = await page.evaluate((svg) => {
    const d = new DOMParser().parseFromString(svg, "image/svg+xml");
    return { error: d.querySelector("parsererror")?.textContent ?? null, root: d.documentElement.nodeName };
  }, SOURCE);
  expect(doc).toEqual({ error: null, root: "svg" });

  const src = `data:image/svg+xml;base64,${Buffer.from(SOURCE).toString("base64")}`;
  const row = (label: string, bg: string, ink: string) => `
    <section style="background:${bg};color:${ink};display:flex;align-items:center;gap:40px;padding:40px">
      ${SIZES.map((s) => `<img data-size="${s}" src="${src}" width="${s}" height="${s}" alt="">`).join("")}
      <span style="font:20px system-ui">${label} chrome</span>
    </section>`;
  // Chrome colours as plain rgb(): this is a harness page, not the product.
  await page.setContent(
    `<body style="margin:0">${row("dark", "rgb(33 35 40)", "rgb(170 175 185)")}${row("light", "rgb(255 255 255)", "rgb(60 64 70)")}</body>`,
  );
  const imgs = page.locator("img");
  await expect(imgs).toHaveCount(SIZES.length * 2);

  const drawn = await imgs.evaluateAll(async (els) => {
    const out: Array<{ size: number; ok: boolean; inked: number; lit: number }> = [];
    for (const el of els as HTMLImageElement[]) {
      await el.decode();
      const size = Number(el.dataset.size);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const x = c.getContext("2d")!;
      x.drawImage(el, 0, 0, size, size);
      const d = x.getImageData(0, 0, size, size).data;
      let inked = 0;
      let lit = 0; // the one lit body: green clearly above red and blue
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! > 32) inked++;
        if (d[i + 3]! > 128 && d[i + 1]! > d[i]! + 40 && d[i + 1]! > d[i + 2]! + 20) lit++;
      }
      out.push({ size, ok: el.complete && el.naturalWidth > 0, inked: inked / (size * size), lit });
    }
    return out;
  });
  for (const d of drawn) {
    expect(d.ok, `${d.size}px decoded`).toBe(true);
    expect(d.inked, `${d.size}px drew`).toBeGreaterThan(0.5);
    expect(d.lit, `${d.size}px shows the lit body`).toBeGreaterThan(0);
  }
  if (!info.project.name.includes("380")) {
    await page.setViewportSize({ width: 760, height: 400 });
    await page.screenshot({ path: "design/templates/icon-preview.png", fullPage: true });
  }
});

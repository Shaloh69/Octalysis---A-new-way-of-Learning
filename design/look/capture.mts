/**
 * Capture the look sheet: every colour set at 1440 and 380, with the three
 * faces' load checked on each. WEB-REMAKE.md section 8, session 1 (h). The
 * face specimens and the frame comparison the instructor chose from on
 * 30 Sep 2026 are kept as captures (captures/faces-*.png, frames-*.png).
 *
 *   node --experimental-strip-types design/look/capture.mts
 *
 * Serves the repo root over http on a free port, because Chromium refuses a
 * font loaded from file://, and a specimen captured without its faces is a
 * picture of the fallback. Every capture also records whether each face the
 * sheet names actually loaded (document.fonts.check), in captures/fonts.json.
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AddressInfo } from "node:net";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const OUT = join(HERE, "captures");

// @playwright/test from the repo's own node_modules, by file URL, so this
// script needs no install of its own and runs the same browser the specs do.
const pw = await import(
  pathToFileURL(join(ROOT, "node_modules", "@playwright", "test", "index.mjs")).href
);
const { chromium } = pw as typeof import("@playwright/test");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const port = (server.address() as AddressInfo).port;
const base = `http://127.0.0.1:${port}/design/look/index.html`;

const HUD = ["bare-metal", "blueprint", "phosphor"];
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"];
const WIDTHS = [1440, 380];
// The seeded accent of the demo student 232129006, so the sheet shows a real
// student's hue rather than the default.
const HUE = 14;

interface Shot {
  readonly name: string;
  readonly query: string;
}

const shots: Shot[] = [];
{
  for (const t of HUD) shots.push({ name: `hud-${t}`, query: `realm=star&theme=${t}&hue=${HUE}` });
  for (const b of BIOMES) shots.push({ name: `biome-${b}`, query: `realm=biome&biome=${b}&hue=${HUE}` });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const fonts: Record<string, Record<string, boolean>> = {};
const failed: string[] = [];
try {
  for (const shot of shots) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on("response", (r) => {
        if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(`${base}?${shot.query}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      fonts[`${shot.name}-${width}`] = await page.evaluate(() => {
        const out: Record<string, boolean> = {};
        for (const f of ["Oxanium", "Inter", "JetBrains Mono"]) {
          out[f] = [...document.fonts].some((ff) => ff.family.replace(/"/g, "") === f && ff.status === "loaded");
        }
        return out;
      });
      for (const [f, ok] of Object.entries(fonts[`${shot.name}-${width}`]!)) if (!ok) failed.push(`${shot.name}-${width}: ${f} did not load`);
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scrollW > width) failed.push(`${shot.name}-${width}: horizontal scroll ${scrollW}px`);
      const file = join(OUT, `${shot.name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`ok ${shot.name}-${width}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
await writeFile(join(OUT, "fonts.json"), JSON.stringify(fonts, null, 2));
if (failed.length) {
  console.log("PROBLEMS:\n" + failed.join("\n"));
  process.exitCode = 1;
}

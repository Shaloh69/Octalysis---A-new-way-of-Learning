import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ResolvedItem } from "../../services/api/src/engine/resolve.ts";
import { clippedElements, contrastFailures, horizontalOverflow, offTokenStyles, outOfPanel, unreachableByKeyboard } from "./_gate.ts";
import { forcePlanetBiome } from "./_realm-fixture.ts";
import { journeyUrl, realMoonPaper, servePaper, signIn } from "./_stage-check-fixture.ts";

/**
 * Bus Contention: moon 03.9's Bus wiring (WEB-REVAMP 3.6, approved 30 Sep
 * 2026), beside the moon's journey, the one Phaser encounter of act 1.
 * Contract: `design/templates/web/encounter-bus/SPEC.md`.
 *
 * Figure 3.16 on a bench: wire the modules onto the three groups of lines,
 * let them ask for the bus, and one transmits while the rest wait. Phaser
 * draws it from its own lazy chunk; every control is a DOM button; when the
 * canvas cannot run the same bus is drawn in the DOM.
 *
 * Captures: `OCTA_CAPTURE=1` writes `current*.png` into the template folder.
 */

const MOON = "03.9";
const STAGE = "03";
const ENC = "[data-encounter]";
const SPRITES = ".sprite-bar, .sprite-button";
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;
const SCENE_CHUNK = /\/assets\/bus-scene-[\w-]+\.js$/;
const DIR = "design/templates/web/encounter-bus";

let items: ResolvedItem[];
test.beforeAll(async ({ request }) => {
  items = await realMoonPaper(request, MOON);
});

interface Opened {
  api: string[];
  chunks: string[];
}

async function open(page: Page, opts: { moon?: string; canvas?: "block" } = {}): Promise<Opened> {
  const moon = opts.moon ?? MOON;
  const api: string[] = [];
  const chunks: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) api.push(`${r.method()} ${r.url()}`);
    if (r.url().includes("/assets/")) chunks.push(r.url());
  });
  if (opts.canvas === "block") await page.route(SCENE_CHUNK, (r) => r.abort());
  await signIn(page);
  await servePaper(page, moon === MOON ? items : await realMoonPaper(page.request, moon), { journey: moon });
  await page.goto(journeyUrl(moon));
  await expect(page.locator("main").getByText(/Question \d+ of \d+/).first()).toBeVisible({ timeout: 15_000 });
  if (moon === MOON) {
    await page.locator("[data-bus-contention]").waitFor({ timeout: 15_000 });
    await expect(page.locator("[data-bus-contention]")).not.toHaveAttribute("data-canvas", "loading", { timeout: 15_000 });
  }
  return { api, chunks };
}

const readout = (page: Page, k: string) => page.locator(`[data-readout="${k}"]`);
const btn = (page: Page, name: string | RegExp) => page.locator(ENC).getByRole("button", { name });

async function wireAll(page: Page): Promise<void> {
  await btn(page, "Wire every module").click();
}
async function everyoneAsks(page: Page): Promise<void> {
  await btn(page, "Everyone asks at once").click();
}
async function stepOnce(page: Page): Promise<void> {
  await btn(page, "Step one bus cycle").click();
}

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: unwired, contended, and garbled", async ({ page }) => {
    await open(page);
    expect(await clippedElements(page, ENC), "unwired").toEqual([]);
    await wireAll(page);
    await everyoneAsks(page);
    await stepOnce(page);
    expect(await clippedElements(page, ENC), "contended").toEqual([]);
    expect(await outOfPanel(page, `${ENC} .bench-panel`), "contended, inside the panels").toEqual([]);
    await page.locator(ENC).getByRole("checkbox", { name: /arbitration/ }).uncheck();
    await stepOnce(page);
    expect(await clippedElements(page, ENC), "garbled").toEqual([]);
  });

  test("2. no horizontal page scroll, canvas included", async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await wireAll(page);
    await everyoneAsks(page);
    await stepOnce(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3. every control is reachable by keyboard, and the WHOLE encounter runs from it", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, ENC)).toEqual([]);
    // Wire the processor, the memory and one I/O module tap by tap, with the keyboard.
    for (const m of ["Processor", "Memory", "I/O module 1"]) {
      for (const g of ["data lines", "address lines", "control lines"]) {
        const b = page.locator(ENC).getByRole("button", { name: `Wire: ${m} to the ${g}` });
        await b.focus();
        await page.keyboard.press("Space");
        await expect(page.locator(ENC).getByRole("button", { name: `Wired: ${m} to the ${g}` })).toHaveAttribute("aria-pressed", "true");
      }
    }
    await btn(page, "Processor: request the bus").focus();
    await page.keyboard.press("Enter");
    await btn(page, "I/O module 1: request the bus").focus();
    await page.keyboard.press("Enter");
    await btn(page, "Step one bus cycle").focus();
    await page.keyboard.press("Enter");
    await expect(readout(page, "control")).toContainText("Bus grant");
    await expect(readout(page, "waiting")).toContainText("I/O module 1");
    // The width, by arrow keys on its radios; the grant, by Space.
    await page.locator(ENC).getByRole("radio", { name: "32 lines" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(ENC).getByRole("radio", { name: "64 lines" })).toBeChecked();
    await page.locator(ENC).getByRole("checkbox", { name: /arbitration/ }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator(ENC).getByRole("checkbox", { name: /arbitration/ })).not.toBeChecked();
  });

  test("4. AA contrast, computed, in all seven biomes", async ({ browser }, info) => {
    test.setTimeout(240_000);
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, STAGE, biome);
      await open(p);
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} unwired`).toEqual([]);
      await wireAll(p);
      await everyoneAsks(p);
      await stepOnce(p);
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} contended`).toEqual([]);
      await ctx.close();
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await open(page);
    await wireAll(page);
    await everyoneAsks(page);
    await stepOnce(page);
    expect(await offTokenStyles(page, ENC)).toEqual([]);
  });

  test.describe("6. motion", () => {
    const cssMotion = (page: Page) =>
      page.addInitScript(() => {
        const w = window as unknown as { __busMotion: string[] };
        w.__busMotion = [];
        // Only motion a person could see, as the gate's own recorder counts it (over 1ms).
        const ms = (v: string) => Math.max(0, ...v.split(",").map((s) => (s.trim().endsWith("ms") ? parseFloat(s) : parseFloat(s) * 1000)));
        const rec = (e: Event) => {
          if (!(e.target instanceof Element) || !e.target.closest("[data-bus-contention]")) return;
          const cs = getComputedStyle(e.target);
          const dur = ms(e.type === "animationstart" ? cs.animationDuration : cs.transitionDuration);
          if (dur > 1) w.__busMotion.push(`${e.type} ${dur}ms on ${e.target.tagName.toLowerCase()}.${e.target.className}`);
        };
        document.addEventListener("animationstart", rec, true);
        document.addEventListener("transitionrun", rec, true);
      });
    const moved = (page: Page) => page.evaluate(() => (window as unknown as { __busMotion: string[] }).__busMotion);

    test("reduced motion: the canvas holds still and no CSS moves", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await cssMotion(page);
      await open(page);
      await expect(page.locator(".bus-stage")).toHaveAttribute("data-motion", "still");
      await wireAll(page);
      await everyoneAsks(page);
      await stepOnce(page);
      await stepOnce(page);
      await expect(page.locator(".bus-stage")).not.toHaveAttribute("data-tweens");
      expect(await moved(page)).toEqual([]);
    });

    test("the positive control: without it, each cycle's packet does move", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await cssMotion(page);
      await open(page);
      await expect(page.locator(".bus-stage")).toHaveAttribute("data-motion", "packet");
      await wireAll(page);
      await everyoneAsks(page);
      await stepOnce(page);
      await expect(page.locator(".bus-stage")).toHaveAttribute("data-tweens", "1");
      expect(await moved(page), "the packet is the canvas's; the DOM never animates").toEqual([]);
    });
  });
});

/* ======================================================= what it owes */

test.describe("Phaser: lazy, on this moon only", () => {
  test("dist/index.html carries no Phaser, no scene and no encounter", () => {
    const html = readFileSync("apps/web/dist/index.html", "utf8");
    expect(html).not.toMatch(/phaser|bus-scene|BusContention/i);
    expect(html).not.toMatch(/modulepreload[^>]*bus-scene/);
  });

  test("moon 03.9 fetches the scene chunk, and the canvas draws", async ({ page }) => {
    const { chunks } = await open(page);
    expect(chunks.some((u) => SCENE_CHUNK.test(u)), chunks.join("\n")).toBe(true);
    await expect(page.locator("[data-bus-contention]")).toHaveAttribute("data-canvas", "ready");
    const inked = await page.locator(".bus-stage canvas").evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
      return n;
    });
    expect(inked, "the canvas is blank").toBeGreaterThan(1000);
  });

  test("another moon of the same planet fetches neither the scene nor the encounter", async ({ page }) => {
    const { chunks } = await open(page, { moon: "03.10" });
    expect(chunks.filter((u) => /bus-scene|BusContention/.test(u))).toEqual([]);
    await expect(page.locator("[data-bus-contention]")).toHaveCount(0);
  });

  test("a click on the canvas is only a shortcut to a button's own handler", async ({ page }) => {
    await open(page);
    await wireAll(page);
    // Clear of the fixed planet bar: a click lands where the student would see it.
    await page.locator(".bus-stage").evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = (await page.locator(".bus-stage canvas").boundingBox())!;
    // The processor is the first of four modules, centred on the canvas (bus-scene's columns()).
    const W = box.width;
    const gap = Math.max(8, Math.min(28, W * 0.03));
    const w = Math.min(132, (W - 24 - gap * 3) / 4);
    const left = (W - (w * 4 + gap * 3)) / 2;
    await page.mouse.click(box.x + left + w / 2, box.y + 46 + 23);
    await expect(readout(page, "waiting")).toHaveText("Processor (1)");
  });
});

test.describe("when the canvas cannot run", () => {
  test("the same bus is drawn in the DOM, said so, and the whole encounter still works", async ({ page }) => {
    await open(page, { canvas: "block" });
    await expect(page.locator("[data-bus-contention]")).toHaveAttribute("data-canvas", "fallback");
    await expect(page.locator("[data-bus-notice]")).toBeVisible();
    await expect(page.locator("[data-bus-fallback]")).toBeVisible();
    await expect(page.locator(".bus-stage")).toBeHidden();
    await wireAll(page);
    await everyoneAsks(page);
    await stepOnce(page);
    await expect(page.locator('.bus-module[data-module="cpu"]')).toHaveAttribute("data-active", "yes");
    await expect(page.locator('.bus-module[data-module="io1"] .bus-rider')).toHaveCount(1);
    await expect(readout(page, "waiting")).toContainText("I/O module 1");
    expect(await clippedElements(page, ENC)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.locator("main").getByText(/Question \d+ of \d+/).first()).toBeVisible();
  });
});

test.describe("the book's bus, on a bench", () => {
  test("one transmits and the rest wait, in the order they asked", async ({ page }) => {
    await open(page);
    await expect(btn(page, "Processor: request the bus")).toBeDisabled();
    await expect(page.locator(ENC)).toContainText("Tap Processor onto the control lines first");
    await wireAll(page);
    await everyoneAsks(page);
    await stepOnce(page);
    await expect(readout(page, "control")).toHaveText("Bus request · Bus grant · Memory read · Transfer ACK");
    await expect(readout(page, "data")).toHaveText("an instruction, bits 0–31 of 64");
    await expect(readout(page, "waiting")).toHaveText("Processor (1), I/O module 1 (1), I/O module 2 (1)");
    await stepOnce(page);
    await expect(readout(page, "data")).toHaveText("an instruction, bits 32–63 of 64");
    await stepOnce(page);
    await expect(readout(page, "control")).toContainText("Memory write");
    await expect(readout(page, "data")).toHaveText("a unit of data, from I/O module 1");
    await expect(page.locator("[data-book-says]")).toContainText("only one device at a time can successfully transmit");
  });

  test("a narrow bus holds the processor longer; the book's own width example is quoted at 32", async ({ page }) => {
    await open(page);
    await expect(readout(page, "accesses")).toContainText("takes 2 accesses");
    await expect(readout(page, "accesses")).toContainText("the processor must access the memory module twice");
    await page.locator(ENC).getByRole("radio", { name: "16 lines" }).check();
    await expect(readout(page, "accesses")).toContainText("takes 4 accesses");
    await wireAll(page);
    await btn(page, "Processor: request the bus").click();
    await btn(page, "I/O module 2: request the bus").click();
    for (let i = 0; i < 4; i++) await stepOnce(page);
    await expect(readout(page, "data")).toHaveText("an instruction, bits 48–63 of 64");
    await stepOnce(page);
    await expect(readout(page, "data")).toHaveText("a unit of data, from I/O module 2");
  });

  test("without the grant, two at once garble, and nothing arrives", async ({ page }) => {
    await open(page);
    await wireAll(page);
    await page.locator(ENC).getByRole("checkbox", { name: /arbitration/ }).uncheck();
    await btn(page, "Processor: request the bus").click();
    await btn(page, "I/O module 1: request the bus").click();
    await stepOnce(page);
    await expect(readout(page, "data")).toHaveText("garbled: the signals overlap");
    await expect(readout(page, "control")).not.toContainText("Transfer ACK");
    await expect(readout(page, "waiting")).toHaveText("Processor (1), I/O module 1 (1)");
    await expect(page.locator(ENC)).toContainText("their signals will overlap and become garbled");
  });

  test("every quotation on the bench is in the book's chapter 3", async ({ page }) => {
    await open(page);
    await wireAll(page);
    await everyoneAsks(page);
    await stepOnce(page);
    const fold = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const book = fold(readFileSync("docs/source/book/ch-03.md", "utf8"));
    const quotes = await page.locator(`${ENC} q`).allTextContents();
    expect(quotes.length).toBeGreaterThan(8);
    for (const q of quotes) expect(book, q).toContain(fold(q));
  });

  test("it grades nothing and sends nothing", async ({ page }) => {
    const { api } = await open(page);
    const before = api.length;
    await wireAll(page);
    await everyoneAsks(page);
    await stepOnce(page);
    await page.locator(ENC).getByRole("checkbox", { name: /arbitration/ }).uncheck();
    await btn(page, "Clear the traffic").click();
    expect(api.slice(before), "the bench talked to the server").toEqual([]);
    const text = (await page.locator(ENC).innerText()).toLowerCase();
    expect(text).not.toMatch(/\bcorrect\b|\bwrong\b|\bscore\b|\bpoints\b/);
  });

  test("it NEVER wraps the paper; it wears stage 03's theme; the map names it", async ({ page }) => {
    await open(page);
    await expect(page.locator(`${ENC} [data-runner], ${ENC} [data-paper]`)).toHaveCount(0);
    await expect(page.locator(`[data-runner] ${ENC}, [data-paper] ${ENC}`)).toHaveCount(0);
    await expect(page.locator(ENC)).toHaveAttribute("data-encounter", "circuit");
    await page.goto("/app?stage=03&moon=03.9");
    await page.locator(".starmap-body h2").waitFor();
    await expect(page.locator("[data-moon-game]")).toContainText("Bus Contention, a bus wiring beside its questions");
  });
});

/* ======================================================= captures (opt-in) */

test.describe("captures", () => {
  test.skip(!process.env.OCTA_CAPTURE, "set OCTA_CAPTURE=1 to write current*.png");
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("unwired, contended, garbled, fallback and the page", async ({ browser }, info) => {
    test.setTimeout(120_000);
    const suffix = info.project.name.includes("380") ? "-380" : "";
    const shot = async (biome: string, name: string, act: (p: Page) => Promise<void>, canvas?: "block") => {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL, reducedMotion: "reduce" });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, STAGE, biome);
      await open(p, { canvas });
      await act(p);
      if (name !== "page") await p.addStyleTag({ content: ".biome-top, .biome-bottom { visibility: hidden !important; }" });
      const target = name === "page" ? p : p.locator(ENC);
      await target.screenshot({ path: `${DIR}/current${name === "unwired" ? "" : `-${name}`}${suffix}.png`, ...(name === "page" ? { fullPage: true } : {}) });
      await ctx.close();
    };
    await shot("jungle", "unwired", async () => {});
    await shot("city", "contended", async (p) => {
      await wireAll(p);
      await everyoneAsks(p);
      await everyoneAsks(p);
      await stepOnce(p);
    });
    await shot("desert", "garbled", async (p) => {
      await wireAll(p);
      await p.locator(ENC).getByRole("checkbox", { name: /arbitration/ }).uncheck();
      await everyoneAsks(p);
      await stepOnce(p);
    });
    await shot(
      "arctic",
      "fallback",
      async (p) => {
        await wireAll(p);
        await everyoneAsks(p);
        await stepOnce(p);
      },
      "block",
    );
    await shot("ocean", "page", async (p) => {
      await wireAll(p);
      await everyoneAsks(p);
      await stepOnce(p);
    });
  });
});

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  recordedMotion,
  recordMotion,
  unreachableByKeyboard,
} from "./_gate";
import { openStage, realStage } from "./_stage-fixture.ts";

/**
 * Listen: the audiobook on the stage reader (instructor rulings, 6 Oct 2026;
 * docs/FIGURES-AND-AUDIO.md; design/templates/web/stage/SPEC.md "Listen").
 *
 * The browser's own voice cannot be heard by a test, so `speechSynthesis` is
 * replaced by a recorder that "finishes" each utterance after a short delay.
 * What it was asked to say, at what speed, and what the page marked while it
 * spoke are the assertions. Stage 06 (student 232129006) has prose, quotes,
 * callouts, a figure and two code listings.
 */

const ROUTE = "[data-reader]";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

async function fakeVoice(page: Page, ms = 300): Promise<void> {
  await page.addInitScript((delay) => {
    const w = window as unknown as {
      __spoken: Array<{ text: string; rate: number; voice: string | null }>;
      speechSynthesis: unknown;
      SpeechSynthesisUtterance: unknown;
    };
    w.__spoken = [];
    // The device's voices: an old robotic one, a natural one, another language.
    const voices = [
      { name: "Microsoft David - English (United States)", lang: "en-US", localService: true, default: true, voiceURI: "david" },
      { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US", localService: false, default: false, voiceURI: "aria" },
      { name: "Google UK English Female", lang: "en-GB", localService: false, default: false, voiceURI: "gb" },
      { name: "Google français", lang: "fr-FR", localService: false, default: false, voiceURI: "fr" },
    ];
    // Chrome refuses a plain object as an utterance's voice: record with a plain class instead.
    class Utterance {
      text: string;
      rate = 1;
      lang = "";
      voice: { name: string } | null = null;
      onend: ((e: Event) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
    let timer: number | undefined;
    let current: SpeechSynthesisUtterance | null = null;
    const synth = {
      paused: false,
      speaking: false,
      pending: false,
      speak(u: SpeechSynthesisUtterance) {
        w.__spoken.push({ text: u.text, rate: u.rate, voice: u.voice?.name ?? null });
        current = u;
        timer = window.setTimeout(() => {
          if (current === u) u.onend?.(new Event("end") as SpeechSynthesisEvent);
        }, delay as number);
      },
      cancel() {
        window.clearTimeout(timer);
        current = null;
      },
      pause() {
        window.clearTimeout(timer);
        synth.paused = true;
      },
      resume() {
        synth.paused = false;
      },
      getVoices: () => voices,
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, get: () => synth });
  }, ms);
}
const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: Array<{ text: string; rate: number; voice: string | null }> }).__spoken);

async function reader(page: Page, ms?: number): Promise<void> {
  await fakeVoice(page, ms);
  await openStage(page, "06");
  await page.locator("[data-reading]").waitFor({ timeout: 15_000 });
}

test.describe("Listen — the gate on the reader with the bar playing", () => {
  test("1-3, 5 · nothing clipped, no sideways scroll, keyboard reachable, tokens rendered", async ({ page }) => {
    await reader(page, 60_000);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await expect(page.locator("[data-listen=playing]")).toBeVisible();
    expect(await clippedElements(page, ROUTE)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });

  test("4 · AA computed with the bar playing and a block marked", async ({ page }) => {
    await reader(page, 60_000);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await expect(page.locator("[data-speaking]")).toHaveCount(1);
    expect(await contrastFailures(page, ROUTE)).toEqual([]);
  });

  test("6 · reduced motion: following the voice jumps, it does not glide", async ({ browser }, info) => {
    test.skip(!wide(info), "one width");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const page = await ctx.newPage();
    await recordMotion(page);
    await reader(page, 80);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(4);
    const long = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).not.toBe("smooth");
    await ctx.close();
  });
});

test.describe("Listen — what it owes", () => {
  test("reads the lesson in order, and never a code listing", async ({ page, request }) => {
    const stage = await realStage(request, "06");
    await reader(page, 5);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await expect(page.locator("[data-listen=idle]")).toBeVisible({ timeout: 20_000 });
    const said = (await spoken(page)).map((s) => s.text).join(" ");
    expect(said.length).toBeGreaterThan(500);
    // The first thing said is the start of the brief.
    const brief = stage.blocks.find((b) => b.kind === "brief")!.body.replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 30);
    expect(said.startsWith(brief), `${said.slice(0, 60)} vs ${brief}`).toBe(true);
    for (const code of stage.blocks.filter((b) => b.kind === "code")) {
      const line = code.body.split("\n").find((l) => l.trim().length > 8)!.trim();
      expect(said, `a code line was read: ${line}`).not.toContain(line);
    }
  });

  test("marks the block being read, and the mark follows the voice", async ({ page }) => {
    await reader(page, 400);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    const first = page.locator("[data-speaking]");
    await expect(first).toHaveCount(1);
    const at0 = await first.getAttribute("data-block");
    await expect.poll(async () => page.locator("[data-speaking]").getAttribute("data-block"), { timeout: 15_000 }).not.toBe(at0);
    await expect(page.locator("[data-speaking]")).toHaveCount(1);
  });

  test("Pause, Resume and Stop do what they say; Stop clears the mark", async ({ page }) => {
    await reader(page, 60_000);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.locator("[data-listen=paused]")).toContainText(/Paused at part/);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.locator("[data-listen=playing]")).toBeVisible();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.locator("[data-listen=idle]")).toBeVisible();
    await expect(page.locator("[data-speaking]")).toHaveCount(0);
  });

  test("a speed applies from the sentence being read, and is shown pressed", async ({ page }) => {
    await reader(page, 60_000);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await page.getByRole("button", { name: "Speed 1.5 times" }).click();
    await expect(page.getByRole("button", { name: "Speed 1.5 times" })).toHaveAttribute("aria-pressed", "true");
    const all = await spoken(page);
    expect(all.at(-1)!.rate).toBe(1.5);
    expect(all.at(-1)!.text).toBe(all[0]!.text);
  });

  test("the most natural voice is chosen by default, and a paragraph is spoken whole (6 Oct 2026)", async ({ page }) => {
    await reader(page, 60_000);
    const select = page.getByLabel("Voice");
    await expect(select).toHaveValue("Microsoft Aria Online (Natural) - English (United States)");
    // English voices only, best first.
    await expect(select.locator("option")).toHaveText([
      "Microsoft Aria Online (Natural) - English (United States)",
      "Google UK English Female",
      "Microsoft David - English (United States)",
    ]);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    const first = (await spoken(page))[0]!;
    expect(first.voice).toBe("Microsoft Aria Online (Natural) - English (United States)");
    // The brief's first paragraph, not just its first sentence.
    expect((first.text.match(/[.!?](\s|$)/g) ?? []).length).toBeGreaterThan(1);
  });

  test("choosing another voice takes over the paragraph being read, and is remembered", async ({ page }) => {
    await reader(page, 60_000);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await page.getByLabel("Voice").selectOption("Google UK English Female");
    await expect.poll(async () => (await spoken(page)).at(-1)!.voice).toBe("Google UK English Female");
    const all = await spoken(page);
    // The Google voice gets short pieces (it stops after ~15 s); it restarts the same paragraph.
    expect(all.at(-1)!.text.length).toBeLessThanOrEqual(200);
    expect(all[0]!.text.startsWith(all.at(-1)!.text.slice(0, 20))).toBe(true);
    await page.reload();
    await page.locator("[data-reading]").waitFor();
    await expect(page.getByLabel("Voice")).toHaveValue("Google UK English Female");
  });

  test("leaving the page stops the voice", async ({ page }) => {
    await reader(page, 60_000);
    await page.evaluate(() => {
      const s = window.speechSynthesis as unknown as { cancel: () => void };
      const orig = s.cancel.bind(s);
      (window as unknown as { __cancels: number }).__cancels = 0;
      s.cancel = () => {
        (window as unknown as { __cancels: number }).__cancels++;
        orig();
      };
    });
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    const before = await page.evaluate(() => (window as unknown as { __cancels: number }).__cancels);
    await page.getByRole("link", { name: "Back to the map" }).first().click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __cancels: number }).__cancels)).toBeGreaterThan(before);
  });

  test("no speech synthesis: no control, and one line says so", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "speechSynthesis", { configurable: true, get: () => undefined });
      delete (window as unknown as Record<string, unknown>).speechSynthesis;
    });
    await openStage(page, "06");
    await page.locator("[data-reading]").waitFor({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Listen", exact: true })).toHaveCount(0);
    await expect(page.locator("[data-listen=unsupported]")).toHaveText("This browser cannot read the lesson aloud.");
  });

  test("capture: idle, and playing with a block marked, then opened", async ({ page }, info) => {
    await reader(page, 60_000);
    const s = wide(info) ? "" : "-380";
    await page.locator(".rd-head").screenshot({ path: `design/templates/web/stage/current-listen-idle${s}.png` });
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await expect(page.locator("[data-speaking]")).toHaveCount(1);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `design/templates/web/stage/current-listen-playing${s}.png` });
  });
});

import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  recordMotion,
  recordedMotion,
  setTheme,
  THEMES,
  unreachableByKeyboard,
} from "./_gate.ts";
import { openMap, realMap } from "./_map-fixture.ts";

/**
 * `/app/map`: the flat map, the third student route through the gate
 * (`WEB-REVAMP.md` §6). `design/templates/web/map/SPEC.md` is what this holds
 * the page to: the six gate assertions at 1440 and 380, then what the plan owes
 * (PAGE-SPECS §/app/map: 19 nodes, 18 edges, real buttons in curriculum order,
 * bookmarkable) and what the instructor decided on 29 Sep 2026 (the planet
 * panel lands here; the resume card; one flat presentation for both routes;
 * the edges always drawn).
 *
 * Every state here is the REAL API's, as the seeded student `232129006`
 * (`_map-fixture.ts`); patches stand in only for a failed or slow read and an
 * approved summary, which the seed does not hold.
 */

const wide = (t: TestInfo) => t.project.name === "desktop-1440";

/*
 * The route's own surfaces. The shell's nav is INSIDE `<main>` (App.tsx) and
 * its translucent background is the shell's to fix (NEXT-SESSION §0p.2), so
 * the surface checks read the map; keyboard reachability walks all of main.
 */
const ROUTE = "[data-flatmap], [data-toaster]";

const stages = (page: Page) => page.locator("[data-flatmap] button.node-hit");
const stage = (page: Page, id: string) => page.locator(`[data-flatmap] button.node-hit[data-stage="${id}"]`);
const panel = (page: Page) => page.locator("[data-panel]");
const enter = (page: Page) => panel(page).getByRole("button", { name: /^Enter journey/ });
const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

async function select(page: Page, id: string): Promise<void> {
  await stage(page, id).click();
  await expect(panel(page)).toHaveAttribute("data-panel", "stage");
  await expect(panel(page).locator("h2")).toBeFocused();
}

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: the map, and a locked stage's panel", async ({ page }) => {
    await openMap(page);
    expect(await clippedElements(page, ROUTE), "the map").toEqual([]);
    await select(page, "03"); // locked, and the most objectives: 11
    expect(await clippedElements(page, ROUTE), "stage 03's panel").toEqual([]);
  });

  test("2. no horizontal page scroll, with and without the panel", async ({ page }) => {
    await openMap(page);
    expect(await horizontalOverflow(page), "the map").toBeLessThanOrEqual(0);
    await select(page, "06");
    expect(await horizontalOverflow(page), "the panel").toBeLessThanOrEqual(0);
  });

  test("3. every control is reachable by keyboard, the panel's included", async ({ page }) => {
    await openMap(page, { path: "/app/map?stage=01" });
    await expect(panel(page)).toHaveAttribute("data-panel", "stage");
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });

  test("4. AA contrast, computed, on all three themes: map, open panel, locked panel", async ({ page }) => {
    await openMap(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, ROUTE), `map ${theme}`).toEqual([]);
    }
    await select(page, "06");
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, ROUTE), `06 ${theme}`).toEqual([]);
    }
    await select(page, "01");
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, ROUTE), `locked 01 ${theme}`).toEqual([]);
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await openMap(page);
    expect(await offTokenStyles(page, ROUTE), "the map").toEqual([]);
    await select(page, "01");
    expect(await offTokenStyles(page, ROUTE), "a locked panel").toEqual([]);
  });

  test("6. prefers-reduced-motion: no arrival, no panel easing, and entering cuts", async ({ page }) => {
    // Positive control first: without the media feature, the map arrives and the panel eases in.
    await recordMotion(page);
    await openMap(page);
    await select(page, "06");
    await page
      .waitForFunction(() => ((window as unknown as { __motion?: Array<{ name: string }> }).__motion ?? [])
        .some((m) => m.name === "fm-panel-enter"), undefined, { timeout: 3000 })
      .catch(() => undefined);
    const seen = (await recordedMotion(page)).filter((m) => m.on.startsWith("main") && m.ms >= 100).map((m) => m.name);
    expect(seen, "no arrival recorded without reduced motion; the control proves nothing").toContain("fm-enter");
    expect(seen, "no panel entrance recorded without reduced motion").toContain("fm-panel-enter");

    const calm = await page.context().newPage();
    await calm.emulateMedia({ reducedMotion: "reduce" });
    await recordMotion(calm);
    await openMap(calm);
    await select(calm, "06");
    await calm.waitForTimeout(300);
    const long = (await recordedMotion(calm)).filter((m) => m.on.startsWith("main") && m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    // Entering is a cut: the stage's URL at once, no warp first.
    await enter(calm).click();
    await expect(calm).toHaveURL(/\/app\/stage\/06$/, { timeout: 1000 });
    expect(await calm.locator(".is-warping").count()).toBe(0);
  });
});

/* ======================================================== what the plan owes */

test.describe("every stage is a real button (the accessibility contract)", () => {
  test("19 buttons in curriculum order, each named with its state, a lock with the API's reason", async ({ page, request }) => {
    const api = await realMap(request);
    await openMap(page);
    const order = [...api.nodes].sort((a, b) => a.ordinal - b.ordinal);
    await expect(stages(page)).toHaveCount(order.length);
    expect(await stages(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-stage")))).toEqual(order.map((n) => n.id));

    const word = { locked: "Locked", available: "Not started", in_progress: "In progress", mastered: "Mastered" } as const;
    for (const n of order) {
      const name = norm(await stage(page, n.id).textContent());
      expect(name.startsWith(`Stage ${n.id} ${n.title} ${word[n.state]}`), `${n.id}: "${name}"`).toBe(true);
      if (n.state === "locked") expect(name, `${n.id} carries its reason`).toContain(norm(n.lockReason!.message));
      if (n.state === "in_progress") expect(name).toContain(`${Math.round(n.mastery * 100)}%`);
      // A locked stage is still operable: selecting it is how a student learns why.
      await expect(stage(page, n.id)).toBeEnabled();
    }
  });

  test("Tab walks the stages in curriculum order", async ({ page, request }) => {
    const api = await realMap(request);
    await openMap(page);
    const order = [...api.nodes].sort((a, b) => a.ordinal - b.ordinal).map((n) => n.id);
    await stage(page, order[0]!).focus();
    const walked = [order[0]];
    for (let i = 1; i < order.length; i++) {
      await page.keyboard.press("Tab");
      walked.push(await page.evaluate(() => document.activeElement?.getAttribute("data-stage") ?? null));
    }
    expect(walked).toEqual(order);
  });

  test("a skip link moves past the 19 stages", async ({ page }) => {
    await openMap(page);
    const skip = page.getByRole("link", { name: "Skip the stage list", exact: true });
    await skip.focus();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-key]")).toBeFocused();
  });

  test("the 18 edges are the API's, drawn; into a locked stage they are dashed", async ({ page, request }) => {
    const api = await realMap(request);
    await openMap(page);
    const edges = page.locator("[data-flatmap] line.galaxy-edge");
    await expect(edges).toHaveCount(api.edges.length);
    expect(api.edges.length).toBe(18);
    const drawn = await edges.evaluateAll((els) =>
      els.map((e) => ({ from: e.getAttribute("data-from"), to: e.getAttribute("data-to"), locked: e.classList.contains("galaxy-edge-locked") })),
    );
    const state = new Map(api.nodes.map((n) => [n.id, n.state]));
    expect(drawn.map(({ from, to }) => `${from}>${to}`).sort()).toEqual(api.edges.map((e) => `${e.from}>${e.to}`).sort());
    for (const d of drawn) expect(d.locked, `${d.from}>${d.to}`).toBe(state.get(d.to!) === "locked");
    // The subtitle's claim is now true, and says so in plain words.
    await expect(page.locator("[data-flatmap] .fm-sub")).toContainText("Each line joins a stage to the one it needs first");
  });

  test("the key names every mark in words", async ({ page }) => {
    await openMap(page);
    const key = page.locator("[data-key]");
    for (const w of ["Locked", "Not started", "In progress", "Mastered", "Your next stage", "Needs the stage before it"]) {
      await expect(key.getByText(w, { exact: true })).toBeVisible();
    }
  });
});

test.describe("the layout: on the planets when there is room, a list when there is not", () => {
  test("1440: every button sits on its planet, and no two targets are closer than 24px", async ({ page }, info) => {
    test.skip(!wide(info), "the 1440 form");
    await openMap(page);
    const m = await page.evaluate(() => {
      const out: Array<{ id: string; dx: number; dy: number; x: number; y: number; w: number }> = [];
      for (const b of document.querySelectorAll<HTMLElement>("[data-flatmap] button.node-hit")) {
        const id = b.dataset.stage!;
        const dot = b.querySelector(".fm-dot")!.getBoundingClientRect();
        const planet = document.querySelector(`[data-flatmap] .galaxy-node[data-stage="${id}"] .galaxy-planet`)!.getBoundingClientRect();
        const cx = dot.x + dot.width / 2, cy = dot.y + dot.height / 2;
        out.push({ id, dx: cx - (planet.x + planet.width / 2), dy: cy - (planet.y + planet.height / 2), x: cx, y: cy, w: b.getBoundingClientRect().width });
      }
      return out;
    });
    for (const b of m) {
      expect(Math.hypot(b.dx, b.dy), `${b.id} is off its planet`).toBeLessThan(2);
      expect(b.w, `${b.id} is a real target`).toBeGreaterThanOrEqual(24);
    }
    let min = Infinity;
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) min = Math.min(min, Math.hypot(m[i]!.x - m[j]!.x, m[i]!.y - m[j]!.y));
    expect(min, "WCAG 2.5.8: targets 24px apart").toBeGreaterThanOrEqual(24);
    // On the picture the title and state are for assistive technology only:
    // their box is the 1px clipped one (measured on the box that clips, not the
    // text inside it, whose own width is its words).
    expect((await stage(page, "06").locator(".fm-node-text").boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  });

  test("380: the same buttons are rows of at least 44px under a still picture, words visible", async ({ page }, info) => {
    test.skip(wide(info), "the 380 form");
    await openMap(page);
    await expect(page.locator("[data-flatmap] .galaxy-svg")).toBeVisible();
    const rows = await stages(page).evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      const t = e.querySelector(".fm-node-title")!.getBoundingClientRect();
      return { h: r.height, w: r.width, title: t.width };
    }));
    for (const r of rows) {
      expect(r.h).toBeGreaterThanOrEqual(44);
      expect(r.title, "the title is visible").toBeGreaterThan(20);
    }
    // Rows, not discs on a 350px picture: each at least half the page wide.
    expect(Math.min(...rows.map((r) => r.w))).toBeGreaterThan(190);
  });
});

test.describe("the planet panel (WEB-REVAMP §3.1 via §3.9, instructor 29 Sep 2026)", () => {
  test("selecting a stage opens the panel in place: title, state, minutes and levels, objectives in words", async ({ page, request }) => {
    const api = await realMap(request);
    const n = api.nodes.find((x) => x.id === "06")!;
    await openMap(page);
    await expect(panel(page)).not.toHaveAttribute("data-panel", "stage");
    await select(page, "06");
    await expect(page).toHaveURL(/\/app\/map\?stage=06$/);
    const p = panel(page);
    await expect(p.locator("h2")).toHaveText(n.title);
    await expect(p.locator("[data-eyebrow]")).toHaveText("Stage 06");
    await expect(p.locator("[data-state]")).toHaveText(`In progress: your best check is ${Math.round(n.mastery * 100)}%`);
    await expect(p.locator("[data-meta]")).toContainText(`${n.estMinutes} minutes`);
    for (const l of n.levels) await expect(p.locator("[data-meta] .mono").filter({ hasText: new RegExp(`(^| )L${l}( |$)`) })).toHaveCount(1);
    await expect(p.getByRole("heading", { name: "What it covers", exact: true })).toBeVisible();
    const objs = await p.locator("[data-objectives] li").evaluateAll((els) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()));
    // Every objective, verbatim, in the syllabus's order (06.2 before 06.10).
    const natural = [...n.objectives].sort((a, b) => {
      const [x, y] = [a.id.split(".").map(Number), b.id.split(".").map(Number)];
      return x[0]! - y[0]! || x[1]! - y[1]!;
    });
    expect(objs).toEqual(natural.map((o) => `${o.id} ${o.description}`));
    expect(objs.at(-1), "06.10 is last, not second").toMatch(/^06\.10 /);
    await expect(stage(page, "06")).toHaveAttribute("aria-expanded", "true");
    await expect(enter(page)).toBeEnabled();
    // No moon mastery and no biome: neither has data yet, and nothing stands in.
    await expect(p).not.toContainText(/subtopics mastered/i);
    expect(await p.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
  });

  test("a locked stage: the API's reason verbatim beside a disabled Enter journey; Show Stage NN follows it", async ({ page, request }) => {
    const api = await realMap(request);
    const n = api.nodes.find((x) => x.id === "01")!;
    await openMap(page);
    await select(page, "01");
    const p = panel(page);
    await expect(p.locator("[data-state]")).toHaveText("Not open yet");
    const reason = p.locator("[data-reason]");
    expect(norm(await reason.textContent())).toBe(norm(n.lockReason!.message));
    await expect(enter(page)).toBeDisabled();
    const described = await enter(page).getAttribute("aria-describedby");
    expect(described, "the disabled button is described by the reason").toBe(await reason.getAttribute("id"));
    await expect(p.getByRole("heading", { name: "What it will cover", exact: true })).toBeVisible();
    await p.getByRole("button", { name: "Show Stage 00", exact: true }).click();
    await expect(page).toHaveURL(/\?stage=00$/);
    await expect(p.locator("h2")).toHaveText(api.nodes.find((x) => x.id === "00")!.title);
    await expect(p.locator("h2")).toBeFocused();
  });

  test("the summary shows only once approved (none is, today)", async ({ page }) => {
    await openMap(page);
    await select(page, "06");
    await expect(panel(page).locator("[data-summary]")).toHaveCount(0);
    const approved = "An approved summary, as the API would send it.";
    await openMap(page, { patch: (b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === "06" ? { ...n, summary: approved } : n)) }) });
    await select(page, "06");
    await expect(panel(page).locator("[data-summary]")).toHaveText(approved);
  });

  test("Escape closes the panel and focus returns to the stage", async ({ page }) => {
    await openMap(page);
    await select(page, "06");
    await page.keyboard.press("Escape");
    await expect(panel(page)).not.toHaveAttribute("data-panel", "stage");
    await expect(stage(page, "06")).toBeFocused();
    await expect(page).toHaveURL(/\/app\/map$/);
  });

  test("Close says what it closes, and returns focus", async ({ page }) => {
    await openMap(page);
    await select(page, "02");
    await panel(page).getByRole("button", { name: "Close Stage 02 details", exact: true }).click();
    await expect(panel(page)).not.toHaveAttribute("data-panel", "stage");
    await expect(stage(page, "02")).toBeFocused();
  });

  test("Back closes it too, and a selection is bookmarkable", async ({ page }) => {
    await openMap(page);
    await select(page, "05");
    await page.goBack();
    await expect(panel(page)).not.toHaveAttribute("data-panel", "stage");
    expect(new URL(page.url()).pathname, "nothing redirects").toBe("/app/map");
    await openMap(page, { path: "/app/map?stage=04" });
    await expect(panel(page)).toHaveAttribute("data-panel", "stage");
    await expect(panel(page).locator("[data-eyebrow]")).toHaveText("Stage 04");
  });

  test("Enter journey travels, and Back returns with the panel still open (§3.3)", async ({ page }, info) => {
    test.skip(!wide(info), "navigation, one width");
    await openMap(page);
    await select(page, "06");
    const warped = page.locator(".is-warping").waitFor({ state: "attached", timeout: 3000 }).then(() => true).catch(() => false);
    await enter(page).click();
    expect(await warped, "entering jumped instead of travelling").toBe(true);
    await expect(page).toHaveURL(/\/app\/stage\/06$/, { timeout: 5000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/map\?stage=06$/);
    await page.locator('[data-flatmap="ready"]').waitFor();
    await expect(panel(page)).toHaveAttribute("data-panel", "stage");
  });

  test("1440: the panel is a column that is always there; 380: a sheet only once chosen", async ({ page }, info) => {
    await openMap(page);
    if (wide(info)) {
      await expect(panel(page)).toBeVisible();
      await expect(panel(page)).toContainText("No stage selected");
      // In DOCUMENT coordinates: clicking 06 below the fold scrolls the page,
      // which moves every box on screen and none on the page.
      const where = () => page.locator("[data-flatmap] .galaxy-svg").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
      });
      const before = await where();
      await select(page, "06");
      const after = await where();
      expect(after, "selecting moved the map").toEqual(before);
    } else {
      await expect(panel(page)).toBeHidden();
      await select(page, "06");
      const box = (await panel(page).boundingBox())!;
      const vh = page.viewportSize()!.height;
      expect(Math.round(box.y + box.height), "a sheet at the foot of the screen").toBe(vh);
      // Nothing covers it: the sheet is over the shell's nav, not under it.
      const top = await panel(page).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 12);
        return !!hit && el.contains(hit);
      });
      expect(top).toBe(true);
    }
  });
});

test.describe("what to do next (instructor 29 Sep 2026: the server chooses, the device adds the spot)", () => {
  test("the card names the stage in progress, in the reader's words, and goes there", async ({ page }) => {
    await openMap(page);
    const card = page.locator("[data-card]");
    await expect(card.locator("[data-card-eyebrow]")).toHaveText("Pick up where you left off");
    await expect(card.locator("[data-card-stage]")).toHaveText("Stage 06 · External Memory");
    await expect(card).toContainText("In progress: your best check is 40%");
    await expect(card).not.toContainText("You were reading");
    await expect(card.getByRole("link", { name: "Go to Stage 06", exact: true })).toHaveAttribute("href", "/app/stage/06");
    // The accent marks this stage on the map: the student's own place.
    await expect(stage(page, "06")).toHaveAttribute("data-next", "true");
    await card.getByRole("button", { name: "Show on the map", exact: true }).click();
    await expect(panel(page)).toHaveAttribute("data-panel", "stage");
    await expect(panel(page).locator("h2")).toBeFocused();
  });

  test("with a reading position kept on this device, the card says where", async ({ page }) => {
    await openMap(page, { positions: { "06": { index: 3, label: "RAID: what to do when a disk dies" } } });
    await expect(page.locator("[data-card]")).toContainText("You were reading: RAID: what to do when a disk dies");
  });

  test("with storage refused, the card is whole and says nothing about a position", async ({ page }) => {
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (this: Storage, k: string) {
        if (k.startsWith("octa:reader:")) throw new Error("storage refused");
        return get.call(this, k);
      };
    });
    await openMap(page, { positions: { "06": { index: 3, label: "RAID" } } });
    await expect(page.locator("[data-card-stage]")).toHaveText("Stage 06 · External Memory");
    await expect(page.locator("[data-card]")).not.toContainText("You were reading");
  });

  test("nothing in progress: Next up names the first open stage", async ({ page }) => {
    await openMap(page, {
      patch: (b) => ({ ...b, nodes: b.nodes.map((n) => (n.state === "in_progress" ? { ...n, state: "available" as const, mastery: 0 } : n)) }),
    });
    await expect(page.locator("[data-card-eyebrow]")).toHaveText("Next up");
    await expect(page.locator("[data-card-stage]")).toHaveText("Stage 00 · Orientation");
  });
});

test.describe("marks: shape and words, never the accent for a state", () => {
  test("the accent is on the next stage's ring and nowhere else", async ({ page }) => {
    await openMap(page);
    const r = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--accent)";
      document.body.appendChild(probe);
      const accent = getComputedStyle(probe).color;
      probe.style.color = "";
      probe.style.fill = "var(--accent)";
      const accentFill = getComputedStyle(probe).fill;
      probe.remove();
      const bad: string[] = [];
      for (const b of document.querySelectorAll<HTMLElement>("[data-flatmap] button.node-hit")) {
        const d = getComputedStyle(b.querySelector(".fm-dot")!);
        const vals = [d.color, d.backgroundColor, d.borderTopColor, d.borderRightColor, d.borderBottomColor, d.borderLeftColor];
        if (vals.includes(accent)) bad.push(`${b.dataset.stage} dot`);
      }
      for (const el of document.querySelectorAll<SVGElement>("[data-flatmap] .galaxy-svg *")) {
        if (el.classList.contains("galaxy-next")) continue;
        const cs = getComputedStyle(el);
        if (cs.fill === accentFill || cs.stroke === accentFill) bad.push(el.getAttribute("class") ?? el.tagName);
      }
      const next = document.querySelector<HTMLElement>("[data-flatmap] button.node-hit[data-next=true]");
      return { bad, nextRing: next ? getComputedStyle(next.querySelector(".fm-dot")!).boxShadow.includes(accent) : false };
    });
    expect(r.bad, "a state painted in the accent").toEqual([]);
    expect(r.nextRing, "the next stage carries the accent ring").toBe(true);
  });

  test("links are styled, never browser purple or blue", async ({ page }) => {
    await openMap(page);
    const colours = await page.locator("[data-flatmap] a[href]").evaluateAll((els) => els.map((a) => getComputedStyle(a).color));
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) expect(["rgb(85, 26, 139)", "rgb(0, 0, 238)"]).not.toContain(c);
  });

  test("the route is flat by choice: no canvas, no biome, no rotate prompt, no first-run card", async ({ page }) => {
    await openMap(page);
    expect(await page.locator("canvas").count()).toBe(0);
    expect(await page.locator(".biome").count()).toBe(0);
    expect(await page.locator(".rotate-prompt, .first-run, .first-run-replay").count()).toBe(0);
  });
});

test.describe("one flat presentation (instructor 29 Sep 2026)", () => {
  test("/app under reduced motion mounts the same map, and its panel works there", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openMap(page, { path: "/app", wait: null });
    const view = page.locator("[data-flatmap-view]");
    await expect(view).toHaveCount(1, { timeout: 20_000 });
    await expect(view.locator("button.node-hit")).toHaveCount(19);
    await view.locator('button.node-hit[data-stage="01"]').click();
    await expect(view.locator("[data-panel]")).toHaveAttribute("data-panel", "stage");
    expect(new URL(page.url()).pathname, "nothing redirects").toBe("/app");
  });
});

test.describe("loading, failing, empty", () => {
  test("loading: nothing under 400ms, a skeleton after, words after 3s", async ({ page }, info) => {
    test.skip(!wide(info), "timing, one width");
    await page.addInitScript(() => {
      const w = window as unknown as { __t: Record<string, number> };
      w.__t = {};
      new MutationObserver(() => {
        const t = performance.now();
        if (!w.__t.loading && document.querySelector('[data-flatmap="loading"]')) w.__t.loading = t;
        if (!w.__t.skeleton && document.querySelector("[data-flatmap] [data-skeleton]")) w.__t.skeleton = t;
        if (!w.__t.slow && /Still arriving/.test(document.querySelector('[data-flatmap="loading"]')?.textContent ?? "")) w.__t.slow = t;
        if (!w.__t.ready && document.querySelector('[data-flatmap="ready"]')) w.__t.ready = t;
      }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
    });
    await openMap(page, { delayMs: 5000, wait: "ready" });
    const t = await page.evaluate(() => (window as unknown as { __t: Record<string, number> }).__t);
    expect(t.loading, "the loading state never rendered").toBeGreaterThan(0);
    expect(t.skeleton! - t.loading!, "a skeleton inside 400ms is a flash").toBeGreaterThanOrEqual(380);
    expect(t.skeleton! - t.loading!, "no skeleton by a second").toBeLessThan(1000);
    expect(t.slow! - t.loading!, "words before 3s").toBeGreaterThanOrEqual(2900);
    expect(t.ready! - t.slow!, "the words came after the map").toBeGreaterThan(0);
  });

  test("a failed read says what failed, and Try again reads again", async ({ page }) => {
    // Two: the shell reads the map for its chrome as well as the page.
    await openMap(page, { failTimes: 2, wait: "error" });
    const err = page.locator('[data-flatmap="error"]');
    await expect(err).toContainText("The map did not load.");
    await expect(err.getByRole("alert")).toContainText("Something went wrong on our side");
    await expect(page.locator("h1")).toHaveCount(1);
    await err.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator('[data-flatmap="ready"]')).toBeVisible();
  });

  test("no stages published: says so, and draws no empty map", async ({ page }) => {
    await openMap(page, { patch: (b) => ({ ...b, nodes: [], edges: [] }) });
    await expect(page.locator("[data-flatmap]")).toContainText("No stages have been published yet.");
    await expect(stages(page)).toHaveCount(0);
  });
});

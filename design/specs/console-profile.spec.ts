import { test, expect, type Page, type Route } from "@playwright/test";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { installPictureStandIn, makePhoto, type PictureStandIn } from "./_profile-fixture";
import { S006_ID, STAFF, seedChat, signIn } from "./_chat-fixture";
import { TEACHERS, ADMIN_ID } from "./_teachers-fixture";
import { createHmac } from "node:crypto";

/**
 * `/profile` (teacher and admin) and the picture wherever the console names a
 * person (PROFILES, 9 Oct 2026; design/templates/console/profile/SPEC.md).
 *
 * The local API has no Storage, so the upload half runs against
 * `_profile-fixture.ts`; the server's own rules (path shape, 300 KB, the WebP
 * bytes, who may remove) are `services/api/test/profile.spec.ts` and
 * `profiles-rls.spec.ts`. What this proves that those cannot: the BROWSER made
 * a real 512 x 512 WebP from a photo that was not square, the page reacts to
 * every outcome, a Remove control exists only where the server said
 * `removable`, and the removal sends a reason.
 */

const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const wide = () => test.info().project.name === "desktop-1440";

const FACE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='#456'/><circle cx='32' cy='26' r='12' fill='#cba'/><rect x='12' y='42' width='40' height='22' rx='10' fill='#cba'/></svg>",
  );
const planet = (removable = false, url: string | null = null) => ({ url, hue: 210, variant: 1, removable });

const EXTRA = {
  employeeId: "EMP-0102",
  classes: [
    { subject: "CPE 412", subjectTitle: "Computer Architecture and Organization", section: "BSCPE - 4", term: "2026-2027 First Semester", teacher: null },
    { subject: "CPE 401", subjectTitle: "Computer Engineering Thesis", section: "BSCPE - 4", term: "2026-2027 First Semester", teacher: null },
  ],
};

async function openProfile(page: Page, opts: { store?: boolean; token?: string; merge?: Record<string, unknown> } = {}): Promise<PictureStandIn | null> {
  await signIn(page, opts.token ?? STAFF);
  const s = opts.store === false ? null : await installPictureStandIn(page, { ...EXTRA, ...opts.merge });
  await page.goto(`${CONSOLE_URL}/profile`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-profile] .prof-ring").waitFor({ timeout: 20_000 });
  return s;
}

async function choose(page: Page): Promise<void> {
  const photo = await makePhoto(page);
  await page.locator("[data-profile] input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: photo });
  await page.locator("[data-cropper]").waitFor();
}

test.describe("/profile — SPEC.md", () => {
  test("reached from the account menu, not the nav", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto(`${CONSOLE_URL}/locks`, { waitUntil: "domcontentloaded" });
    // The sidebar is a sheet at 380: the menu button is in the top bar there.
    if (!wide()) await page.getByRole("button", { name: "Open menu" }).click({ timeout: 20_000 });
    await page.getByRole("button", { name: /account menu/ }).first().waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: /account menu/ }).click();
    await page.getByRole("menuitem", { name: "Your profile" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your profile");
    expect(await page.locator("nav[aria-label='Console sections'] a[href='/profile']").count()).toBe(0);
  });

  test("the facts are read-only: name, role, Employee ID in mono, email, the classes held", async ({ page }) => {
    await openProfile(page);
    const who = page.getByRole("region", { name: "Who you are" });
    await expect(who).toContainText("Teacher");
    await expect(who.locator("[data-employee-id]")).toHaveText("EMP-0102");
    await expect(who.locator("[data-employee-id]")).toHaveClass(/num/);
    const classes = page.getByRole("region", { name: "Your classes" });
    await expect(classes.locator("li")).toHaveCount(2);
    await expect(classes).toContainText("CPE 412");
    // No input anywhere but the picture's.
    expect(await page.locator("[data-profile] input:not([type=file])").count()).toBe(0);
  });

  test("an account not on the roster says so, and no classes says who assigns one", async ({ page }) => {
    await openProfile(page, { merge: { employeeId: null, classes: [] } });
    await expect(page.locator("[data-employee-id]")).toContainText("Not on the roster");
    await expect(page.getByRole("region", { name: "Your classes" })).toContainText("The admin assigns one on Teachers");
  });

  test("no picture: a planet, the honest note about who sees it, Choose but no Remove", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator("[data-ring] .avatar[data-avatar='generated']")).toBeVisible();
    await expect(page.getByText(/seen by every student you teach/)).toBeVisible();
    await expect(page.getByText("Choose a picture")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove picture" })).toHaveCount(0);
  });

  test("a photo that is not square becomes a 512 x 512 WebP under 300 KB, with no EXIF, and shows in the shell", async ({ page }) => {
    const s = (await openProfile(page))!;
    await choose(page);
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your picture is set" })).toBeVisible();
    expect(s.uploads).toHaveLength(1);
    const bytes = s.uploads[0]!;
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
    expect(bytes.length).toBeLessThanOrEqual(300 * 1024);
    expect(bytes.toString("latin1")).not.toMatch(/EXIF|XMP /);
    await expect(page.getByRole("button", { name: "Remove picture" })).toBeVisible();
    // The shell's account block shows the same picture (at 380 it sits in the sheet).
    if (!wide()) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator(".shell-account .avatar[data-avatar='picture']")).toBeVisible();
  });

  test("a failed save keeps the picture on the stage with its crop, and the error stays", async ({ page }) => {
    const s = (await openProfile(page))!;
    await choose(page);
    s.failNextRecord = true;
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Your picture was not saved" })).toBeVisible();
    await expect(page.locator("[data-cropper]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Use this picture" })).toBeEnabled();
  });

  test("Cancel sends nothing; Remove brings the planet back", async ({ page }) => {
    const s = (await openProfile(page))!;
    await choose(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("[data-cropper]")).toHaveCount(0);
    expect(s.uploads).toHaveLength(0);
    s.picture = true;
    await page.reload();
    await page.locator("[data-ring]").waitFor();
    await page.getByRole("button", { name: "Remove picture" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your picture is removed" })).toBeVisible();
    await expect(page.locator("[data-ring] .avatar[data-avatar='generated']")).toBeVisible();
  });

  test("after the admin removed it: one note, with the day, until a new one is chosen", async ({ page }) => {
    const s = (await openProfile(page, { store: true }))!;
    s.removedAt = "2026-10-08T03:00:00.000Z";
    await page.reload();
    await page.locator("[data-ring]").waitFor();
    await expect(page.locator("[data-removed]")).toContainText("removed by the admin");
  });

  test("a server with no file storage says so and offers no upload", async ({ page }) => {
    await openProfile(page, { store: false });
    await expect(page.getByText("Pictures are not switched on")).toBeVisible();
    await expect(page.locator("[data-profile] input[type=file]")).toHaveCount(0);
  });

  test("a file that is not a picture is refused with a toast and nothing opens", async ({ page }) => {
    const s = (await openProfile(page))!;
    await page.locator("[data-profile] input[type=file]").setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("this is not an image") });
    await expect(page.getByRole("alert").filter({ hasText: "That picture was not opened" })).toBeVisible();
    await expect(page.locator("[data-cropper]")).toHaveCount(0);
    expect(s.uploads).toHaveLength(0);
  });

  test("a slow first load shows the shape of the page, then the page", async ({ page }) => {
    await signIn(page, STAFF);
    await installPictureStandIn(page, EXTRA);
    await page.route("**/api/v1/profile", async (route: Route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await new Promise((r) => setTimeout(r, 900));
      return route.fallback();
    });
    await page.goto(`${CONSOLE_URL}/profile`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-loading]").waitFor({ timeout: 5_000 });
    await page.locator("[data-profile] .prof-ring").waitFor({ timeout: 15_000 });
  });
});

/* ------------------------------------------------ the picture around the console */

async function openStudent(page: Page, face: ReturnType<typeof planet>, removedAt: string | null = null) {
  const writes: Array<Record<string, unknown>> = [];
  await signIn(page, STAFF);
  await page.route(new RegExp(`/api/v1/console/students/${S006_ID}$`), async (route: Route) => {
    const res = await route.fetch();
    const d = (await res.json()) as { student: Record<string, unknown> };
    d.student.avatar = face;
    d.student.pictureRemovedAt = removedAt;
    return route.fulfill({ response: res, json: d });
  });
  await page.route(new RegExp(`/api/v1/profiles/${S006_ID}/avatar$`), async (route: Route) => {
    writes.push(route.request().postDataJSON() as Record<string, unknown>);
    face = planet(false);
    removedAt = "2026-10-09T02:00:00.000Z";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ removed: true }) });
  });
  await page.goto(`${CONSOLE_URL}/students/${S006_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 20_000 });
  return writes;
}

test.describe("the picture around the console", () => {
  test("the roster shows a face beside every name", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto(`${CONSOLE_URL}/students`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-student]").first().waitFor({ timeout: 20_000 });
    const rows = await page.locator("[data-student]").count();
    expect(rows).toBeGreaterThan(3);
    expect(await page.locator("[data-student] .avatar").count()).toBe(rows);
  });

  test("a student's record: Remove picture is offered only where the server said removable", async ({ page }) => {
    await openStudent(page, planet(false));
    await page.getByRole("button", { name: /^Actions for / }).click();
    await expect(page.getByRole("menuitem", { name: "Move to section…" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Remove picture…" })).toHaveCount(0);
  });

  test("removing a picture needs a reason, sends it, and the record says it was removed", async ({ page }) => {
    const writes = await openStudent(page, planet(true, FACE));
    await expect(page.locator(".record-who .avatar[data-avatar='picture']")).toBeVisible();
    await page.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Remove picture…" }).click();
    const d = page.getByRole("dialog");
    await expect(d.getByRole("button", { name: "Remove picture" })).toBeDisabled();
    await d.getByLabel("Reason (required)").fill("Not a picture of the student");
    await d.getByRole("button", { name: "Remove picture" }).click();
    await expect(d).toBeHidden();
    expect(writes).toEqual([{ reason: "Not a picture of the student" }]);
    await expect(page.locator("[data-picture-removed]")).toContainText("Their picture was removed");
    await expect(page.locator(".record-who .avatar[data-avatar='generated']")).toBeVisible();
  });

  test("the class chat: a face on every message, Remove picture only on a removable author", async ({ page, request }) => {
    const { section } = await seedChat(request);
    await signIn(page, STAFF);
    await page.route(new RegExp(`/api/v1/chat/rooms/${section}(\\?.*)?$`), async (route: Route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const res = await route.fetch();
      const t = (await res.json()) as { messages: Array<{ mine: boolean; author: Record<string, unknown> }> };
      let first = true;
      for (const m of t.messages) {
        if (m.mine) continue;
        m.author.avatar = planet(first, first ? FACE : null);
        first = false;
      }
      return route.fulfill({ response: res, json: t });
    });
    await page.goto(`${CONSOLE_URL}/chat?room=${section}`, { waitUntil: "domcontentloaded" });
    await page.locator(".ch-msgs").waitFor({ timeout: 20_000 });
    const msgs = await page.locator(".ch-msg").count();
    expect(msgs).toBeGreaterThan(0);
    // A face at the start of each run of someone else's messages, none on your own.
    expect(await page.locator(".ch-msg-face .avatar").count()).toBe(await page.locator(".ch-msg:not(.is-mine):not(.is-grouped)").count());
    expect(await page.locator(".ch-msg-face .avatar").count()).toBeGreaterThan(0);
    expect(await page.getByRole("button", { name: /^Remove .*'s picture$/ }).count()).toBe(1);
    await page.getByRole("button", { name: /^Remove .*'s picture$/ }).click();
    await expect(page.getByRole("dialog")).toContainText("picture?");
    await page.keyboard.press("Escape");
  });

  test("/teachers shows a face; /teachers/:key offers Remove picture to the admin only where removable", async ({ page }) => {
    const admin = (() => {
      const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const h = b64({ alg: "HS256", typ: "JWT" });
      const p = b64({ sub: ADMIN_ID, email: "admin@fixture.test", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role: "admin" } });
      return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
    })();
    await signIn(page, admin);
    await page.route("**/api/v1/console/teachers", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TEACHERS) }));
    await page.goto(`${CONSOLE_URL}/teachers`, { waitUntil: "domcontentloaded" });
    await page.locator(".roster-who").first().waitFor({ timeout: 20_000 });
    expect(await page.locator(".roster-who .avatar").count()).toBeGreaterThanOrEqual(TEACHERS.teachers.length);
  });
});

/* ------------------------------------------------ captures, then the gate */

test("capture: current, current-380, the cropper and the removal dialog", async ({ page }) => {
  test.setTimeout(90_000);
  const s = wide() ? "" : "-380";
  const dir = "design/templates/console/profile";
  await page.setViewportSize({ width: wide() ? 1440 : 380, height: wide() ? 1000 : 844 });
  const st = (await openProfile(page))!;
  await page.screenshot({ path: `${dir}/current-empty${s}.png`, fullPage: true });
  await choose(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/current-crop${s}.png`, fullPage: true });
  await page.getByRole("button", { name: "Use this picture" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your picture is set" })).toBeVisible();
  // The toast covers a card at 380 for four seconds; the page is what is captured.
  await page.getByRole("button", { name: "Dismiss" }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/current${s}.png`, fullPage: true });
  expect(st.uploads).toHaveLength(1);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openStudent(page, planet(true, FACE));
  await page.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Remove picture…" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/current-remove${s}.png` });
});

type Screen = [string, (page: Page) => Promise<unknown>];
const SCREENS: Screen[] = [
  ["resting", (p) => openProfile(p)],
  ["no roster id, no classes", (p) => openProfile(p, { merge: { employeeId: null, classes: [] } })],
  ["cropping", async (p) => { await openProfile(p); await choose(p); }],
  ["admin removed it", async (p) => { const s = (await openProfile(p))!; s.removedAt = "2026-10-08T03:00:00.000Z"; await p.reload(); await p.locator("[data-removed]").waitFor(); }],
  ["no file storage", (p) => openProfile(p, { store: false })],
  ["record with Remove picture", (p) => openStudent(p, planet(true, FACE))],
  ["remove dialog", async (p) => {
    await openStudent(p, planet(true, FACE));
    await p.getByRole("button", { name: /^Actions for / }).click();
    await p.getByRole("menuitem", { name: "Remove picture…" }).click();
    await p.getByRole("dialog").waitFor();
  }],
];

test.describe("the gate — CONSOLE-REVAMP.md §2, /profile", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await clippedElements(page), name).toEqual([]);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await horizontalOverflow(page), name).toBeLessThanOrEqual(0);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openProfile(page);
    expect(await unreachableByKeyboard(page, "main"), "resting").toEqual([]);
    await choose(page);
    expect(await unreachableByKeyboard(page, "main"), "cropping").toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openStudent(page, planet(true, FACE));
    await page.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Remove picture…" }).click();
    await page.getByRole("dialog").waitFor();
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "remove dialog").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    const failures: string[] = [];
    for (const [name, open] of SCREENS) {
      await open(page);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} ${name}: ${f}`));
      }
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await offTokenStyles(page), name).toEqual([]);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    await recordMotion(page);
    await openStudent(page, planet(true, FACE));
    await page.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Remove picture…" }).click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms >= 100).length, "a dialog should ease in").toBeGreaterThan(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openProfile(page);
    await choose(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "profile").toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openStudent(page, planet(true, FACE));
    await page.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Remove picture…" }).click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "dialog").toEqual([]);
  });
});

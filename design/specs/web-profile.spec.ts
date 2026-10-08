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
import { S006 } from "./_stage-fixture";
import { installPictureStandIn, makePhoto, type PictureStandIn } from "./_profile-fixture";

/**
 * `/app/profile`, in the star HUD (PROFILES, 8 Oct 2026;
 * design/templates/web/profile/SPEC.md). A picture (choose, position, zoom, use,
 * remove), the facts the roster owns, the classes. Read-only except the picture.
 *
 * The local API has no Storage, so the picture's upload half runs against
 * `_profile-fixture.ts` (the server's own rules are `profile.spec.ts` and
 * `profiles-rls.spec.ts` in services/api). What these specs prove that those
 * cannot is that the BROWSER made a real 512 x 512 WebP of 300 KB or less from a
 * photo that was not square, and that the page reacts to every outcome.
 */

const ROUTE = ".prof";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

async function open(page: Page, withStore = true): Promise<PictureStandIn | null> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
  const s = withStore ? await installPictureStandIn(page) : null;
  await page.goto("/app/profile", { waitUntil: "domcontentloaded" });
  await page.locator("[data-profile] .prof-ring").waitFor({ timeout: 20_000 });
  return s;
}

async function choose(page: Page): Promise<void> {
  const photo = await makePhoto(page);
  await page.locator("[data-profile] input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: photo });
  await page.locator("[data-cropper]").waitFor();
}

/** The stage's pixels, to tell whether the picture moved. */
const stagePixels = (page: Page) => page.locator(".avatar-cropper-stage canvas").evaluate((c) => (c as HTMLCanvasElement).toDataURL());

test.describe("/app/profile — the six gate assertions", () => {
  test("1 · nothing is clipped (resting, and with a picture on the stage)", async ({ page }) => {
    await open(page);
    expect(await clippedElements(page, ROUTE)).toEqual([]);
    await choose(page);
    expect(await clippedElements(page, ROUTE)).toEqual([]);
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await choose(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
  test("3 · every control is reachable by keyboard (the stage, the zoom, the buttons)", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
    await choose(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });
  test("4 · AA computed on the star set, at rest, with a picture on the stage, and after a teacher's removal", async ({ page }) => {
    const s = (await open(page))!;
    expect(await contrastFailures(page, ROUTE), "resting").toEqual([]);
    await choose(page);
    expect(await contrastFailures(page, ROUTE), "cropping").toEqual([]);
    s.removedAt = new Date().toISOString();
    await page.reload();
    await page.locator("[data-removed]").waitFor();
    expect(await contrastFailures(page, ROUTE), "after a removal").toEqual([]);
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await open(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
    await choose(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("6 · reduced motion: choosing, using and removing do not animate", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await open(calm);
    await choose(calm);
    await calm.getByRole("button", { name: "Use this picture" }).click();
    await calm.getByRole("button", { name: "Remove picture" }).click();
    await calm.locator("[data-profile] .prof-ring").waitFor();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/app/profile — what the page owes", () => {
  test("the roster's facts, read-only: name, number in mono, section, classes", async ({ page }) => {
    await open(page);
    await expect(page.locator(".prof-facts")).toContainText("Kristine Joy Montebon");
    const id = page.locator("[data-student-id]");
    await expect(id).toHaveText("232129006");
    expect(await id.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
    await expect(page.locator(".prof-facts")).toContainText("BSCPE - 4");
    await expect(page.locator(".prof-classes li").first()).toContainText("CPE 412");
    // Nothing on the page edits them.
    await expect(page.locator(".prof input:not([type=file]):not([type=range]), .prof textarea")).toHaveCount(0);
  });

  test("with no storage on the server it says so and offers no upload (the real API, no stand-in)", async ({ page }) => {
    await open(page, false);
    await expect(page.locator(".prof")).toContainText("Pictures are not switched on for this server");
    await expect(page.getByRole("button", { name: /choose a picture/i })).toHaveCount(0);
    // The generated planet stands in, and is drawn, not an empty box.
    await expect(page.locator(".prof-ring [data-avatar=generated]")).toBeVisible();
  });

  test("the generated planet is the fallback, and the top strip carries it as a link to this page", async ({ page }) => {
    await open(page);
    await expect(page.locator(".prof-ring [data-avatar=generated]")).toBeVisible();
    const me = page.locator("[data-me]");
    await expect(me).toHaveAttribute("href", "/app/profile");
    await expect(me).toHaveAttribute("aria-label", "Your profile");
    await expect(me.locator("[data-avatar=generated]")).toBeVisible();
  });

  test("choose, position, use: the browser makes a 512 x 512 WebP under 300 KB, and it shows at once", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const s = (await open(page))!;
    await choose(page);
    await page.locator(".avatar-cropper-zoom input").fill("1.6");
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("Your picture is set");
    await expect(page.locator(".prof-ring [data-avatar=picture] img")).toBeVisible();
    await expect(page.locator("[data-me] [data-avatar=picture]")).toBeVisible();

    expect(s.uploads.length).toBe(1);
    const bytes = s.uploads[0]!;
    expect(s.signed).toEqual([bytes.length]); // it announced exactly what it sent
    expect(bytes.length).toBeLessThanOrEqual(300 * 1024);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
    const dims = await page.evaluate(async (b64) => {
      const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "image/webp" });
      const bmp = await createImageBitmap(blob);
      return [bmp.width, bmp.height];
    }, bytes.toString("base64"));
    expect(dims).toEqual([512, 512]);
  });

  test("EXIF and GPS never leave the page: the sent file carries no EXIF chunk", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const s = (await open(page))!;
    await choose(page);
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("Your picture is set");
    const bytes = s.uploads[0]!;
    // A WebP carries metadata in EXIF / XMP chunks; a canvas re-encode has none.
    const text = bytes.toString("latin1");
    expect(text).not.toContain("EXIF");
    expect(text).not.toContain("XMP ");
  });

  test("the arrow keys and the zoom move the picture on the stage; Cancel sends nothing", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const s = (await open(page))!;
    await choose(page);
    await page.locator(".avatar-cropper-zoom input").fill("2");
    const before = await stagePixels(page);
    await page.locator(".avatar-cropper-stage").focus();
    for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");
    const moved = await stagePixels(page);
    expect(moved).not.toBe(before);
    await page.keyboard.press("ArrowLeft");
    expect(await stagePixels(page)).not.toBe(moved);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("[data-cropper]")).toHaveCount(0);
    expect(s.uploads.length).toBe(0);
    expect(s.signed.length).toBe(0);
  });

  test("dragging the picture moves it (and a drag is not the only way: the arrow keys do)", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await open(page);
    await choose(page);
    await page.locator(".avatar-cropper-zoom input").fill("2");
    const before = await stagePixels(page);
    const box = (await page.locator(".avatar-cropper-stage").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 20, { steps: 5 });
    await page.mouse.up();
    expect(await stagePixels(page)).not.toBe(before);
  });

  test("a failed save keeps the picture on the stage with its crop, says what to do, and a retry works", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const s = (await open(page))!;
    await choose(page);
    await page.locator(".avatar-cropper-zoom input").fill("1.8");
    s.failNextRecord = true;
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.locator("[data-toaster] [role=alert]")).toContainText("Your picture was not saved");
    // Still on the stage, the zoom kept, the button back.
    await expect(page.locator("[data-cropper]")).toBeVisible();
    await expect(page.locator(".avatar-cropper-zoom input")).toHaveValue("1.8");
    await expect(page.getByRole("button", { name: "Use this picture" })).toBeEnabled();
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("Your picture is set");
  });

  test("a file that is not a picture says so and opens nothing", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const s = (await open(page))!;
    await page.locator("[data-profile] input[type=file]").setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("this is not an image") });
    await expect(page.locator("[data-toaster] [role=alert]")).toContainText("That picture was not opened");
    await expect(page.locator("[data-cropper]")).toHaveCount(0);
    expect(s.signed.length).toBe(0);
  });

  test("Remove brings the planet back and says so; choosing again is open to them", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const s = (await open(page))!;
    await choose(page);
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.locator(".prof-ring [data-avatar=picture]")).toBeVisible();
    await page.getByRole("button", { name: "Remove picture" }).click();
    await expect(page.locator("[data-toaster] [role=status]", { hasText: "Your picture is removed" })).toBeVisible();
    await expect(page.locator(".prof-ring [data-avatar=generated]")).toBeVisible();
    await expect(page.locator("[data-removed]")).toHaveCount(0); // their own removal is not a teacher's
    await expect(page.getByRole("button", { name: "Choose a picture" })).toBeVisible();
    expect(s.picture).toBe(false);
  });

  test("a teacher's removal is told, once, with the day, until they choose a new one", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const s = (await open(page))!;
    s.removedAt = "2026-10-08T05:00:00.000Z";
    await page.reload();
    const note = page.locator("[data-removed]");
    await expect(note).toContainText("Your picture was removed by your teacher");
    await expect(note).toContainText("Oct");
    await choose(page);
    await page.getByRole("button", { name: "Use this picture" }).click();
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("Your picture is set");
    await expect(page.locator("[data-removed]")).toHaveCount(0);
  });

  test("Settings links to it", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/settings", { waitUntil: "domcontentloaded" });
    await page.locator("[data-profile-link]").click();
    await expect(page).toHaveURL(/\/app\/profile$/);
  });

  test("the star realm, and no biome; the top strip's chip marks the page it is on", async ({ page }) => {
    await open(page);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    expect(await page.locator("html").getAttribute("data-biome")).toBeNull();
    await expect(page.locator("[data-me]")).toHaveClass(/active/);
  });
});

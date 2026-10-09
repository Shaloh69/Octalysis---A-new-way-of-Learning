import type { Page, Route } from "@playwright/test";

/**
 * A stand-in for the profile picture's storage half (PROFILES, 8 Oct 2026).
 *
 * The local stack has no Supabase Storage, so the real API answers
 * `pictures: false` and refuses an upload. The pages' behaviour (crop, encode,
 * upload, record, remove, the notice after a teacher's removal) still has to be
 * driven in a real browser, so this fixture answers the picture endpoints from
 * a small state machine and passes everything else, including the real
 * GET /profile (identity, classes), through to the real API.
 *
 * What it does NOT prove: the server's own rules (path shape, 300 KB, the WebP
 * bytes, who may remove) are `services/api/test/profile.spec.ts` and
 * `profiles-rls.spec.ts`, 71 tests, and the real bucket was checked on the
 * deployment. What it DOES prove is that the BROWSER produced a real 512 x 512
 * WebP of 300 KB or less from a non-square photo, and that the page reacts.
 */

export interface PictureStandIn {
  /** The bytes the page PUT to the signed URL, in order. */
  readonly uploads: Buffer[];
  /** Requests the page made to sign an upload: the size it announced. */
  readonly signed: number[];
  /** The picture on file, or null. */
  picture: boolean;
  /** Set to simulate a teacher's removal. */
  removedAt: string | null;
  /** Make the next record call fail (to see the page keep the crop). */
  failNextRecord: boolean;
}

const STORE = "https://storage.test";

export async function installPictureStandIn(
  page: Page,
  /** Fields merged into every profile the page is given (the console's page wants an employee ID and classes the local seed lacks). */
  merge: Record<string, unknown> = {},
): Promise<PictureStandIn> {
  const s: PictureStandIn = { uploads: [], signed: [], picture: false, removedAt: null, failNextRecord: false };
  let last: Buffer | null = null;

  const profile = async (route: Route) => {
    const res = await route.fetch();
    const p = (await res.json()) as Record<string, unknown> & { avatar: Record<string, unknown> };
    return {
      ...p,
      ...merge,
      pictures: true,
      hasPicture: s.picture,
      removedAt: s.picture ? null : s.removedAt,
      avatar: { ...p.avatar, url: s.picture ? `${STORE}/get/me.webp?v=${s.uploads.length}` : null },
    };
  };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/api/v1/profile", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return json(route, await profile(route));
  });
  await page.route("**/api/v1/profile/avatar/upload", async (route) => {
    const body = route.request().postDataJSON() as { bytes: number };
    s.signed.push(body.bytes);
    return json(route, { path: `me/${s.signed.length}.webp`, uploadUrl: `${STORE}/upload/${s.signed.length}` }, 201);
  });
  await page.route(`${STORE}/upload/**`, async (route) => {
    last = route.request().postDataBuffer();
    if (last) s.uploads.push(last);
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route(`${STORE}/get/**`, (route) =>
    last
      ? route.fulfill({ status: 200, contentType: "image/webp", body: last })
      : route.fulfill({ status: 404, body: "" }),
  );
  await page.route("**/api/v1/profile/avatar", async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      if (s.failNextRecord) {
        s.failNextRecord = false;
        return json(route, { error: { code: "bad_request", message: "That picture was not uploaded for you." } }, 400);
      }
      s.picture = true;
      s.removedAt = null;
    } else if (method === "DELETE") {
      s.picture = false;
      s.removedAt = null;
    } else return route.continue();
    // The real GET carries the identity; ask it through a fresh request.
    const real = await page.request.get(new URL("/api/v1/profile", route.request().url()).toString(), {
      headers: { authorization: route.request().headers()["authorization"] ?? "" },
    });
    const p = (await real.json()) as Record<string, unknown> & { avatar: Record<string, unknown> };
    return json(route, {
      ...p,
      ...merge,
      pictures: true,
      hasPicture: s.picture,
      removedAt: null,
      avatar: { ...p.avatar, url: s.picture ? `${STORE}/get/me.webp?v=${s.uploads.length}` : null },
    });
  });
  return s;
}

/** A 800 x 500 photo, drawn in the page: not square, so the crop has something to do. PNG bytes. */
export async function makePhoto(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 500;
    const g = c.getContext("2d")!;
    const sky = g.createLinearGradient(0, 0, 800, 500);
    sky.addColorStop(0, "#1b3a5c");
    sky.addColorStop(1, "#e08a3c");
    g.fillStyle = sky;
    g.fillRect(0, 0, 800, 500);
    g.fillStyle = "#f3d9b1";
    g.beginPath();
    g.arc(400, 210, 110, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2b2b2b";
    g.beginPath();
    g.arc(360, 190, 12, 0, Math.PI * 2);
    g.arc(440, 190, 12, 0, Math.PI * 2);
    g.fill();
    g.fillRect(370, 250, 60, 8);
    g.fillStyle = "#3a6ea5";
    g.fillRect(250, 340, 300, 160);
    return c.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1]!, "base64");
}

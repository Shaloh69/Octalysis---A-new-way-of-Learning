/**
 * Capture one screenshot per biome into `design/biomes/`.
 *
 * `BIOME-AND-LOADING-SPEC.md` §2e says a composition change means re-capturing
 * and comparing, and then there was no way to re-capture — every previous set
 * was made by an ad-hoc script that was thrown away, so "re-capture" silently
 * meant "write the script again". Seven near-identical scripts later, here it is
 * once.
 *
 * It reports the layer shape per biome as it goes, because the interesting
 * failure is not a crash. It is a biome quietly drawing four layers when its
 * manifest declares five — which looks fine in a screenshot and is invisible in
 * a diff.
 *
 *   node scripts/capture-biomes.mjs
 *   OCTA_WEB_URL=http://localhost:5183 node scripts/capture-biomes.mjs
 */
import { chromium } from "@playwright/test";
import { createHmac } from "node:crypto";

const BASE = process.env.OCTA_WEB_URL ?? "http://localhost:5173";
const SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const OUT = new URL("../design/biomes", import.meta.url).pathname.replace(/^\//, "");

const BIOMES = ["neutral", "jungle", "desert", "arctic", "ocean", "cave", "city"];

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1e3) + 86_400,
    app_metadata: { role: "student", student_id: "232129006" },
  });
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => localStorage.setItem("octa:dev-token", t), token());
const page = await ctx.newPage();

await page.goto(`${BASE}/app/stage/00`, { waitUntil: "domcontentloaded" });
await page.locator("h1").first().waitFor({ timeout: 15_000 });

/*
 * The same guard `design/global-setup.ts` carries, for the same reason: another
 * Vite project on port 5173 answers 200, renders an h1 and screenshots happily,
 * and its pictures get committed as this project's biomes. That has happened.
 */
const title = await page.title();
if (!/OCTA/i.test(title)) {
  throw new Error(
    `${BASE} is serving "${title}", which is NOT OCTA. Another project took the ` +
      `port — re-run with OCTA_WEB_URL=http://localhost:<port>.`,
  );
}

for (const biome of BIOMES) {
  // `useSeededBiome` watches this attribute, so setting it re-renders the scene
  // — deterministic, and independent of which biome a seeded student would get.
  await page.evaluate((b) => document.documentElement.setAttribute("data-biome", b), biome);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${biome}.png` });

  const shape = await page.evaluate(() => {
    const el = document.querySelector(".biome");
    if (!el) return null;
    return {
      layers: el.querySelectorAll(".biome-layer").length,
      sprites: el.querySelectorAll(".biome-sprite").length,
      ground: el.querySelectorAll(".biome-ground").length,
      motes: el.querySelectorAll(".biome-mote").length,
    };
  });

  if (!shape) {
    console.log(`${biome.padEnd(8)} NO SCENE RENDERED`);
    continue;
  }
  console.log(
    `${biome.padEnd(8)} layers=${shape.layers} sprites=${String(shape.sprites).padEnd(3)} ` +
      `ground=${shape.ground} motes=${shape.motes}`,
  );
}

await browser.close();

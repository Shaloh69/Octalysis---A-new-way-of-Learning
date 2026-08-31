import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright for the visual pass. Added in R0.3 of the solar-system redesign.
 *
 * This is NOT the same thing as the Playwright MCP server in `.mcp.json`, and
 * the distinction matters enough that R0.3 makes you confirm both states
 * independently:
 *
 *   @playwright/mcp   ad-hoc, agent-driven, writes to `.playwright/`, which is
 *                     gitignored because console captures contain real student
 *                     names. This is what produced DESIGN-REVIEW-01's captures.
 *   @playwright/test  this file. A committed harness that can fail CI, with
 *                     formal baselines that live in the repo forever.
 *
 * `REDESIGN-CLAUDE.md` §2: no page, biome, minigame or console view is
 * implemented until it has been screenshotted and looked at -- every page,
 * every iteration, at 1440 AND 380. Both widths are projects below, so a bare
 * `pnpm qa` runs both and neither can be forgotten.
 *
 * WHAT MAY GO IN `design/baselines/`, because it is committed:
 * student-app and public pages, and console pages captured against seeded
 * fixture data ONLY. Never a real student or teacher name. `.playwright/` is
 * gitignored for exactly that reason and this folder is permanent, so the rule
 * binds harder here, not less.
 */

/** Freeze orbit drift, biome parallax and every ambient loop for stable pixels. */
const QA_MODE = "1";

/**
 * Repo convention is Vite, so `VITE_*` -- NOT `NEXT_PUBLIC_*`. Ports match
 * `DESIGN-REVIEW-01.md`'s reproduce block: 5173 web, 5174 console, 8090 api
 * (8080 is often taken by another project's Adminer).
 */
const WEB_URL = process.env.OCTA_WEB_URL ?? "http://localhost:5173";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

export default defineConfig({
  testDir: "./design/specs",
  snapshotDir: "./design/baselines",
  outputDir: "./design/screenshots/test-runs",

  // A visual baseline that passes only on the machine that made it is not a
  // baseline. Keep the diff tolerance tight enough to catch a layout change and
  // loose enough to survive font antialiasing.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["html", { outputFolder: "design/qa-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Deterministic captures: no OS locale or timezone drift between machines.
    locale: "en-US",
    timezoneId: "Asia/Manila",
  },

  /*
   * Two widths, always. 380px is a hard requirement in the definition of done,
   * not a nice-to-have, and it is where these layouts are least tested.
   * 380x844 is the narrow end of a real mid-range Android, which is the actual
   * audience (GAME-LAYER.md §2, MASTER-PLAN.md §13).
   */
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-380",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 380, height: 844 },
        isMobile: false, // keep Chromium desktop engine; only the box is narrow
      },
    },
  ],

  /*
   * Servers are NOT started here on purpose. The stack needs Postgres in Docker
   * and the API running with a real EXAM_SALT_SECRET before either app is
   * useful, and a webServer block that silently half-boots that is worse than
   * no block at all. `DESIGN-REVIEW-01.md` "How to reproduce this setup" is the
   * launch sequence; point OCTA_WEB_URL / OCTA_CONSOLE_URL at it, or at the
   * deployed Vercel apps.
   */
  webServer: undefined,

  metadata: { qaMode: QA_MODE, web: WEB_URL, console: CONSOLE_URL },
});

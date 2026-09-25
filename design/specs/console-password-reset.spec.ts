import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * `/forgot-password` and `/reset-password` — the console's self-service
 * password reset. Approved by the instructor 25 Sep 2026; before it, the only
 * recovery was the Supabase dashboard or re-running `bootstrap-admin.mjs`.
 *
 * `design/templates/console/forgot-password/SPEC.md` and
 * `design/templates/console/reset-password/SPEC.md` own the decisions.
 *
 * ## What a local stack can and cannot show
 *
 * The local console is built without `VITE_SUPABASE_URL`, so no email is ever
 * sent and no recovery session ever exists. Every request here therefore ends
 * in the "built without its Supabase settings" fault -- a real failure through
 * the real code path, which is what these specs drive. The success paths
 * ("a link is on its way", "password changed") are not reachable locally;
 * their wording is unit-tested in `apps/console/test/console.spec.ts`, and they
 * must be seen on the deployment before anyone calls them verified.
 *
 * The recovery FORM is reachable locally, because the page decides to show it
 * from the link itself (`#...type=recovery`), and a bogus link is refused at
 * submit, not at render. That is what `RECOVERY` below is.
 */

const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

/** What Supabase appends to the redirect of a recovery email. The token is fake. */
const RECOVERY = "#access_token=not-a-real-token&refresh_token=x&expires_in=3600&token_type=bearer&type=recovery";
/** What Supabase appends when the link was already used or has expired. */
const EXPIRED =
  "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

async function anonymous(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.removeItem("octa:dev-token"));
}

async function openForgot(page: Page): Promise<void> {
  await anonymous(page);
  await page.goto(`${CONSOLE_URL}/forgot-password`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15_000 });
}

async function openReset(page: Page, hash = ""): Promise<void> {
  await anonymous(page);
  /*
   * A REAL load, every time. From /reset-password, going to
   * /reset-password#... changes only the hash, which is a same-document
   * navigation: nothing reloads and the page never re-reads its link. A link
   * opened from an email is always a fresh load, so that is what this does.
   */
  await page.goto("about:blank");
  await page.goto(`${CONSOLE_URL}/reset-password${hash}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15_000 });
}

async function failRequest(page: Page): Promise<void> {
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByRole("button", { name: /send reset link/i }).click();
  await page.getByRole("alert").filter({ hasText: /\S/ }).first().waitFor({ timeout: 10_000 });
}

async function withHints(page: Page): Promise<void> {
  await page.getByLabel("New password", { exact: true }).fill("tooshort");
  await page.getByLabel("Confirm new password").fill("different");
  await page.getByText(/do not match/i).waitFor();
}

/* ======================================================================
 * /forgot-password
 * ==================================================================== */

test.describe("/forgot-password — SPEC.md", () => {
  test("reached from /signin and back again, from the keyboard", async ({ page }) => {
    await anonymous(page);
    await page.goto(`${CONSOLE_URL}/signin`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /forgot your password/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/reset your password/i);

    await page.getByRole("link", { name: /back to sign in/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signin$/);
  });

  test("a request that could not be sent says so, and it stays", async ({ page }) => {
    await openForgot(page);
    await failRequest(page);
    const alert = page.getByRole("alert").filter({ hasText: /\S/ }).first();
    await expect(alert).toContainText(/cannot|not sent|too many|not an email/i);
    await page.waitForTimeout(3_000);
    await expect(alert, "the failure vanished on a timer").toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("nobody@example.com");
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeEnabled();
  });

  test("no sign-up, and no claim about whether an account exists", async ({ page }) => {
    await openForgot(page);
    await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);
    // The page's promise is conditional on purpose: anything else is an oracle.
    await expect(page.locator("main")).toContainText(/if an account/i);
  });
});

/* ======================================================================
 * /reset-password
 * ==================================================================== */

test.describe("/reset-password — SPEC.md", () => {
  test("with no link: says so, offers a new one, and shows no password form", async ({ page }) => {
    await openReset(page);
    await expect(page.locator("main")).toContainText(/no reset link/i);
    await expect(page.getByRole("link", { name: /send a new link/i })).toHaveAttribute("href", "/forgot-password");
    await expect(page.locator("main input[type=password]")).toHaveCount(0);
  });

  test("an expired or used link says that, and offers a new one", async ({ page }) => {
    await openReset(page, EXPIRED);
    await expect(page.locator("main")).toContainText(/expired or was already used/i);
    await expect(page.getByRole("link", { name: /send a new link/i })).toBeVisible();
    await expect(page.locator("main input[type=password]")).toHaveCount(0);
  });

  test("a recovery link opens the new-password form, held to the credential screen's rules", async ({ page }) => {
    await openReset(page, RECOVERY);
    const submit = page.getByRole("button", { name: /set new password/i });
    await expect(submit).toBeDisabled();
    await page.getByLabel("New password", { exact: true }).fill("tooshort");
    await expect(submit, "a short password must not be accepted").toBeDisabled();
    await page.getByLabel("New password", { exact: true }).fill("a-much-longer-password-1");
    await page.getByLabel("Confirm new password").fill("a-different-password-1");
    await expect(page.getByText(/do not match/i)).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
    await expect(submit).toBeEnabled();

    // The link is taken off the address bar, so it is not left in history.
    expect(new URL(page.url()).hash, "the recovery token stayed in the URL").toBe("");
  });

  test("a change that fails says so, and it stays", async ({ page }) => {
    await openReset(page, RECOVERY);
    await page.getByLabel("New password", { exact: true }).fill("a-much-longer-password-1");
    await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
    await page.getByRole("button", { name: /set new password/i }).click();
    const alert = page.getByRole("alert").filter({ hasText: /\S/ }).first();
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000);
    await expect(alert, "the failure vanished on a timer").toBeVisible();
  });
});

/* ======================================================================
 * THE SIX-ASSERTION GATE — `CONSOLE-REVAMP.md` §2, at 1440 AND 380, on both
 * pages and every state a person can be looking at.
 * ==================================================================== */

type Screen = [string, (page: Page) => Promise<void>];
const SCREENS: Screen[] = [
  ["forgot", openForgot],
  ["forgot, failed", async (p) => { await openForgot(p); await failRequest(p); }],
  ["reset, no link", (p) => openReset(p)],
  ["reset, expired", (p) => openReset(p, EXPIRED)],
  ["reset, recovery form", async (p) => { await openReset(p, RECOVERY); await withHints(p); }],
];

test.describe("the gate — CONSOLE-REVAMP.md §2, password reset", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await clippedElements(page), name).toEqual([]);
    }
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await horizontalOverflow(page), name).toBeLessThanOrEqual(0);
    }
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openForgot(page);
    await page.getByLabel("Email").fill("someone@example.com");
    expect(await unreachableByKeyboard(page, "main"), "forgot").toEqual([]);
    await openReset(page, EXPIRED);
    expect(await unreachableByKeyboard(page, "main"), "reset, expired").toEqual([]);
    await openReset(page, RECOVERY);
    await page.getByLabel("New password", { exact: true }).fill("a-much-longer-password-1");
    await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
    expect(await unreachableByKeyboard(page, "main"), "reset, recovery form").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(120_000);
    const failures: string[] = [];
    for (const [name, open] of SCREENS) {
      await open(page);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} ${name}: ${f}`));
      }
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await offTokenStyles(page), name).toEqual([]);
    }
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // Positive control: the POST readout counts up here as on /signin.
    await recordMotion(page);
    await openForgot(page);
    await page.waitForTimeout(1_200);
    const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("main") && m.ms >= 100);
    expect(moving.length, "with motion allowed, the readout should count up").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openForgot(page);
    await failRequest(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "forgot").toEqual([]);

    await openReset(page, RECOVERY);
    await withHints(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "reset").toEqual([]);
  });

  test("no text sits on a bus trace", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      const hits = await page.evaluate(() => {
        const traceEls = [...document.querySelectorAll(".octa-trace")];
        const covered = (el: Element) => {
          for (let a: Element | null = el; a && a.tagName !== "MAIN"; a = a.parentElement) {
            if (traceEls.some((t) => a!.contains(t))) return false;
            const bg = getComputedStyle(a).backgroundColor;
            if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return true;
          }
          return false;
        };
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("main *")) {
          const text = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
          if (!text || covered(el)) continue;
          const r = el.getBoundingClientRect();
          for (const t of traceEls.map((x) => x.getBoundingClientRect())) {
            if (t.width > 0 && t.bottom >= r.top && t.top <= r.bottom && t.right >= r.left && t.left <= r.right) {
              out.push(`"${(el.textContent ?? "").trim().slice(0, 40)}"`);
            }
          }
        }
        return out;
      });
      expect(hits, name).toEqual([]);
    }
  });
});

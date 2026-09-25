import type { Page } from "@playwright/test";

/**
 * The six-assertion gate from `docs/redesign/CONSOLE-REVAMP.md` §2, as
 * functions, so every route's spec asserts the SAME thing in the same words.
 *
 * Not a spec: the leading underscore and the missing `.spec` keep Playwright
 * from collecting it. Written for `/items`, the first route through the gate;
 * every console route after it imports these rather than re-deriving them.
 *
 * Each function returns a list of offenders rather than a boolean, so a red
 * run names the element instead of saying "false". An empty list is a pass.
 *
 * Every check runs IN THE PAGE, on computed styles and layout boxes, because
 * the claim is about what rendered -- not about the source, which `pnpm lint`
 * and the palette scanner already cover.
 */

/** Where a route's content lives: the page, and any dialog open over it. */
export const SURFACES = "main, [role=dialog], [role=alertdialog]";

/* ------------------------------------------------------------------ 1 */

/**
 * Nothing is clipped: no visible text or control extends past the edge of the
 * viewport, or past the box of any ancestor that clips it.
 *
 * A HORIZONTAL scroller counts as clipping. That is the defect this gate was
 * written for: `/items` shipped its action column past the right edge of a
 * horizontally scrolling table, and "you can scroll to it" is not "it is
 * visible" -- nobody scrolls sideways to find a column they do not know
 * exists. A VERTICAL scroller (a tall dialog) does not count; vertical scroll
 * is how a page is read.
 *
 * Deliberate truncation is exempt: an element with `text-overflow: ellipsis`
 * or a line clamp is saying "there is more", which is the opposite of hiding
 * it. The route owes the full text somewhere else, and its own spec says where.
 */
export async function clippedElements(page: Page, scope = SURFACES): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    const roots = [...document.querySelectorAll<HTMLElement>(sel)];
    /*
     * Inside a screen-reader-only box: a 1px, clipped ancestor. Its content is
     * invisible ON PURPOSE -- it is there for assistive technology -- so it can
     * be neither clipped by accident, nor too faint, nor off-palette.
     */
    const srOnly = (el: Element) => {
      for (let a: Element | null = el; a; a = a.parentElement) {
        const b = a.getBoundingClientRect();
        if (b.width <= 1 && b.height <= 1) {
          const c = getComputedStyle(a);
          if (c.overflow !== "visible" || c.clip !== "auto" || c.clipPath !== "none") return true;
        }
      }
      return false;
    };

    const deliberate = (cs: CSSStyleDeclaration) =>
      cs.textOverflow === "ellipsis" ||
      (cs.getPropertyValue("-webkit-line-clamp") || "none") !== "none";

    const label = (el: Element) => {
      const t = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
      return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> "${t}"`;
    };

    for (const root of roots) {
      for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
        if (el instanceof SVGElement) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue; // sr-only and collapsed
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (srOnly(el)) continue;

        const isControl = el.matches("button, a[href], input, select, textarea, [role=button]");
        const hasText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "",
        );
        if (!isControl && !hasText) continue;

        // Its own content overflowing it, with nothing saying so.
        if (
          (cs.overflowX === "hidden" || cs.overflowX === "clip") &&
          !deliberate(cs) &&
          el.scrollWidth > el.clientWidth + 1
        ) {
          out.push(`${label(el)} overflows itself by ${el.scrollWidth - el.clientWidth}px`);
        }

        // The viewport.
        if (r.left < -1 || r.right > vw + 1) {
          out.push(`${label(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} in a ${vw}px viewport`);
          continue;
        }

        // Every clipping ancestor.
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const acs = getComputedStyle(a);
          if (deliberate(acs)) break;
          const clipsX = acs.overflowX !== "visible";
          const clipsY = acs.overflowY === "hidden" || acs.overflowY === "clip";
          if (!clipsX && !clipsY) continue;
          const b = a.getBoundingClientRect();
          const left = b.left + a.clientLeft;
          const right = left + a.clientWidth;
          const top = b.top + a.clientTop;
          const bottom = top + a.clientHeight;
          if (clipsX && (r.left < left - 1 || r.right > right + 1)) {
            out.push(`${label(el)} right=${Math.round(r.right)} escapes ${label(a).slice(0, 40)} right=${Math.round(right)}`);
            break;
          }
          if (clipsY && (r.top < top - 1 || r.bottom > bottom + 1)) {
            out.push(`${label(el)} is cut off vertically by ${label(a).slice(0, 40)}`);
            break;
          }
        }
      }
    }
    return [...new Set(out)];
  }, scope);
}

/* ------------------------------------------------------------------ 2 */

/** `body.scrollWidth <= clientWidth`, measured on the document. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/* ------------------------------------------------------------------ 3 */

/**
 * Every visible, enabled control in `scope` receives focus from the Tab key.
 *
 * Tabs from the top of the document, counting what gets focus, and returns the
 * controls that never did. Walking the real Tab order is the claim; checking
 * `tabIndex >= 0` would only prove the attribute.
 */
export async function unreachableByKeyboard(page: Page, scope = "main"): Promise<string[]> {
  const total = await page.evaluate((sel) => {
    const q =
      "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), " +
      "select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    let n = 0;
    document.querySelectorAll("[data-kb]").forEach((e) => e.removeAttribute("data-kb"));
    for (const root of document.querySelectorAll(sel)) {
      for (const el of root.querySelectorAll<HTMLElement>(q)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") continue;
        el.setAttribute("data-kb", String(n++));
      }
    }
    (document.activeElement as HTMLElement | null)?.blur?.();
    return n;
  }, scope);

  const seen = new Set<string>();
  for (let i = 0; i < total * 2 + 25 && seen.size < total; i++) {
    await page.keyboard.press("Tab");
    const k = await page.evaluate(() => document.activeElement?.getAttribute("data-kb") ?? null);
    if (k !== null) seen.add(k);
  }

  return page.evaluate((got) => {
    const missed: string[] = [];
    document.querySelectorAll<HTMLElement>("[data-kb]").forEach((el) => {
      if (!got.includes(el.getAttribute("data-kb")!)) {
        missed.push(
          `<${el.tagName.toLowerCase()}> "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`,
        );
      }
    });
    return missed;
  }, [...seen]);
}


/**
 * Wait for every running CSS TRANSITION to finish, so colours are measured on
 * a settled frame. A click leaves the hovered row and button mid-fade for
 * 160ms, and a colour caught halfway is an interpolation, not a token -- which
 * is a fact about timing, not about the palette. Infinite ambient animations
 * (the backdrop) are CSS animations, not transitions, and are not waited on.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a instanceof CSSTransition)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/* ------------------------------------------------------------------ 4 */

export const THEMES = ["bare-metal", "blueprint", "phosphor"] as const;

/**
 * WCAG 2.2 AA, computed: 4.5:1 for body text, 3:1 for large text, for every
 * visible text node in `scope`, against the background it actually sits on.
 *
 * Colours are resolved through a 1x1 canvas rather than parsed, because the
 * tokens are OKLCH and a computed style hands back `oklch(...)`; the canvas
 * does the colour-space conversion AND the alpha compositing the browser would
 * do, so a translucent badge background is measured as it is painted.
 *
 * Disabled controls are exempt, as WCAG exempts inactive components.
 */
export async function contrastFailures(page: Page, scope = SURFACES): Promise<string[]> {
  await settle(page);
  return page.evaluate((sel) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;

    const paint = (layers: string[]): [number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      for (const c of layers) {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
      }
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!];
    };
    const alpha = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
    };
    const lum = ([r, g, b]: [number, number, number]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    /** Background layers from the element down to the first opaque one. */
    const backgroundOf = (el: Element): string[] => {
      const layers: string[] = [];
      for (let a: Element | null = el; a; a = a.parentElement) {
        const bg = getComputedStyle(a).backgroundColor;
        if (alpha(bg) > 0) {
          layers.unshift(bg);
          if (alpha(bg) >= 0.999) return layers;
        }
      }
      layers.unshift(getComputedStyle(document.body).backgroundColor);
      return layers;
    };

    /*
     * Inside a screen-reader-only box: a 1px, clipped ancestor. Its content is
     * invisible ON PURPOSE -- it is there for assistive technology -- so it can
     * be neither clipped by accident, nor too faint, nor off-palette.
     */
    const srOnly = (el: Element) => {
      for (let a: Element | null = el; a; a = a.parentElement) {
        const b = a.getBoundingClientRect();
        if (b.width <= 1 && b.height <= 1) {
          const c = getComputedStyle(a);
          if (c.overflow !== "visible" || c.clip !== "auto" || c.clipPath !== "none") return true;
        }
      }
      return false;
    };
    const out: string[] = [];
    for (const root of document.querySelectorAll(sel)) {
      for (const el of root.querySelectorAll<HTMLElement>("*")) {
        if (el instanceof SVGElement) continue;
        if (srOnly(el)) continue;
        const hasText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "",
        );
        if (!hasText) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
        if (el.closest("[disabled], [aria-disabled=true]")) continue;

        const bgLayers = backgroundOf(el);
        const bg = paint(bgLayers);
        const fg = paint([...bgLayers, cs.color]);
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a) as [number, number];
        const ratio = (hi + 0.05) / (lo + 0.05);

        const px = parseFloat(cs.fontSize);
        const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < need - 0.005) {
          const t = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 36);
          out.push(`${ratio.toFixed(2)}:1 < ${need}  <${el.tagName.toLowerCase()}> "${t}"`);
        }
      }
    }
    return [...new Set(out)];
  }, scope);
}

/** Switch theme the way the console's own theme picker does, and let it settle. */
export async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
  // `transition-colors` on controls would otherwise be measured mid-fade.
  await page.waitForTimeout(400);
}

/* ------------------------------------------------------------------ 5 */

/**
 * The token system is what rendered: every colour on every visible element in
 * `scope` is one of `packages/tokens`' values for the current theme, every
 * font is one of the three type roles, and nothing carries a Tailwind palette
 * utility or an inline literal colour.
 *
 * The token values are read back through probe elements, so both sides of the
 * comparison went through the same computed-style serialization.
 */
export async function offTokenStyles(page: Page, scope = SURFACES): Promise<string[]> {
  await settle(page);
  return page.evaluate((sel) => {
    const COLOR_TOKENS = [
      "surface-0", "surface-1", "surface-2", "surface-3",
      "ink", "ink-muted", "ink-faint", "line", "line-strong",
      "accent", "accent-hover", "accent-muted", "accent-fg", "accent-ring",
      "success", "success-bg", "danger", "danger-bg", "warning", "warning-bg",
      "info", "info-bg", "locked", "locked-bg",
    ];
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const colors = new Set<string>(["rgba(0, 0, 0, 0)"]);
    for (const t of COLOR_TOKENS) {
      probe.style.color = `var(--${t})`;
      colors.add(getComputedStyle(probe).color);
    }
    const fonts = new Set<string>();
    for (const t of ["font-body", "font-display", "font-mono"]) {
      probe.style.fontFamily = `var(--${t})`;
      fonts.add(getComputedStyle(probe).fontFamily);
    }
    probe.remove();

    const PALETTE =
      /(?:^|\s|:)(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|decoration|placeholder|caret|accent|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?(?=\s|$)/;
    const LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

    /*
     * Inside a screen-reader-only box: a 1px, clipped ancestor. Its content is
     * invisible ON PURPOSE -- it is there for assistive technology -- so it can
     * be neither clipped by accident, nor too faint, nor off-palette.
     */
    const srOnly = (el: Element) => {
      for (let a: Element | null = el; a; a = a.parentElement) {
        const b = a.getBoundingClientRect();
        if (b.width <= 1 && b.height <= 1) {
          const c = getComputedStyle(a);
          if (c.overflow !== "visible" || c.clip !== "auto" || c.clipPath !== "none") return true;
        }
      }
      return false;
    };
    const out: string[] = [];
    const tag = (el: Element) => {
      const t = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
      return `<${el.tagName.toLowerCase()}> "${t}"`;
    };

    for (const root of document.querySelectorAll(sel)) {
      for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
        if (el instanceof SVGElement) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || srOnly(el)) continue;
        const cls = typeof el.className === "string" ? el.className : "";
        if (PALETTE.test(cls)) out.push(`${tag(el)} uses a palette utility: ${cls.match(PALETTE)![0].trim()}`);
        if (LITERAL.test(el.getAttribute("style") ?? "")) out.push(`${tag(el)} has a literal colour inline`);

        const cs = getComputedStyle(el);
        if (!colors.has(cs.color)) out.push(`${tag(el)} color ${cs.color} is not a token`);
        if (!colors.has(cs.backgroundColor)) out.push(`${tag(el)} background ${cs.backgroundColor} is not a token`);
        for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
          if (parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0) {
            const c = cs.getPropertyValue(`border-${side.toLowerCase()}-color`);
            if (!colors.has(c)) out.push(`${tag(el)} border-${side.toLowerCase()} ${c} is not a token`);
          }
        }
        const hasText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "",
        );
        if (hasText && !fonts.has(cs.fontFamily)) out.push(`${tag(el)} font ${cs.fontFamily} is not a type role`);
      }
    }
    return [...new Set(out)];
  }, scope);
}

/* ------------------------------------------------------------------ 6 */

/**
 * Record every animation and transition that STARTS on the route's surfaces.
 *
 * `getAnimations()` only sees what is running at the instant it is asked, and a
 * 160ms dialog entrance is over before a round trip to the page completes.
 * A capture-phase listener installed before the page loads sees all of them.
 * Call before `goto`; read with `recordedMotion`.
 */
export async function recordMotion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __motion: Array<{ kind: string; name: string; ms: number; on: string }> };
    w.__motion = [];
    const ms = (v: string) =>
      Math.max(0, ...v.split(",").map((s) => (s.trim().endsWith("ms") ? parseFloat(s) : parseFloat(s) * 1000)));
    const rec = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const on = t.closest("[role=dialog]")
        ? "dialog"
        : t.closest("[data-toaster]")
          ? "toast"
          : t.closest("main")
            ? "main"
            : null;
      if (!on) return;
      const cs = getComputedStyle(t);
      const anim = e.type === "animationstart";
      w.__motion.push({
        kind: e.type,
        name: anim ? (e as AnimationEvent).animationName : (e as TransitionEvent).propertyName,
        ms: ms(anim ? cs.animationDuration : cs.transitionDuration),
        on: `${on}:${t.getAttribute("role") ?? t.tagName.toLowerCase()}`,
      });
    };
    document.addEventListener("animationstart", rec, true);
    document.addEventListener("transitionrun", rec, true);
  });
}

export async function recordedMotion(
  page: Page,
): Promise<Array<{ kind: string; name: string; ms: number; on: string }>> {
  return page.evaluate(() => (window as unknown as { __motion: never[] }).__motion ?? []);
}

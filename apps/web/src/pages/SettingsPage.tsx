import { useState } from "react";
import { ACCENTS } from "@octa/tokens/accents";
import { setAccentHue, setTheme, type Theme } from "../lib/session";

/**
 * Settings.
 *
 * `DESIGN-MANDATE.md` §1: a control exists only if pressing it changes what the
 * student knows, can do, or can see. If it only changes a number, delete it.
 * Every control here changes what they can SEE, and two of them change what
 * they can READ:
 *
 *   Theme        Phosphor is high-contrast and genuinely useful for low vision,
 *                not a novelty skin.
 *   Accent       A HUE, never a hex. Lightness and chroma are fixed per theme in
 *                packages/tokens, which is what holds contrast constant across
 *                every choice -- a stored hex would let a student make their own
 *                progress UI unreadable.
 *   Motion       Reads the OS setting; stated here so a student knows why the
 *                map is still rather than thinking it is broken.
 *
 * There is no "sound" control yet because there is no sound. Shipping a slider
 * that moves a number nothing listens to is exactly what the mandate forbids.
 */

const THEMES: Array<{ id: Theme; name: string; blurb: string }> = [
  { id: "bare-metal", name: "Bare metal", blurb: "Dark, low glare. The default." },
  { id: "blueprint", name: "Blueprint", blurb: "Light, paper-like. Good in a bright room." },
  { id: "phosphor", name: "Phosphor", blurb: "High contrast, CRT green. Built for low vision." },
];

function readTheme(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "blueprint" || t === "phosphor" ? t : "bare-metal";
}

function readHue(): number {
  try {
    const h = Number(localStorage.getItem("octa:accent-hue"));
    return Number.isFinite(h) ? h : 45;
  } catch {
    return 45;
  }
}

export function SettingsPage(): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [hue, setHue] = useState<number>(readHue);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <section className="settings" aria-labelledby="settings-title">
      <p className="reader-eyebrow">Settings</p>
      <h1 id="settings-title">How this looks</h1>

      <h2>Theme</h2>
      <div className="settings-themes" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <label key={t.id} className={"settings-theme" + (theme === t.id ? " is-on" : "")}>
            <input
              type="radio"
              name="theme"
              value={t.id}
              checked={theme === t.id}
              onChange={() => {
                setTheme(t.id);
                setThemeState(t.id);
              }}
            />
            <span className="settings-theme-name">{t.name}</span>
            <span className="settings-theme-blurb">{t.blurb}</span>
          </label>
        ))}
      </div>

      <h2>Accent</h2>
      <p className="settings-note">
        Twelve hues, each checked against all three themes. Every one stays readable — that is
        why it is a list and not a colour wheel.
      </p>
      <div className="settings-accents" role="radiogroup" aria-label="Accent colour">
        {ACCENTS.map((a) => (
          <label
            key={a.id}
            className={"settings-accent" + (hue === a.hue ? " is-on" : "")}
            title={a.blurb}
          >
            <input
              type="radio"
              name="accent"
              value={a.hue}
              checked={hue === a.hue}
              onChange={() => {
                setAccentHue(a.hue);
                setHue(a.hue);
              }}
            />
            {/*
             * The swatch is decorative -- the NAME is the control. A student
             * who cannot distinguish two swatches can still pick by name, which
             * is WCAG 1.4.1 and the reason there are names at all.
             */}
            <span
              className="settings-swatch"
              aria-hidden="true"
              style={{ background: `oklch(0.72 0.15 ${a.hue})` }}
            />
            <span className="settings-accent-name">{a.name}</span>
          </label>
        ))}
      </div>

      <h2>Motion</h2>
      <p className="settings-note">
        {reduced ? (
          <>
            Your device asks for reduced motion, so every animation here is switched off. That is
            not a fault — the map and the boot sequence still work, they simply arrive finished.
          </>
        ) : (
          <>
            Animation is on. To turn it off, use your device&apos;s <em>reduce motion</em> setting —
            this app follows it, so you set it once and every app respects it.
          </>
        )}
      </p>
    </section>
  );
}

import { useEffect, useState } from "react";
import { ACCENTS } from "@octa/tokens/accents";
import { clearAccentChoice, hasChosen, setAccentHue } from "../lib/session";
import { toast } from "../lib/toast";
import { setShortcutsOn, useAllKeyHints, useShortcutsOn } from "../shell/keyHints";
import { useCosmetics } from "../solar-system/cosmetic-seed";

/**
 * `/app/settings`, remade in the star HUD's panels (WEB-REMAKE.md §8 row 9).
 *
 * `DESIGN-MANDATE.md` §1: a control exists only if pressing it changes what the
 * student knows, can do, or can see. Two controls survive:
 *
 *   Accent      A HUE, never a hex: twelve named presets, each checked for AA
 *               in the star set and all seven biomes. Choosing one repaints
 *               the HUD at once, which is the preview
 *   Shortcuts   The single-key shortcuts on or off (WCAG 2.1.4); every one is
 *               also a button
 *
 * No theme picker: ruling 2 removed the variants (one star HUD, a biome per
 * planet). Motion follows the device and is stated, not toggled. The callsign
 * is shown, read-only.
 */

/** The student's explicit pick, or null while the seed decides. */
function readChoice(): number | null {
  if (!hasChosen("accent-hue")) return null;
  try {
    const h = Number(localStorage.getItem("octa:accent-hue"));
    return Number.isFinite(h) ? h : null;
  } catch {
    return null;
  }
}

function useReduced(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [r, setR] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

export function SettingsPage(): JSX.Element {
  const shortcuts = useShortcutsOn();
  const hints = useAllKeyHints();
  const [hue, setHue] = useState<number | null>(readChoice);
  const reduced = useReduced();
  const { cosmetics } = useCosmetics();

  return (
    <section className="set" data-settings="" aria-labelledby="set-title">
      <header className="set-head">
        <h1 id="set-title" className="set-title">
          Settings
        </h1>
        <p className="set-sub">How the star system looks and answers you. Inside a planet, the planet decides.</p>
      </header>

      <div className="set-grid">
        <section className="hud-panel set-panel set-accent" aria-labelledby="set-accent-title">
          <h2 id="set-accent-title" className="hud-caption">
            Accent
          </h2>
          <div className="set-body">
            <p className="set-note">
              Your own colour: it marks where you are and what is yours, never a right or wrong answer. Each of the
              twelve, and your seeded hue, is checked in the star system and every biome.
            </p>
            <fieldset className="set-accents">
              <legend className="sr-only">Accent colour</legend>
              <label className="set-accent-opt" title="The hue your system was seeded with, from your student ID">
                <input
                  type="radio"
                  name="accent"
                  className="sr-only"
                  checked={hue === null}
                  onChange={() => {
                    clearAccentChoice(cosmetics.accentHue);
                    setHue(null);
                    toast.success("Accent set back to your seeded hue");
                  }}
                />
                <span className="set-swatch" data-swatch="" style={{ ["--swatch-hue" as string]: cosmetics.accentHue }} aria-hidden="true" />
                <span className="set-accent-name">Seeded</span>
              </label>
              {ACCENTS.map((a) => (
                <label key={a.id} className="set-accent-opt" title={a.blurb}>
                  <input
                    type="radio"
                    name="accent"
                    className="sr-only"
                    value={a.hue}
                    checked={hue === a.hue}
                    onChange={() => {
                      setAccentHue(a.hue);
                      setHue(a.hue);
                      toast.success(`Accent set to ${a.name}`);
                    }}
                  />
                  {/* The swatch is decorative; the NAME is the control (WCAG 1.4.1). */}
                  <span className="set-swatch" data-swatch="" style={{ ["--swatch-hue" as string]: a.hue }} aria-hidden="true" />
                  <span className="set-accent-name">{a.name}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </section>

        <section className="hud-panel set-panel" aria-labelledby="set-system-title">
          <h2 id="set-system-title" className="hud-caption">
            Your system
          </h2>
          <div className="set-body">
            {cosmetics.callsign ? (
              <p className="set-callsign mono" data-callsign="">
                {cosmetics.callsign}
              </p>
            ) : (
              <p className="set-note">Your system&apos;s registry name is still loading.</p>
            )}
            <p className="set-note">
              Your system&apos;s registry name, derived from your student ID, so it is yours and does not change. A name
              only: nothing is graded on it and nothing looks you up by it.
            </p>
          </div>
        </section>

        <section className="hud-panel set-panel" aria-labelledby="set-keys-title">
          <h2 id="set-keys-title" className="hud-caption">
            Keyboard
          </h2>
          <div className="set-body">
            <label className="set-switch">
              <input
                type="checkbox"
                className="sr-only"
                role="switch"
                checked={shortcuts}
                onChange={(e) => {
                  setShortcutsOn(e.target.checked);
                  toast.success(e.target.checked ? "Single-key shortcuts on" : "Single-key shortcuts off");
                }}
              />
              <span className="set-switch-track" aria-hidden="true" />
              <span className="set-switch-name">Single-key shortcuts</span>
              <span className="set-switch-state">{shortcuts ? "On" : "Off"}</span>
            </label>
            <p className="set-note">
              Turn them off if they get in the way of a screen reader or a switch device. Every shortcut is also a button.
            </p>
            {hints.length > 0 && (
              <ul className="set-keys" aria-label="Shortcuts on this page">
                {hints.map((h) => (
                  <li key={h.key}>
                    <span className="keyhint-cap">{h.cap}</span>
                    <span>{h.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="hud-panel set-panel" aria-labelledby="set-motion-title">
          <h2 id="set-motion-title" className="hud-caption">
            Motion
          </h2>
          <div className="set-body">
            <p className="set-state" data-motion={reduced ? "reduced" : "on"}>
              {reduced ? "Reduced: your device asks for it" : "On"}
            </p>
            <p className="set-note">
              {reduced
                ? "Every animation is switched off: the map and the warps arrive finished. That is not a fault."
                : "To turn animation off, use your device's reduce-motion setting. This app follows it, so you set it once."}
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

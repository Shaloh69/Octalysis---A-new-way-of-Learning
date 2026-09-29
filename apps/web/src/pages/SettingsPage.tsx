import { useState } from "react";
import { ACCENTS } from "@octa/tokens/accents";
import { setAccentHue } from "../lib/session";
import { setShortcutsOn, useShortcutsOn } from "../shell/keyHints";
import { useCosmetics } from "../solar-system/cosmetic-seed";

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

function readHue(): number {
  try {
    const h = Number(localStorage.getItem("octa:accent-hue"));
    return Number.isFinite(h) ? h : 45;
  } catch {
    return 45;
  }
}

export function SettingsPage(): JSX.Element {
  const shortcuts = useShortcutsOn();
  const [hue, setHue] = useState<number>(readHue);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Read-only: the callsign is seeded server-side from student_id and is not
  // something the student can change. Nothing here writes it back.
  const { cosmetics } = useCosmetics();

  return (
    <section className="settings" aria-labelledby="settings-title">
      <p className="reader-eyebrow">Settings</p>
      <h1 id="settings-title">How this looks</h1>

      {/*
        The system callsign (SOLAR-SYSTEM-SPEC.md §3).

        Shown here and nowhere else, deliberately. It is a NAME, not an
        identifier: the spec is explicit that it must never be usable anywhere
        it could collide with a real one, which is why it is a word plus two hex
        characters and a student number is nine digits — the two namespaces
        cannot overlap.

        It is on the settings page rather than the map because it answers "what
        is mine" rather than "where am I", and because it is the one cosmetic a
        student might reasonably want to look up rather than just see.

        Mono, like every other machine-side value in this app.
      */}
      <h2>Your system</h2>
      {cosmetics.callsign ? (
        <p className="settings-callsign">
          <span className="mono">{cosmetics.callsign}</span>
          <span className="settings-note">
            {" "}
            — your system's registry name. Derived from your student ID, so it is
            yours and it does not change. It is a name only: nothing is graded on
            it and nothing looks you up by it.
          </span>
        </p>
      ) : (
        <p className="settings-note">Your system's registry name is still loading.</p>
      )}

      <h2>Accent</h2>
      <p className="settings-note">
        Your own colour: it marks where you are and what is yours, never a state. Twelve hues,
        each checked in the star system and every biome, so every one stays readable.
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

      <h2>Keyboard shortcuts</h2>
      <p className="settings-note">
        Single keys such as M for the map and F to report a problem. Turn them off if they get in the way
        of a screen reader or a switch device; every shortcut is also a button.
      </p>
      <label className="settings-theme">
        <input type="checkbox" checked={shortcuts} onChange={(e) => setShortcutsOn(e.target.checked)} />
        <span className="settings-theme-name">Single-key shortcuts</span>
        <span className="settings-theme-blurb">{shortcuts ? "On" : "Off"}</span>
      </label>

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

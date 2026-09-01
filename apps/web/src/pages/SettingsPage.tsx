import { useState } from "react";
import { ACCENTS } from "@octa/tokens/accents";
import { setAccentHue, setTheme, type Theme } from "../lib/session";
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

  // The map override. Read once; the map picks it up on the next render because
  // `SolarBackdrop` re-reads localStorage through its own ladder check.
  const [mapMode, setMapMode] = useState<"2d" | "3d">(() => {
    try {
      return localStorage.getItem("octa:map-mode") === "2d" ? "2d" : "3d";
    } catch {
      return "3d";
    }
  });

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

      {/*
        The map's manual override -- `VISUAL-SYSTEM-3D.md` §5's last line, and
        the last rung of its ladder that had never been built.
        
        Rungs 1-5 all decide FOR the student: reduced motion, small viewport,
        absent WebGL, a measured sub-30fps run, Save-Data. Every one of them is
        the app choosing. This is the student choosing, and §5 requires it to
        exist for exactly that reason: an automatic ladder with no manual escape
        hatch is a system that has decided it knows better.
        
        Two options, not three. §5 says "Full / Reduced / Off", but Reduced and
        Off are the same thing here — there is one 3D surface, and it is either
        drawn or it is not. A third setting that did nothing different would
        fail the mandate's consequence test.
      */}
      <h2>The map</h2>
      <p className="settings-note">
        The solar system is the background across the app. Turning it off gives
        you the flat map everywhere instead — the same 19 stages, the same lock
        reasons, no animation. Nothing about what you can do changes either way.
      </p>
      <div className="settings-themes" role="radiogroup" aria-label="Map rendering">
        {(
          [
            ["3d", "Solar system", "The default, where your device can hold it."],
            ["2d", "Flat map only", "Text and shapes. Lighter on battery."],
          ] as const
        ).map(([value, name, blurb]) => (
          <label
            key={value}
            className={"settings-theme" + (mapMode === value ? " is-on" : "")}
          >
            <input
              type="radio"
              name="map-mode"
              value={value}
              checked={mapMode === value}
              onChange={() => {
                setMapMode(value);
                try {
                  localStorage.setItem("octa:map-mode", value);
                  // Choosing the solar system also clears a remembered
                  // too-slow verdict: the student is overruling the guard,
                  // which is what an override is for. It will simply measure
                  // again and can fire again if the device really cannot cope.
                  if (value === "3d") localStorage.removeItem("octa:map-too-slow");
                } catch {
                  /* private window; the preference just does not persist */
                }
              }}
            />
            <span className="settings-theme-name">{name}</span>
            <span className="settings-theme-blurb">{blurb}</span>
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

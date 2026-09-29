import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Session and appearance.
 *
 * The anon key is safe in the bundle ONLY because RLS is correct -- that is the
 * whole bet, and it is why services/api/test/rls.spec.ts exists. The service
 * role key is never here and never will be.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  client ??= createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const c = supabase();
  if (!c) return localStorage.getItem("octa:dev-token");
  const { data } = await c.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * The accent. apps/web has no theme choice since 30 Sep 2026 (WEB-REMAKE.md
 * §0.1): the look changes only between the star system and a planet's biome,
 * and `data-theme` is never set here (the console keeps its three themes).
 *
 * The accent is a HUE (0-359), never a hex. Lightness and chroma are fixed per
 * colour set in packages/tokens/looks.css, which is what holds contrast constant
 * across every hue a student can land on or pick.
 */

/**
 * Paint the accent the student last chose, before first render. It must not
 * WRITE anything: absence of the key is the signal that the seed is still free
 * to act, and only the Settings page writes it.
 */
export function applyStoredAccent(): void {
  try {
    const rawHue = localStorage.getItem("octa:accent-hue");
    if (rawHue !== null) {
      const hue = Number(rawHue);
      if (Number.isFinite(hue)) {
        document.documentElement.style.setProperty(
          "--accent-hue",
          String(Math.max(0, Math.min(359, Math.round(hue)))),
        );
      }
    }
  } catch {
    /* private window: the seeded accent applies */
  }
}

/** Has the student chosen their accent? Absence lets the seed act. */
export function hasChosen(part: "accent-hue"): boolean {
  try {
    return localStorage.getItem(`octa:${part}`) !== null;
  } catch {
    return false;
  }
}

export function setAccentHue(hue: number): void {
  const clamped = Math.max(0, Math.min(359, Math.round(hue)));
  document.documentElement.style.setProperty("--accent-hue", String(clamped));
  try {
    localStorage.setItem("octa:accent-hue", String(clamped));
  } catch { /* not persistable here */ }
}

/** Back to the seeded accent: forget the choice and paint the seed's hue. */
export function clearAccentChoice(seededHue: number): void {
  try {
    localStorage.removeItem("octa:accent-hue");
  } catch { /* nothing was stored */ }
  document.documentElement.style.setProperty("--accent-hue", String(seededHue));
}

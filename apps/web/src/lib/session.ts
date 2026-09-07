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
 * Theme and accent.
 *
 * The accent is a HUE (0-359), never a hex. Lightness and chroma are fixed per
 * theme in packages/tokens, which is what holds contrast constant across every
 * hue a student can pick -- a stored hex would let them make their own progress
 * UI unreadable.
 */
export type Theme = "bare-metal" | "blueprint" | "phosphor";

/**
 * Paint whatever the student last chose, before first render.
 *
 * **It must not WRITE anything**, and that is not a detail. It used to call
 * `setTheme`/`setAccentHue`, both of which persist — so on a student's very
 * first load it stored `bare-metal` and `250` and every later reader could no
 * longer tell "they chose the default" from "they have never chosen".
 *
 * That is what defeated the first attempt at F-40: the seeded look correctly
 * declined to overwrite a stored choice, and the stored choice was one this
 * function had invented microseconds earlier. Three students still rendered
 * identically and the fix looked broken.
 *
 * So the defaults are applied in memory and left unstored. Absence of the key
 * is the signal that the seed is still free to act; only `SettingsPage` writes.
 */
export function applyStoredTheme(): void {
  try {
    const stored = localStorage.getItem("octa:theme") as Theme | null;
    const rawHue = localStorage.getItem("octa:accent-hue");
    if (stored) document.documentElement.setAttribute("data-theme", stored);
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
    /* private window: fall through to the defaults already in the stylesheet */
  }
}

/**
 * Has the student chosen this part of their look? Absence lets the seed act.
 *
 * Theme and hue are asked SEPARATELY, and that is not pedantry. A single
 * "have they chosen anything" flag meant picking a theme also froze the accent
 * at the stylesheet default of 250 — so a student who changed one thing
 * silently lost the seeded value of the other, which is the same
 * everyone-looks-identical bug F-40 fixed, reintroduced in miniature.
 */
export function hasChosen(part: "theme" | "accent-hue"): boolean {
  try {
    return localStorage.getItem(`octa:${part}`) !== null;
  } catch {
    // Private window: no choice can have been stored, so the seed applies.
    return false;
  }
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("octa:theme", theme);
  } catch { /* not persistable here */ }
}

export function setAccentHue(hue: number): void {
  const clamped = Math.max(0, Math.min(359, Math.round(hue)));
  document.documentElement.style.setProperty("--accent-hue", String(clamped));
  try {
    localStorage.setItem("octa:accent-hue", String(clamped));
  } catch { /* not persistable here */ }
}

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

export function applyStoredTheme(): void {
  try {
    const theme = (localStorage.getItem("octa:theme") as Theme | null) ?? "bare-metal";
    const hue = Number(localStorage.getItem("octa:accent-hue") ?? "250");
    setTheme(theme);
    setAccentHue(Number.isFinite(hue) ? hue : 250);
  } catch {
    /* private window: fall through to the defaults already in the stylesheet */
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

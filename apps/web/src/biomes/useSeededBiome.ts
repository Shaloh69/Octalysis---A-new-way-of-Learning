import { useEffect, useState } from "react";

/**
 * The student's seeded biome name, read from `<html data-biome>`.
 *
 * `AppShell` calls `useCosmetics`, which fetches once and sets the attribute
 * for every authenticated route. Reading it back here means the stage reader
 * does not fetch a second time, and — more usefully — that a landing has one
 * source of truth for which biome it is, the same element that already carries
 * `data-theme` and `--accent-hue`.
 *
 * Returns null until the fetch lands, which is also the "no biome" state: the
 * scene renders nothing rather than a placeholder.
 */
export function useSeededBiome(): string | null {
  const read = (): string | null =>
    typeof document === "undefined"
      ? null
      : document.documentElement.getAttribute("data-biome");

  const [biome, setBiome] = useState<string | null>(read);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    // The attribute is set asynchronously, after the cosmetics fetch resolves,
    // so watch for it rather than sampling once and missing it.
    const observer = new MutationObserver(() => setBiome(read()));
    observer.observe(el, { attributes: true, attributeFilter: ["data-biome"] });
    setBiome(read());
    return () => observer.disconnect();
  }, []);

  return biome;
}

import { useLocation } from "react-router-dom";
import { realmFor } from "../lib/realm";

/**
 * A button's class, in its realm's dress (WEB-REMAKE.md §2-§3): a HUD button in
 * the star system, a Kenney sprite button inside a biome. One call, so no page
 * decides a realm for itself.
 *
 * NEVER on a check's paper: the paper is identical for every student
 * (`[data-paper]`), and a sprite button would give two biomes two papers. The
 * runner's paper uses `paper-button` directly.
 */
export function useButtonClass(): (variant?: "primary" | "plain") => string {
  const { pathname } = useLocation();
  const biome = realmFor(pathname).realm === "biome";
  return (variant = "plain") =>
    biome
      ? `button sprite-button${variant === "primary" ? " button-primary" : ""}`
      : `button hud-button${variant === "primary" ? " button-primary" : ""}`;
}

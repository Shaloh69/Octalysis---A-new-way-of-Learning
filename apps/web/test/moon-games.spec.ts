import { describe, it, expect } from "vitest";
import { MOON_GAMES } from "@octa/contracts";
import { MOON_ENCOUNTERS } from "../src/encounters/registry";

/**
 * The four minigames hang off moon ids in the web code (`encounters/registry.ts`).
 * The API reads the same ids and names from `@octa/contracts` so a retirement in the
 * Studio can say "this takes Two Columns off the map" (E2, 8 Oct 2026). If a game is
 * added or renamed on one side, this fails until the other follows.
 */
describe("moon games", () => {
  it("the web registry and the contract name the same moons and the same games", () => {
    expect(Object.keys(MOON_ENCOUNTERS).sort()).toEqual(Object.keys(MOON_GAMES).sort());
    for (const [id, game] of Object.entries(MOON_ENCOUNTERS)) {
      expect(game.name, `moon ${id}`).toBe(MOON_GAMES[id]);
    }
  });
});

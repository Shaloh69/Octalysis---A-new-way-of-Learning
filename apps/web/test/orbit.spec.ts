import { describe, it, expect } from "vitest";
import { angularSpeed, orbitAngle, periodSeconds, OUTER_PERIOD_S } from "../src/solar-system/orbit";

/**
 * WEB-REVAMP.md §4: orbital motion follows Kepler's third law, T² ∝ a³, so
 * ω ∝ a^-1.5. Orbits stay circular, so a planet's radius still means its level.
 */
describe("orbits follow Kepler's third law", () => {
  it("ω ∝ a^-1.5: a ring four times farther turns eight times slower", () => {
    expect(angularSpeed(4, 20) / angularSpeed(16, 20)).toBeCloseTo(8, 10);
  });

  it("T² ∝ a³ across every pair of radii", () => {
    const radii = [4, 5.2, 7.9, 11.3, 16, 20];
    for (const a of radii) {
      for (const b of radii) {
        const lhs = (periodSeconds(a, 20) / periodSeconds(b, 20)) ** 2;
        const rhs = (a / b) ** 3;
        expect(lhs).toBeCloseTo(rhs, 8);
      }
    }
  });

  it("the outermost ring takes OUTER_PERIOD_S for one orbit: slow, never busy", () => {
    expect(periodSeconds(20, 20)).toBeCloseTo(OUTER_PERIOD_S, 8);
    expect(OUTER_PERIOD_S).toBeGreaterThanOrEqual(300);
  });

  it("at t = 0 every planet is where the layout put it (curriculum order)", () => {
    expect(orbitAngle(1.234, 7, 20, 0)).toBe(1.234);
  });

  it("moves the right way and wraps", () => {
    const a = orbitAngle(0, 20, 20, OUTER_PERIOD_S / 4);
    expect(a).toBeCloseTo(Math.PI / 2, 8);
    const full = orbitAngle(0.5, 20, 20, OUTER_PERIOD_S);
    expect(full).toBeCloseTo(0.5, 8);
  });

  it("planets on the same ring keep their spacing for ever", () => {
    for (const t of [0, 13, 500, 10_000]) {
      const d = orbitAngle(1, 9, 20, t) - orbitAngle(0.4, 9, 20, t);
      expect(((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(0.6, 8);
    }
  });
});

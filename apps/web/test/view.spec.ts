import { describe, it, expect } from "vitest";
import {
  HOME,
  IDLE_RESET_MS,
  TILT_MAX,
  TILT_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  clampPan,
  isHome,
  pinchFactor,
  tiltBy,
  wheelFactor,
  zoomToward,
} from "../src/map/view";

/**
 * The student's own view of the map (instructor, 5 Oct 2026): zoom, tilt, pan,
 * and home again after thirty seconds of nothing.
 */

describe("the view's limits", () => {
  it("home is home", () => {
    expect(isHome(HOME)).toBe(true);
    expect(isHome({ ...HOME, zoom: 0.5 })).toBe(false);
  });

  it("zoom never passes its limits, however hard it is pushed", () => {
    let v = { ...HOME };
    for (let i = 0; i < 200; i++) v = zoomToward(v, 0.5, { x: 3, z: 4 }, { x: 0, z: 0 });
    expect(v.zoom).toBe(ZOOM_MIN);
    for (let i = 0; i < 200; i++) v = zoomToward(v, 2, { x: 3, z: 4 }, { x: 0, z: 0 });
    expect(v.zoom).toBe(ZOOM_MAX);
  });

  it("tilt stays between nearly edge-on and straight down", () => {
    expect(tiltBy(HOME, -10).tilt).toBe(TILT_MIN);
    expect(tiltBy(HOME, 10).tilt).toBe(TILT_MAX);
  });

  it("the pan keeps the sun within reach", () => {
    const v = clampPan({ ...HOME, panX: 300, panZ: 400 }, 50);
    expect(Math.hypot(v.panX, v.panZ)).toBeCloseTo(50, 9);
    expect(Math.atan2(v.panZ, v.panX)).toBeCloseTo(Math.atan2(400, 300), 9);
    expect(clampPan({ ...HOME, panX: 3 }, 50).panX).toBe(3);
  });

  it("goes home after thirty seconds, as the instructor asked", () => {
    expect(IDLE_RESET_MS).toBe(30_000);
  });
});

describe("zooming toward the pointer", () => {
  it("the point under the pointer stays put: the target moves (1 - f) of the way to it", () => {
    const v = zoomToward(HOME, 0.5, { x: 10, z: -6 }, { x: 0, z: 0 });
    expect(v.zoom).toBe(0.5);
    expect(v.panX).toBeCloseTo(5, 12);
    expect(v.panZ).toBeCloseTo(-3, 12);
  });

  it("zooming at the target itself only zooms", () => {
    const v = zoomToward(HOME, 0.7, { x: 2, z: 2 }, { x: 2, z: 2 });
    expect([v.panX, v.panZ]).toEqual([0, 0]);
  });

  it("a clamped zoom moves the pan only by the zoom that happened", () => {
    const near = { ...HOME, zoom: ZOOM_MIN };
    expect(zoomToward(near, 0.5, { x: 10, z: 0 }, { x: 0, z: 0 }).panX).toBe(0);
  });
});

describe("gestures as factors", () => {
  it("a wheel notch toward you zooms in, away zooms out, and they undo each other", () => {
    expect(wheelFactor(-100)).toBeLessThan(1);
    expect(wheelFactor(100)).toBeGreaterThan(1);
    expect(wheelFactor(-100) * wheelFactor(100)).toBeCloseTo(1, 12);
  });

  it("fingers apart zoom in; a degenerate pinch does nothing", () => {
    expect(pinchFactor(100, 200)).toBe(0.5);
    expect(pinchFactor(0, 200)).toBe(1);
  });
});

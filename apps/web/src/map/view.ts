/**
 * The student's own view of the map (instructor, 5 Oct 2026: "the students in
 * the map have the ability to zoom in manually and look around the solar
 * system", "the camera view will reset on its own after 30 seconds of not
 * doing anything", "make sure that works on the phone too").
 *
 * The camera's resting framing is the Rig's (it fits the system, or the chosen
 * planet, into the free area). This is what the student adds on top: a zoom
 * multiplier, a tilt from the resting pitch, and a pan across the plane. Drag
 * turns the system (the page's `yaw`, as before) and tilts it; the wheel and a
 * pinch zoom toward the pointer; a two-finger, right-button or Shift drag pans.
 * Thirty seconds without input, the view eases home.
 *
 * Pure, so the clamps and the zoom-toward-a-point rule are tested
 * (`test/view.spec.ts`); the Rig and the page only apply it.
 */

export interface View {
  /** Distance multiplier: below 1 is closer. */
  zoom: number;
  /** Radians added to the resting pitch: negative looks flatter across the plane. */
  tilt: number;
  /** World offset of the point the camera looks at, across the plane. */
  panX: number;
  panZ: number;
}

export const HOME: Readonly<View> = { zoom: 1, tilt: 0, panX: 0, panZ: 0 };

/** Closest a student can come, and furthest back: a planet fills the screen, the Oort cloud does not run away. */
export const ZOOM_MIN = 0.06;
export const ZOOM_MAX = 1.8;
/** From nearly edge-on to straight down, around the resting 58°. */
export const TILT_MIN = (-40 * Math.PI) / 180;
export const TILT_MAX = (30 * Math.PI) / 180;
/** Thirty seconds without input, and the view goes home. */
export const IDLE_RESET_MS = 30_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function isHome(v: View): boolean {
  return Math.abs(v.zoom - 1) < 1e-6 && Math.abs(v.tilt) < 1e-6 && Math.abs(v.panX) < 1e-6 && Math.abs(v.panZ) < 1e-6;
}

/** The pan kept within `limit` of the sun: a student can look anywhere in the system, never lose it. */
export function clampPan(v: View, limit: number): View {
  const r = Math.hypot(v.panX, v.panZ);
  if (r <= limit || r === 0) return v;
  return { ...v, panX: (v.panX / r) * limit, panZ: (v.panZ / r) * limit };
}

export function tiltBy(v: View, radians: number): View {
  return { ...v, tilt: clamp(v.tilt + radians, TILT_MIN, TILT_MAX) };
}

/**
 * Zoom by `factor` toward the plane point `p`, the camera looking at `target`:
 * the point under the pointer stays under it (a dolly scales distances from
 * the target by the factor, so the target moves (1 - f) of the way to p).
 */
export function zoomToward(v: View, factor: number, p: { x: number; z: number }, target: { x: number; z: number }): View {
  const zoom = clamp(v.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const f = zoom / v.zoom;
  return { ...v, zoom, panX: v.panX + (1 - f) * (p.x - target.x), panZ: v.panZ + (1 - f) * (p.z - target.z) };
}

/** A wheel's notches as a zoom factor: one notch is about 12%. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(clamp(deltaY, -300, 300) * 0.0012);
}

/** A pinch as a zoom factor: fingers apart is closer. */
export function pinchFactor(before: number, after: number): number {
  return after > 0 && before > 0 ? before / after : 1;
}

/**
 * What the page hands the scene: the view, and the gestures not yet applied.
 * A zoom needs the camera to find the plane point under the pointer, and a pan
 * needs it to turn pixels into distance, so the page queues them (screen
 * pixels) and the Rig applies them on its next frame.
 */
export interface ViewControl {
  view: View;
  zoomAt: Array<{ f: number; x: number; y: number }>;
  panPx: { dx: number; dy: number };
}

export function homeControl(): ViewControl {
  return { view: { ...HOME }, zoomAt: [], panPx: { dx: 0, dy: 0 } };
}

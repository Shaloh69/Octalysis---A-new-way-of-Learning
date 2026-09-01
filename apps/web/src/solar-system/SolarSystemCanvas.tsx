import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
// Named imports, not `import * as THREE`. A namespace import defeats
// tree-shaking and pushed the old galaxy chunk to 269 KB gzipped against a
// documented 250 KB budget (VISUAL-SYSTEM-3D.md §5).
import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";

import type { SolarLayout } from "./layout";
import { LEVELS } from "./layout";
import type { StageNode } from "../lib/api";

/**
 * The solar system — the presentation layer over the map.
 *
 * This file may not be the only thing that knows anything. It is aria-hidden
 * and pointer-events: none; every click, label and announcement is handled by
 * the DOM layer in StageMap.tsx. If this file fails to load, or WebGL is
 * unavailable, the map still works and nothing is missing. That is the whole
 * architecture (SKILL-TREE-3D.md §4) and it survives the reskin unchanged.
 *
 * NO drei, on purpose. VISUAL-SYSTEM-3D.md §5 records that `@react-three/drei`
 * was deliberately dropped to get the chunk under budget — it was carried for
 * an `<OrbitControls>` with pan, zoom and rotate all disabled, a dependency
 * doing nothing. Rings, the flight path and the star field are all plain
 * BufferGeometry here for the same reason.
 *
 * Colours come from `packages/tokens` at scene setup, never as literals. A hook
 * blocks a literal hex in apps/ anyway, but the real reason is that the
 * per-student accent derives in OKLCH from a stored hue and every colour has to
 * flow through it.
 */

interface Props {
  nodes: StageNode[];
  layout: SolarLayout;
  /**
   * Stage 11 names the rings. Before then they are visibly present but
   * unlabelled — ten weeks of unexplained descent is the setup for that
   * reveal, and the same withholding already applies to the Register Bar and
   * the Depth Gauge (SKILL-TREE-3D.md §2, SOLAR-SYSTEM-SPEC.md §1.2).
   *
   * This gates DECORATION ONLY. `/app/map` names every ring in text
   * regardless — a screen-reader user is never made to wait ten weeks for
   * information a sighted user could infer from the picture
   * (DESIGN-MANDATE-V2.md §5).
   */
  ringsNamed: boolean;
  /** Freeze all ambient motion. Reduced motion, and QA captures. */
  frozen: boolean;
  /**
   * The student's whole-system rotation offset, in radians.
   *
   * ONE angle, applied to the ENTIRE scene as a single group rotation — never
   * per ring and never per planet. That is what keeps it safely cosmetic: a
   * global rotation cannot disturb relative ordering or any radius, and radius
   * is the semantic axis (it encodes the Computer Level Hierarchy).
   *
   * It is applied HERE, at the renderer, and deliberately not inside
   * `layout.ts`. That function takes stages and objectives and nothing else;
   * `services/api/test/cosmetics.spec.ts` fails if it ever learns what a
   * student is.
   */
  rotationOffset: number;
  /**
   * The student's palette variant index.
   *
   * Passed in even though the colours themselves come from CSS, because the
   * token reads below are memoised and CSS custom properties are not reactive.
   * Without this in the dependency list the canvas resolves `--planet-lit` at
   * mount -- before the cosmetics fetch has landed and set `data-planet` on
   * <html> -- caches the fallback, and every student's planets render the same
   * white. That is exactly what happened, twice, and both times the tests
   * passed and only the screenshot showed it.
   */
  paletteVariant: number;
  /**
   * Where each planet currently is ON SCREEN, in CSS pixels relative to the
   * canvas box. Written every frame by `Projector` below.
   *
   * A mutable ref rather than state, deliberately: the camera drifts
   * continuously, so pushing 19 positions through React each frame would
   * re-render the whole map sixty times a second to move some buttons. The
   * overlay reads this ref from its own loop and writes transforms directly.
   */
  projection: React.MutableRefObject<Map<string, ScreenPoint>>;
  /**
   * The stage whose planet the camera should fly to, or null to drift.
   *
   * `GAME-DESIGN.md` §3.2 settled the interaction: clicking a body eases the
   * camera to it rather than cutting. It named `cameraPosition(..., duration)`
   * from react-force-graph — which is not installed, and was not installed
   * precisely because `VISUAL-SYSTEM-3D.md` §5 dropped dependencies doing one
   * small job. So the easing lives here in `useFrame`, which is where that file
   * already says camera moves belong.
   */
  focusId: string | null;
  /**
   * Called once if the scene cannot hold 30fps for three consecutive seconds.
   *
   * `VISUAL-SYSTEM-3D.md` §5's degradation ladder, rung 4 — the one that had
   * never been built. Rungs 1-3 (reduced motion, small viewport, absent WebGL)
   * are all capability checks answerable *before* rendering. This one can only
   * be answered by rendering and watching, which is presumably why it was the
   * one left out.
   *
   * A device that measures fine on paper and stutters in a lecture hall is
   * exactly the case the ladder exists for: 220 KB loads fine on a phone whose
   * GPU then cannot fill the frame.
   */
  onTooSlow: () => void;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  /** False when the body is behind the camera, so the overlay can hide it. */
  readonly visible: boolean;
}

/**
 * Read a resolved CSS custom property as a THREE.Color.
 *
 * THE BUG THIS REPLACES, because it is worth knowing about: the previous
 * version did `new Color(raw)` on the token's value, and **every token in this
 * project is authored in OKLCH**. three.js's colour parser does not understand
 * `oklch()` — it handles hex, rgb(), hsl() and named colours. So every read
 * threw, hit the catch, and returned the hardcoded HSL fallback.
 *
 * The 3D layer had therefore never used a single design token. It looked
 * plausible, so nothing caught it: `scan:palette` passes (no literal hex),
 * `check:contrast` passes (it checks tokens, and these were tokens — they just
 * were not reaching the scene), and TypeScript sees a valid call. It surfaced
 * only when two students with different palette variants rendered identically
 * in a screenshot.
 *
 * `VISUAL-SYSTEM-3D.md` §6 is explicit: "Never write a literal hex in a 3D
 * scene... Read the resolved CSS custom properties once at scene setup and
 * convert." This is the convert step, finally doing the conversion.
 *
 * HOW: paint one pixel and read it back. The browser already knows how to turn
 * any CSS colour — OKLCH, `color-mix()`, whatever arrives next — into sRGB, and
 * reimplementing OKLCH → sRGB here would be a second copy of maths that
 * `scripts/check-contrast.mjs` already owns, free to drift from it.
 */
function tokenColor(name: string, fallbackHsl: [number, number, number]): Color {
  const fallback = (): Color => new Color().setHSL(...fallbackHsl);
  if (typeof window === "undefined" || typeof document === "undefined") return fallback();

  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback();

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback();

    // A value the browser cannot parse leaves fillStyle at its previous value,
    // so seed a sentinel and check it actually moved. Without this an
    // unparseable token would silently paint black, which is worse than the
    // fallback because it looks deliberate.
    const sentinel = "#ff00ff";
    ctx.fillStyle = sentinel;
    ctx.fillStyle = raw;
    if (ctx.fillStyle === sentinel) return fallback();

    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    if (r === undefined || g === undefined || b === undefined) return fallback();
    return new Color(r / 255, g / 255, b / 255);
  } catch {
    return fallback();
  }
}

/** A flat circle of points in the XZ plane, for a ring or an orbit. */
function circleGeometry(radius: number, segments = 128): BufferGeometry {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(t) * radius;
    pts[i * 3 + 1] = 0;
    pts[i * 3 + 2] = Math.sin(t) * radius;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pts, 3));
  return g;
}

/**
 * The sun is the machine itself.
 *
 * Not a chapter — the destination the whole course descends toward. It is
 * deliberately NOT the student's accent colour: the accent marks the student's
 * own progress, and it may never carry semantic meaning (apps/web/CLAUDE.md).
 */
function Sun({ frozen, paletteVariant }: { frozen: boolean; paletteVariant: number }): JSX.Element {
  const core = useMemo(() => tokenColor("--planet-lit", [0.1, 0.6, 0.86]), [paletteVariant]);
  const halo = useMemo(() => tokenColor("--accent-muted", [0.1, 0.4, 0.5]), [paletteVariant]);
  const ref = useRef<{ scale: { setScalar: (n: number) => void } } | null>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (frozen || !ref.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    t.current += delta;
    // Barely-there breathing. Carries no information: the frozen state is
    // exactly as legible, which is the rule for every ambient effect here.
    ref.current.scale.setScalar(1 + Math.sin(t.current * 0.6) * 0.015);
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color={core} />
      </mesh>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- why: r3f's mesh ref type is not exported in a form that matches the narrow shape used above */}
      <mesh ref={ref as any}>
        <sphereGeometry args={[2.5, 24, 24]} />
        <meshBasicMaterial color={halo} transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

/**
 * Seven rings, L0 innermost.
 *
 * Radii come from `layout.ts` and are spaced by occupancy (F-2). Ring WEIGHT
 * varies with occupancy too — but as opacity, not line width: WebGL line width
 * is not portably supported, and a ring that renders 1px everywhere regardless
 * of what you asked for would be a silent lie about the data.
 *
 * An empty ring still draws, faintly. L4 and L5 genuinely carry nothing in this
 * syllabus, and that is true information — this course does not spend time at
 * those levels — not a gap to be filled.
 */
function Rings({ layout }: { layout: SolarLayout }): JSX.Element {
  const line = useMemo(() => tokenColor("--line", [0.6, 0.05, 0.3]), []);
  const busiest = Math.max(...layout.ringOccupancy, 1);

  return (
    <group>
      {LEVELS.map((level) => {
        const radius = layout.ringRadii[level];
        if (radius === undefined) return null;
        const load = (layout.ringOccupancy[level] ?? 0) / busiest;
        return (
          <lineLoop key={level} geometry={circleGeometry(radius)}>
            <lineBasicMaterial color={line} transparent opacity={0.1 + load * 0.4} />
          </lineLoop>
        );
      })}
    </group>
  );
}

/**
 * The flight path: curriculum order, one continuous sweep.
 *
 * Split in two so it can be styled honestly. The travelled portion plus the
 * next unlocked stage draw at full strength; everything beyond fades to nearly
 * nothing. That is the same withholding the Stage 11 ring reveal uses — don't
 * spoil the shape of what's ahead — and it also keeps 18 segments of line from
 * competing with the bodies for attention.
 *
 * It renders BEHIND the planets (lower renderOrder) so it reads as context
 * rather than clutter where it passes near a body it is not connecting to.
 */
function FlightPath({
  nodes,
  layout,
}: {
  nodes: StageNode[];
  layout: SolarLayout;
}): JSX.Element {
  const strong = useMemo(() => tokenColor("--line-strong", [0.6, 0.05, 0.45]), []);
  const faint = useMemo(() => tokenColor("--line", [0.6, 0.05, 0.25]), []);

  const { travelled, ahead } = useMemo(() => {
    const ordered = [...nodes].sort((a, b) => a.ordinal - b.ordinal);
    // The frontier is the last stage that is not locked. Server-derived state,
    // never a client-side mastery comparison (hard rule 4, INV-34).
    let frontier = 0;
    ordered.forEach((n, i) => {
      if (n.state !== "locked") frontier = i;
    });

    // Segment PAIRS, for <lineSegments>. React resolves a bare <line> to the
    // SVG element rather than three's Line, so the whole scene uses
    // lineSegments/lineLoop -- the same reason GalaxyCanvas did.
    const pointsFor = (from: number, to: number): BufferGeometry => {
      const pts: number[] = [];
      for (let i = from; i < to; i += 1) {
        const a = ordered[i];
        const b = ordered[i + 1];
        const ba = a ? layout.bodies.get(a.id) : undefined;
        const bb = b ? layout.bodies.get(b.id) : undefined;
        if (ba && bb) pts.push(ba.x, ba.y, ba.z, bb.x, bb.y, bb.z);
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
      return g;
    };

    return {
      travelled: pointsFor(0, Math.min(frontier + 1, ordered.length - 1)),
      ahead: pointsFor(Math.min(frontier + 1, ordered.length - 1), ordered.length - 1),
    };
  }, [nodes, layout]);

  return (
    <group renderOrder={-1}>
      <lineSegments geometry={ahead}>
        <lineBasicMaterial color={faint} transparent opacity={0.12} />
      </lineSegments>
      <lineSegments geometry={travelled}>
        <lineBasicMaterial color={strong} transparent opacity={0.75} />
      </lineSegments>
    </group>
  );
}

/**
 * The planets.
 *
 * Every visual difference here is a rendering of server-supplied state. The
 * client never decides what is locked — it calls `is_stage_unlocked()` through
 * the API and draws the answer (hard rule 4).
 *
 * Colour is never the only signal: a locked planet is also smaller and dimmer,
 * and the DOM layer says "Locked" in words with the reason and the distance.
 */
function Planets({
  nodes,
  layout,
  paletteVariant,
}: {
  nodes: StageNode[];
  layout: SolarLayout;
  paletteVariant: number;
}): JSX.Element {
  // `--planet-lit` / `--planet-dim` come from the student's seeded palette
  // variant (`[data-planet="vN"]` in packages/tokens). Mastery stays on
  // `--accent`, which is the student's OWN chosen hue and the one colour
  // allowed to mark their own progress -- a seeded variant may not override it.
  const accent = useMemo(() => tokenColor("--accent", [0.08, 0.55, 0.5]), [paletteVariant]);
  const ink = useMemo(() => tokenColor("--planet-lit", [0.6, 0.05, 0.85]), [paletteVariant]);
  const locked = useMemo(() => tokenColor("--planet-dim", [0.6, 0.05, 0.3]), [paletteVariant]);
  const line = useMemo(() => tokenColor("--line", [0.6, 0.05, 0.3]), [paletteVariant]);

  const outer = layout.ringRadii[6] ?? 1;
  const inner = layout.ringRadii[0] ?? 0;

  return (
    <group>
      {nodes.map((n) => {
        const body = layout.bodies.get(n.id);
        if (!body) return null;

        const isLocked = n.state === "locked";
        const isMastered = n.state === "mastered";
        const radius = isMastered ? 0.62 : isLocked ? 0.34 : 0.5;

        return (
          <group key={n.id}>
            <mesh position={[body.x, body.y, body.z]}>
              <sphereGeometry args={[radius, 20, 20]} />
              <meshBasicMaterial
                color={isLocked ? locked : isMastered ? accent : ink}
                transparent
                opacity={isLocked ? 0.4 : 1}
              />
            </mesh>

            {/*
              F-4. A stage declaring all seven levels is not AT a level, it is
              ABOUT the hierarchy, so it draws as a spoke crossing every ring
              rather than a point on one. Exactly one stage does this today.
              Without it, that fact is lost: its objectives are all level 6, so
              the mean-of-moons rule alone would place it as an ordinary planet
              on the outermost ring.
            */}
            {body.spansAllLevels && (
              <lineSegments
                geometry={(() => {
                  const g = new BufferGeometry();
                  g.setAttribute(
                    "position",
                    new BufferAttribute(
                      new Float32Array([
                        Math.cos(body.angle) * inner, 0, Math.sin(body.angle) * inner,
                        Math.cos(body.angle) * outer, 0, Math.sin(body.angle) * outer,
                      ]),
                      3,
                    ),
                  );
                  return g;
                })()}
              >
                <lineBasicMaterial color={line} transparent opacity={0.45} />
              </lineSegments>
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Rung 4 of the degradation ladder: measured frame rate.
 *
 * Below 30fps for three consecutive one-second windows, hand back to the flat
 * map. Three seconds rather than one because a single bad second is a garbage
 * collection or a tab regaining focus, not a device that cannot cope — and
 * dropping someone out of the map for a hiccup would be its own bug.
 *
 * Fires at most once. The caller remembers the choice for this device.
 */
function FrameRateGuard({ onTooSlow }: { onTooSlow: () => void }): null {
  const frames = useRef(0);
  const since = useRef(0);
  const badSeconds = useRef(0);
  const fired = useRef(false);

  useFrame((_, delta) => {
    if (fired.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    frames.current += 1;
    since.current += delta;
    if (since.current < 1) return;

    const fps = frames.current / since.current;
    frames.current = 0;
    since.current = 0;

    badSeconds.current = fps < 30 ? badSeconds.current + 1 : 0;
    if (badSeconds.current >= 3) {
      fired.current = true;
      onTooSlow();
    }
  });

  return null;
}

/** One instanced buffer, not N meshes. VISUAL-SYSTEM-3D.md §5, ≤3,000 points. */
function StarField({ count = 2200 }: { count?: number }): JSX.Element {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    // A deterministic scatter: the sky is the same every session, for the same
    // reason the map is. This is NOT the per-student cosmetic seed — that
    // rotates the whole system by one angle and touches nothing else.
    let seed = 0x9e3779b9;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < count; i += 1) {
      const r = 60 + rand() * 240;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.4;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    return g;
  }, [count]);

  // `--ink-faint`, not `--ink-dim`. The galaxy read `--ink-dim`, which is not
  // defined in packages/tokens, so it silently fell back to a hardcoded HSL —
  // a colour outside the token system in the one file most committed to it.
  const color = useMemo(() => tokenColor("--ink-faint", [0.6, 0.1, 0.7]), []);

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.7} sizeAttenuation color={color} transparent opacity={0.55} />
    </points>
  );
}

/**
 * Very slow orbital drift of the camera.
 *
 * Ambient decoration only. It carries no information the frozen state does not
 * also carry, which is exactly why `prefers-reduced-motion` may stop it dead
 * rather than slow it — and why no radius in `layout.ts` is allowed to depend
 * on it. Stops entirely when the tab is hidden: a solar system spinning in a
 * student's pocket is a bug, not a feature.
 */
function Drift({
  frozen,
  distance,
  focus,
}: {
  frozen: boolean;
  distance: number;
  /** World-space point to fly to, already rotated. Null = drift. */
  focus: { x: number; y: number; z: number } | null;
}): null {
  const t = useRef(0);
  const target = useRef(new Vector3());
  const look = useRef(new Vector3());

  useFrame((three, delta) => {
    if (typeof document !== "undefined" && document.hidden) return;

    if (focus) {
      /*
       * Fly to the planet: sit off it along the line running out from the sun,
       * so the body is framed against open space rather than against the busy
       * middle of the system.
       *
       * The orbit also stops while focused. §2 requires the background to stop
       * animating while the dialog is open, and a camera still sweeping past
       * the planet you just selected is the opposite of focus.
       */
      const out = Math.hypot(focus.x, focus.z) || 1;
      target.current.set(
        focus.x + (focus.x / out) * 5.5,
        distance * 0.30,
        focus.z + (focus.z / out) * 5.5,
      );
      look.current.set(focus.x, focus.y, focus.z);
      // Frame-rate independent easing. Under reduced motion it jumps straight
      // there: the state still changes, it just changes instantly.
      const k = frozen ? 1 : 1 - Math.pow(0.005, delta);
      three.camera.position.lerp(target.current, k);
      three.camera.lookAt(look.current);
      return;
    }

    if (!frozen) t.current += delta;
    three.camera.position.x = Math.cos(t.current * 0.035) * distance;
    three.camera.position.z = Math.sin(t.current * 0.035) * distance;
    three.camera.position.y = distance * 0.62;
    three.camera.lookAt(0, 0, 0);
  });

  return null;
}

/**
 * Projects each planet's world position into screen space, every frame.
 *
 * This is the half of `SKILL-TREE-3D.md` §4's two-layer architecture that R1
 * deferred: "every click, focus, and screen-reader announcement is handled by
 * real DOM elements positioned over their 3D counterparts." The canvas is
 * pixels and stays `aria-hidden`; the buttons that sit on top of it are the
 * actual controls.
 *
 * Writes into a ref rather than calling back into React — see the prop's note.
 */
function Projector({
  nodes,
  layout,
  rotationOffset,
  projection,
}: {
  nodes: StageNode[];
  layout: SolarLayout;
  rotationOffset: number;
  projection: React.MutableRefObject<Map<string, ScreenPoint>>;
}): null {
  const { camera, size } = useThree();

  useFrame(() => {
    if (typeof document !== "undefined" && document.hidden) return;

    const cos = Math.cos(rotationOffset);
    const sin = Math.sin(rotationOffset);
    const v = new Vector3();

    for (const n of nodes) {
      const body = layout.bodies.get(n.id);
      if (!body) continue;

      // The scene is rotated by one seeded angle at the <group>, so the same
      // rotation has to be applied here -- the layout's coordinates are the
      // unrotated truth and the buttons must land on what is actually drawn.
      v.set(body.x * cos + body.z * sin, body.y, -body.x * sin + body.z * cos);
      v.project(camera);

      projection.current.set(n.id, {
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (-v.y * 0.5 + 0.5) * size.height,
        visible: v.z < 1,
      });
    }
  });

  return null;
}

export default function SolarSystemCanvas({
  nodes,
  layout,
  ringsNamed,
  frozen,
  rotationOffset,
  paletteVariant,
  projection,
  focusId,
  onTooSlow,
}: Props): JSX.Element | null {
  const [failed, setFailed] = useState(false);

  // If WebGL is unavailable the canvas simply never appears. No error state and
  // no redirect: the DOM map is already on screen underneath, so nothing has to
  // move. (F-5 — VISUAL-SYSTEM-3D.md §5's ladder degrades in place.)
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) setFailed(true);
    } catch {
      setFailed(true);
    }
  }, []);

  /*
   * The focused planet's world position, with the seeded rotation applied --
   * `layout.ts` holds the unrotated truth, the scene is rotated at the <group>,
   * and the camera has to fly to what is actually drawn. Same correction the
   * Projector makes, for the same reason.
   */
  const focusBody = focusId ? layout.bodies.get(focusId) : undefined;
  const focus = focusBody
    ? {
        x: focusBody.x * Math.cos(rotationOffset) + focusBody.z * Math.sin(rotationOffset),
        y: focusBody.y,
        z: -focusBody.x * Math.sin(rotationOffset) + focusBody.z * Math.cos(rotationOffset),
      }
    : null;

  // Frame the whole system: outermost ring plus a small margin.
  //
  // Tightened from 1.5x after looking at it -- at 1.5 the system floated in the
  // middle of its box with the top 40% empty, which reads as an unfinished
  // page rather than as space.
  const distance = ((layout.ringRadii[6] ?? 16) + 2) * 1.35;

  // Rings are drawn from Stage 00; naming them is Stage 11's reveal. Nothing
  // here reads the flag yet — labels are DOM, not canvas — but it is threaded
  // through so R3 cannot quietly add canvas ring labels without meeting it.
  void ringsNamed;

  if (failed) return null;

  return (
    <Canvas
      camera={{ position: [distance, distance * 0.62, distance], fov: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      dpr={[1, 1.6]}
    >
      {/* The star field sits outside the rotation: it is the sky, not the
          system, and rotating it too would cancel the effect out entirely. */}
      <StarField />

      {/* One group, one angle, everything inside it. See the prop's comment. */}
      <group rotation={[0, rotationOffset, 0]}>
        <Rings layout={layout} />
        <FlightPath nodes={nodes} layout={layout} />
        <Sun frozen={frozen} paletteVariant={paletteVariant} />
        <Planets nodes={nodes} layout={layout} paletteVariant={paletteVariant} />
      </group>

      <Projector
        nodes={nodes}
        layout={layout}
        rotationOffset={rotationOffset}
        projection={projection}
      />
      <Drift frozen={frozen} distance={distance} focus={focus} />
      <FrameRateGuard onTooSlow={onTooSlow} />
    </Canvas>
  );
}

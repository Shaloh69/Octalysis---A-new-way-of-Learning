import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { AdditiveBlending, Color, Group, SRGBColorSpace, Vector3 } from "three";
import type { SolarLayout } from "../solar-system/layout";
import { orbitAngle } from "../solar-system/orbit";

/**
 * The 3D map's scene (WEB-REMAKE.md §0.3-§0.5): Starfield's system map.
 *
 * DECORATIVE BY CONTRACT: `aria-hidden`, and every fact it shows is in the DOM
 * panels in words (the row of bodies is the accessible layer). Clicking a
 * planet and choosing it in the row are the same action.
 *
 *   planets   on circular orbits (radius = level), moving by Kepler's third
 *             law (`orbit.ts`), tinted by EACH planet's own biome
 *   selection a reticle, the planet's moons, and the camera easing in (~700ms
 *             to settle); under reduced motion it cuts and nothing orbits
 *   yours     the next stage (the mission) is ringed in the student's accent
 *
 * Colours come from tokens, read through the DOM so a token change repaints
 * the sky. Lazy-loaded: three.js never reaches the initial bundle.
 */

export interface ScenePlanet {
  id: string;
  state: "locked" | "available" | "in_progress" | "mastered";
  biome: string;
  moons: number;
}

type SceneColors = Record<"sun" | "glow" | "line" | "star" | "locked" | "corner" | "accent" | "ground", Color>;

export interface SceneProps {
  layout: SolarLayout;
  planets: ScenePlanet[];
  selected: string | null;
  next: string | null;
  rotation: number;
  reduced: boolean;
  lowQuality: boolean;
  yaw: MutableRefObject<number>;
  dragged: MutableRefObject<boolean>;
  tag: MutableRefObject<HTMLSpanElement | null>;
  /** The part of the screen the panels leave free, in CSS pixels: the camera
   *  centres and fits the system (or the selected planet) inside it. */
  frame: { x: number; y: number; w: number; h: number } | null;
  onSelect: (id: string) => void;
  onMiss: () => void;
  onSlow: () => void;
}

/** A token's colour, as three.js wants it: painted once on a 1px canvas. */
const probe = typeof document !== "undefined" ? document.createElement("canvas") : null;
function tokenColor(name: string, fallback = "oklch(0.7 0 0)"): Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const ctx = probe!.getContext("2d", { willReadFrequently: true })!;
  probe!.width = probe!.height = 1;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new Color().setRGB(r! / 255, g! / 255, b! / 255, SRGBColorSpace);
}

export default function StarMapScene(props: SceneProps): JSX.Element {
  return (
    <Canvas
      className="starmap-canvas"
      aria-hidden="true"
      dpr={props.lowQuality ? 1 : [1, 1.75]}
      camera={{ fov: 40, near: 0.1, far: 800, position: [0, 40, 40] }}
      gl={{ antialias: !props.lowQuality, powerPreference: "low-power" }}
      onPointerMissed={() => {
        if (!props.dragged.current) props.onMiss();
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}

function Scene(p: SceneProps): JSX.Element {
  const colors = useMemo<SceneColors>(
    () => ({
      sun: tokenColor("--sun"),
      glow: tokenColor("--sun-glow"),
      line: tokenColor("--line-strong"),
      star: tokenColor("--ink-muted"),
      locked: tokenColor("--locked"),
      corner: tokenColor("--frame-corner"),
      accent: tokenColor("--accent"),
      ground: tokenColor("--solar-ground"),
    }),
    [],
  );
  const outer = Math.max(...p.layout.ringRadii);
  const radii = useMemo(() => {
    const set = new Set<number>();
    for (const pl of p.planets) set.add(p.layout.bodies.get(pl.id)?.radius ?? 0);
    return [...set].filter((r) => r > 0);
  }, [p.layout, p.planets]);

  // One clock for every body; frozen at 0 under reduced motion.
  const clock = useRef(0);
  const positions = useRef(new Map<string, Vector3>());
  useFrame((_, dt) => {
    if (!p.reduced) clock.current += Math.min(dt, 0.1);
  });

  return (
    <>
      <color attach="background" args={[colors.ground]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 0, 0]} intensity={2.4} decay={0} color={colors.sun} />
      <Stars color={colors.star} count={p.lowQuality ? 600 : 1500} />
      <mesh>
        <sphereGeometry args={[1.7, 40, 40]} />
        <meshBasicMaterial color={colors.sun} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color={colors.glow} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {radii.map((r) => (
        <OrbitRing key={r} radius={r} color={colors.line} />
      ))}
      {p.planets.map((pl) => (
        <Planet
          key={pl.id}
          planet={pl}
          layout={p.layout}
          outer={outer}
          rotation={p.rotation}
          clock={clock}
          positions={positions}
          colors={colors}
          selected={p.selected === pl.id}
          next={p.next === pl.id}
          reduced={p.reduced}
          dragged={p.dragged}
          onSelect={p.onSelect}
        />
      ))}
      <Rig {...p} outer={outer} positions={positions} />
    </>
  );
}

function Stars({ color, count }: { color: Color; count: number }): JSX.Element {
  const arr = useMemo(() => {
    // Seeded, not random: every student sees the same sky.
    let s = 97;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const r = 180 + rand() * 120;
      const q = Math.sqrt(1 - u * u);
      out[i * 3] = r * q * Math.cos(th);
      out[i * 3 + 1] = r * u;
      out[i * 3 + 2] = r * q * Math.sin(th);
    }
    return out;
  }, [count]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={1.6} sizeAttenuation={false} />
    </points>
  );
}

function OrbitRing({ radius, color }: { radius: number; color: Color }): JSX.Element {
  const arr = useMemo(() => {
    const n = 160;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out[i * 3] = Math.cos(a) * radius;
      out[i * 3 + 2] = Math.sin(a) * radius;
    }
    return out;
  }, [radius]);
  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[arr, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.45} />
    </lineLoop>
  );
}

interface PlanetProps {
  planet: ScenePlanet;
  layout: SolarLayout;
  outer: number;
  rotation: number;
  clock: MutableRefObject<number>;
  positions: MutableRefObject<Map<string, Vector3>>;
  colors: SceneColors;
  selected: boolean;
  next: boolean;
  reduced: boolean;
  dragged: MutableRefObject<boolean>;
  onSelect: (id: string) => void;
}

function Planet(p: PlanetProps): JSX.Element | null {
  const body = p.layout.bodies.get(p.planet.id);
  const group = useRef<Group>(null);
  const reticle = useRef<Group>(null);
  const moons = useRef<Group>(null);
  const tint = useMemo(() => tokenColor(`--biome-planet-${p.planet.biome}`), [p.planet.biome]);
  const locked = p.planet.state === "locked";
  const color = locked ? p.colors.locked : tint;
  const size = 0.5 + Math.min(p.planet.moons, 12) * 0.03;

  useFrame((_, dt) => {
    if (!body || !group.current) return;
    const a = orbitAngle(body.angle + p.rotation, body.radius, p.outer, p.clock.current);
    group.current.position.set(Math.cos(a) * body.radius, 0, Math.sin(a) * body.radius);
    const v = p.positions.current.get(p.planet.id) ?? new Vector3();
    v.copy(group.current.position);
    p.positions.current.set(p.planet.id, v);
    if (!p.reduced) {
      if (reticle.current) reticle.current.rotation.y += dt * 0.6;
      if (moons.current) moons.current.rotation.y += dt * 0.35;
    }
  });
  if (!body) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!p.dragged.current) p.onSelect(p.planet.id);
  };

  return (
    <group ref={group}>
      <mesh
        onClick={click}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[size, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={locked ? 0.08 : 0.22}
          roughness={0.85}
          metalness={0}
        />
      </mesh>
      {/* A generous invisible hit target, so a phone's thumb can pick a small planet. */}
      <mesh onClick={click} visible={false}>
        <sphereGeometry args={[size + 0.9, 12, 12]} />
        <meshBasicMaterial />
      </mesh>
      {p.planet.state === "mastered" && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[size + 0.35, 0.05, 8, 48]} />
          <meshBasicMaterial color={p.colors.corner} />
        </mesh>
      )}
      {p.next && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[size + 0.55, 0.07, 8, 56]} />
          <meshBasicMaterial color={p.colors.accent} />
        </mesh>
      )}
      {p.selected && (
        <>
          <group ref={reticle}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} rotation={[Math.PI / 2, 0, (i * Math.PI) / 2]}>
                <torusGeometry args={[size + 0.95, 0.06, 6, 24, Math.PI / 3.2]} />
                <meshBasicMaterial color={p.colors.corner} />
              </mesh>
            ))}
          </group>
          <group ref={moons}>
            {Array.from({ length: Math.min(p.planet.moons, 12) }, (_, i) => {
              const a = (i / Math.min(p.planet.moons, 12)) * Math.PI * 2;
              const r = size + 1.5 + (i % 2) * 0.35;
              return (
                <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                  <sphereGeometry args={[0.14, 12, 12]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
                </mesh>
              );
            })}
          </group>
        </>
      )}
    </group>
  );
}

/**
 * The camera: Starfield's tilted view of the whole system, easing to a
 * selected planet and back out. Fits the system to the screen's aspect, so a
 * portrait phone sees every orbit; shifts the picture right of the side panel
 * on a wide screen. Drag yaws the system (the page owns `yaw`). Also carries
 * the frame-rate guard and the selected planet's name tag.
 */
function Rig(p: SceneProps & { outer: number; positions: MutableRefObject<Map<string, Vector3>> }): null {
  const { camera, size } = useThree();
  const target = useRef(new Vector3());
  const dist = useRef<number | null>(null);
  const yawNow = useRef(0);
  const frames = useRef({ t: 0, n: 0, slow: 0, age: 0 });
  const tmp = useMemo(() => new Vector3(), []);

  useFrame((_, dt) => {
    const W = size.width;
    const H = Math.max(1, size.height);
    const fr = p.frame ?? { x: 0, y: 0, w: W, h: H };
    const tan = Math.tan((20 * Math.PI) / 180);
    // Fit the tilted disc inside the free area: its width across the free
    // width, its foreshortened depth (≈ sin(pitch) of it) down the free height.
    const byWidth = p.outer / (tan * (Math.max(1, fr.w) / H));
    const byHeight = (p.outer * 0.86) / (tan * (Math.max(1, fr.h) / H));
    const fit = Math.max(byWidth, byHeight) * 1.08;
    const selPos = p.selected ? p.positions.current.get(p.selected) : undefined;
    const wantTarget = selPos ?? tmp.set(0, 0, 0);
    const wantDist = selPos ? Math.min(fit, 16 * Math.max(1, (0.55 * H) / Math.max(1, fr.h))) : fit;
    const k = p.reduced ? 1 : 1 - Math.exp(-dt * 6);
    target.current.lerp(wantTarget, k);
    dist.current = dist.current === null ? wantDist : dist.current + (wantDist - dist.current) * k;
    yawNow.current += (p.yaw.current - yawNow.current) * (p.reduced ? 1 : 1 - Math.exp(-dt * 10));

    const pitch = (58 * Math.PI) / 180;
    const d = dist.current;
    camera.position.set(
      target.current.x + d * Math.cos(pitch) * Math.sin(yawNow.current),
      target.current.y + d * Math.sin(pitch),
      target.current.z + d * Math.cos(pitch) * Math.cos(yawNow.current),
    );
    camera.lookAt(target.current);
    // Keep the system clear of the side panel on a wide screen.
    const persp = camera as typeof camera & { setViewOffset?: (...a: number[]) => void; clearViewOffset?: () => void };
    const sx = fr.x + fr.w / 2 - W / 2;
    const sy = fr.y + fr.h / 2 - H / 2;
    if (Math.abs(sx) > 1 || Math.abs(sy) > 1) persp.setViewOffset?.(W, H, -sx, -sy, W, H);
    else persp.clearViewOffset?.();

    // The selected planet's name tag, Starfield's: positioned, not re-rendered.
    const tag = p.tag.current;
    if (tag) {
      if (selPos) {
        const v = selPos.clone().project(camera);
        const x = ((v.x + 1) / 2) * size.width;
        const y = ((-v.y + 1) / 2) * size.height;
        // Right of the planet, or left of it when the screen ends first.
        const tw = tag.offsetWidth;
        const tx = x + 34 + tw <= W - 8 ? x + 34 : Math.max(8, x - 34 - tw);
        tag.style.transform = `translate(${Math.round(tx)}px, ${Math.round(y - 12)}px)`;
        tag.style.visibility = v.z < 1 ? "visible" : "hidden";
      } else {
        tag.style.visibility = "hidden";
      }
    }

    // The frame-rate guard (VISUAL-SYSTEM-3D.md §5, rung 4): lower the
    // picture's cost, never the map. The first 4s are not judged, and a frame
    // longer than 0.5s (a tab switch) is discarded.
    const f = frames.current;
    f.age += dt;
    if (f.age > 4 && dt < 0.5 && !p.lowQuality) {
      f.t += dt;
      f.n += 1;
      if (f.t >= 1) {
        f.slow = f.n / f.t < 30 ? f.slow + 1 : 0;
        f.t = 0;
        f.n = 0;
        if (f.slow >= 3) p.onSlow();
      }
    }
  });
  return null;
}

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  RepeatWrapping,
  RingGeometry,
  Sprite,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { allTextureFiles, KIND_SCALE, moonSkin, skinFor, SUN_MAP, type BodySkin } from "../solar-system/bodies";
import { planetSkinKey } from "../solar-system/world";
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
 *   moons     one per objective of a GRADEABLE planet, drawn while it is chosen,
 *             each on its own circular orbit moving by the same Kepler law
 *             (WEB-REVAMP 4), in three states one level down from a planet's:
 *             dim, a partial glow, a full glow with a ring (R4.2). Click one to
 *             choose it; the camera eases onto it (3.2)
 *   asteroids Orientation has no moons (3.10): a small belt, seeded per
 *             student, grey, unlit and never glowing, that nothing can choose
 *   skins     real planetary textures (1 Oct 2026; `solar-system/bodies.ts`,
 *             Solar System Scope, CC BY 4.0): each planet a world of its own
 *             biome's kind, seeded per student, each with its own animation:
 *             its spin and axial tilt, a gas giant's flattening and drifting
 *             bands, an Earth-like's cloud layer, a ringed giant's rings. The
 *             sun is its own surface with a breathing corona. Textures load
 *             progressively; until one arrives the planet wears its biome's
 *             tint, so nothing blanks. Reduced motion freezes all of it
 *   yours     the next stage (the mission) is ringed in the student's accent
 *
 * Colours come from tokens, read through the DOM so a token change repaints
 * the sky. Lazy-loaded: three.js never reaches the initial bundle.
 */

export interface ScenePlanet {
  id: string;
  state: "locked" | "available" | "in_progress" | "mastered";
  biome: string;
  /** The planet's moons in order, each in its state (the server's, named in body.tsx). */
  moons: Array<{ id: string; glow: "dim" | "partial" | "full" }>;
  /** Orientation: a cosmetic belt instead of moons. */
  asteroids: boolean;
  /** The layout's ring for it, which puts it inside or beyond the frost line (world.ts). */
  ring: number;
  /** Stage 01: a spoke across every level, the home world. */
  spoke: boolean;
}

type SceneColors = Record<"sun" | "glow" | "line" | "star" | "locked" | "corner" | "accent" | "ground", Color>;

export interface SceneProps {
  layout: SolarLayout;
  planets: ScenePlanet[];
  selected: string | null;
  selectedMoon: string | null;
  next: string | null;
  rotation: number;
  reduced: boolean;
  lowQuality: boolean;
  yaw: MutableRefObject<number>;
  dragged: MutableRefObject<boolean>;
  /** The part of the screen the panels leave free, in CSS pixels: the camera
   *  centres and fits the system (or the selected planet) inside it. */
  frame: { x: number; y: number; w: number; h: number } | null;
  onSelect: (id: string) => void;
  onSelectMoon: (id: string) => void;
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

/**
 * Every texture, loaded once and progressively: the map draws at once in the
 * biomes' tints and each body takes its surface as it arrives. A texture that
 * fails costs that surface, never the map.
 */
function useTextures(): Map<string, Texture> {
  const [loaded, setLoaded] = useState<Map<string, Texture>>(() => new Map());
  useEffect(() => {
    let live = true;
    const loader = new TextureLoader();
    const base = `${import.meta.env.BASE_URL}textures/`;
    for (const file of allTextureFiles()) {
      loader.load(
        base + file,
        (tex) => {
          if (!live) return;
          if (!file.endsWith(".png") && !file.includes("clouds")) tex.colorSpace = SRGBColorSpace;
          tex.anisotropy = 4;
          setLoaded((prev) => new Map(prev).set(file, tex));
        },
        undefined,
        () => {
          /* the body keeps its tint */
        },
      );
    }
    return () => {
      live = false;
    };
  }, []);
  return loaded;
}

function Scene(p: SceneProps): JSX.Element {
  const textures = useTextures();
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
      <Sun colors={colors} surface={textures.get(SUN_MAP)} reduced={p.reduced} />
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
          textures={textures}
          selected={p.selected === pl.id}
          selectedMoon={p.selected === pl.id ? p.selectedMoon : null}
          next={p.next === pl.id}
          reduced={p.reduced}
          dragged={p.dragged}
          onSelect={p.onSelect}
          onSelectMoon={p.onSelectMoon}
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

/**
 * The sun: its own surface, unlit, turning once in a minute and a half and
 * churning slowly, inside a corona that breathes. The token colours stay:
 * the corona is `--sun-glow`, and without its texture the sun is `--sun`.
 */
function Sun({ colors, surface, reduced }: { colors: SceneColors; surface: Texture | undefined; reduced: boolean }): JSX.Element {
  const body = useRef<Mesh>(null);
  const corona = useRef<Sprite>(null);
  const halo = useRef<Sprite>(null);
  const falloff = useMemo(glowFalloff, []);
  const map = useMemo(() => {
    if (!surface) return undefined;
    const t = surface.clone();
    t.wrapS = RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [surface]);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (reduced) return;
    t.current += Math.min(dt, 0.1);
    if (body.current) body.current.rotation.y += (dt * Math.PI * 2) / 90;
    if (map) map.offset.x = (map.offset.x + dt * 0.003) % 1;
    corona.current?.scale.setScalar(CORONA * (1 + 0.05 * Math.sin(t.current * 0.9)));
    halo.current?.scale.setScalar(HALO * (1 + 0.035 * Math.sin(t.current * 0.55 + 1.3)));
  });
  return (
    <group>
      <mesh ref={body}>
        <sphereGeometry args={[1.7, 48, 48]} />
        {/* Keyed on the texture: a material compiled without a map never draws one (three.js compiles once). */}
        <meshBasicMaterial key={map ? "surface" : "tint"} color={map ? WHITE : colors.sun} map={map ?? null} />
      </mesh>
      {falloff && (
        <>
          <sprite ref={corona} scale={CORONA}>
            <spriteMaterial map={falloff} color={colors.glow} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
          </sprite>
          <sprite ref={halo} scale={HALO}>
            <spriteMaterial map={falloff} color={colors.glow} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} />
          </sprite>
        </>
      )}
    </group>
  );
}

/** The corona's and the halo's widths, in scene units (the sun's radius is 1.7). */
const CORONA = 6.2;
const HALO = 11;

/**
 * A soft radial falloff, drawn once on a canvas: opaque at the centre to clear
 * at the edge, so a glow has no rim. It is an alpha mask, not a colour: the
 * sprite's material tints it `--sun-glow`.
 */
function glowFalloff(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, a] of [[0, 1], [0.27, 0.7], [0.4, 0.28], [0.65, 0.07], [1, 0]] as const) {
    g.addColorStop(at, `rgba(255, 255, 255, ${a})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

/** Unshaded white: the surface as the texture draws it. Not a palette colour. */
const WHITE = new Color(1, 1, 1);

/** A ring whose texture runs outward: RingGeometry's UVs are planar, so u is remapped to the radius. */
function radialRing(inner: number, outer: number): RingGeometry {
  const g = new RingGeometry(inner, outer, 96, 1);
  const pos = g.attributes.position!;
  const uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  return g;
}

/** Spins are real ratios, scaled to be watched: a skin's `spinS` seconds per turn. */
function Globe({
  skin,
  textures,
  size,
  fallback,
  dim,
  glow,
  reduced,
  segments = 40,
  onClick,
}: {
  skin: BodySkin;
  textures: Map<string, Texture>;
  size: number;
  /** The tint drawn until the surface arrives (the biome's, or `--locked`). */
  fallback: Color;
  /** Multiply the surface darker (a locked planet, an unmastered moon). */
  dim: Color | null;
  /** Emissive strength: a moon's glow, a planet's faint self-light. */
  glow: number;
  reduced: boolean;
  segments?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}): JSX.Element {
  const spin = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);
  const surface = textures.get(skin.map);
  // Each body its own copy, so a gas giant's drifting bands move its texture alone.
  const map = useMemo(() => {
    if (!surface) return undefined;
    const t = surface.clone();
    t.wrapS = RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [surface]);
  const clouds = skin.clouds ? textures.get(skin.clouds) : undefined;
  const ringTex = skin.ring ? textures.get(skin.ring) : undefined;
  const ringGeo = useMemo(() => (skin.ring ? radialRing(size * 1.35, size * 2.3) : null), [skin.ring, size]);

  useFrame((_, dt) => {
    if (reduced) return;
    const d = Math.min(dt, 0.1);
    if (spin.current) spin.current.rotation.y += (d * Math.PI * 2) / skin.spinS;
    if (cloudRef.current) cloudRef.current.rotation.y += (d * Math.PI * 2) / (skin.spinS * 0.8);
    if (map && skin.bandDrift) map.offset.x = (map.offset.x + d * skin.bandDrift) % 1;
  });

  const tint = map ? (dim ?? WHITE) : fallback;
  return (
    <group rotation={[0, 0, skin.tilt]}>
      <mesh
        ref={spin}
        scale={[1, skin.oblate, 1]}
        {...(onClick
          ? {
              onClick,
              onPointerOver: () => (document.body.style.cursor = "pointer"),
              onPointerOut: () => (document.body.style.cursor = ""),
            }
          : {})}
      >
        <sphereGeometry args={[size, segments, segments]} />
        <meshStandardMaterial
          key={map ? "surface" : "tint"}
          color={tint}
          map={map ?? null}
          emissive={map ? WHITE : fallback}
          emissiveMap={map ?? null}
          emissiveIntensity={glow}
          roughness={skin.kind === "gas" || skin.kind === "ringed" ? 0.7 : 0.95}
          metalness={0}
        />
      </mesh>
      {clouds && (
        <mesh ref={cloudRef} scale={[1, skin.oblate, 1]} raycast={() => null}>
          <sphereGeometry args={[size * 1.025, segments, segments]} />
          <meshStandardMaterial key={clouds.uuid} color={dim ?? WHITE} alphaMap={clouds} transparent depthWrite={false} opacity={0.9} />
        </mesh>
      )}
      {ringGeo && ringTex && (
        <mesh geometry={ringGeo} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <meshBasicMaterial key={ringTex.uuid} map={ringTex} color={dim ?? WHITE} transparent side={DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
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
  textures: Map<string, Texture>;
  selected: boolean;
  selectedMoon: string | null;
  next: boolean;
  reduced: boolean;
  dragged: MutableRefObject<boolean>;
  onSelect: (id: string) => void;
  onSelectMoon: (id: string) => void;
}

/**
 * Local orbits, around the planet. The same law as the planets' (w ~ a^-1.5,
 * `orbit.ts`), on a faster clock so a moon is seen to move while its planet is
 * chosen: the outermost moon goes round in a minute.
 */
const LOCAL_CLOCK = 10;
const MOON_GAP = 0.26;

/** A planet's moon orbit radii: distinct, so each moves at its own Kepler speed. */
function moonRadius(size: number, i: number): number {
  return size + 1.25 + i * MOON_GAP;
}

function Planet(p: PlanetProps): JSX.Element | null {
  const body = p.layout.bodies.get(p.planet.id);
  const group = useRef<Group>(null);
  const reticle = useRef<Group>(null);
  const moons = useRef<Group>(null);
  const tint = useMemo(() => tokenColor(`--biome-planet-${p.planet.biome}`), [p.planet.biome]);
  const locked = p.planet.state === "locked";
  const color = locked ? p.colors.locked : tint;
  const skin = useMemo(
    () => skinFor(planetSkinKey(p.planet.id, p.planet.ring, p.planet.spoke, p.rotation)),
    [p.planet.id, p.planet.ring, p.planet.spoke, p.rotation],
  );
  // Size still grows with the planet's moons; its kind makes a gas giant read as one.
  const size = (0.62 + Math.min(p.planet.moons.length || 5, 12) * 0.035) * KIND_SCALE[skin.kind];
  const moonMeshes = useRef<Array<Group | null>>([]);
  const outerMoon = moonRadius(size, Math.max(0, p.planet.moons.length - 1));
  const belt = useMemo(
    () => (p.planet.asteroids ? asteroidBelt(p.rotation, size) : []),
    [p.planet.asteroids, p.rotation, size],
  );
  const rocks = useRef<Array<Group | null>>([]);

  useFrame((_, dt) => {
    if (!body || !group.current) return;
    const a = orbitAngle(body.angle + p.rotation, body.radius, p.outer, p.clock.current);
    group.current.position.set(Math.cos(a) * body.radius, 0, Math.sin(a) * body.radius);
    const v = p.positions.current.get(p.planet.id) ?? new Vector3();
    v.copy(group.current.position);
    p.positions.current.set(p.planet.id, v);
    if (!p.reduced) {
      if (reticle.current) reticle.current.rotation.y += dt * 0.6;
    }
    // Moons and rocks on their own Kepler orbits; frozen with the planets under
    // reduced motion (the one clock stays at 0).
    const t = p.clock.current * LOCAL_CLOCK;
    p.planet.moons.forEach((m, i) => {
      const g = moonMeshes.current[i];
      if (!g || !group.current) return;
      const r = moonRadius(size, i);
      const a = orbitAngle((i / Math.max(1, p.planet.moons.length)) * Math.PI * 2, r, outerMoon, t);
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const w = p.positions.current.get(`moon:${m.id}`) ?? new Vector3();
      w.copy(g.position).add(group.current.position);
      p.positions.current.set(`moon:${m.id}`, w);
    });
    const beltOuter = belt.length ? Math.max(...belt.map((b) => b.r)) : 1;
    belt.forEach((b, i) => {
      const g = rocks.current[i];
      if (!g) return;
      const a = orbitAngle(b.a0, b.r, beltOuter, t);
      g.position.set(Math.cos(a) * b.r, b.y, Math.sin(a) * b.r);
    });
  });
  if (!body) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!p.dragged.current) p.onSelect(p.planet.id);
  };

  return (
    <group ref={group}>
      {/* A locked world is its surface dimmed by --locked; its state is in words in the row. */}
      <Globe
        skin={skin}
        textures={p.textures}
        size={size}
        fallback={color}
        dim={locked ? p.colors.locked : null}
        glow={locked ? 0.02 : 0.12}
        reduced={p.reduced}
        onClick={click}
      />
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
            {p.planet.moons.map((m, i) => {
              const glow = m.glow;
              const isSel = p.selectedMoon === m.id;
              const pick = (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                if (!p.dragged.current) p.onSelectMoon(m.id);
              };
              return (
                <group
                  key={m.id}
                  ref={(g) => {
                    moonMeshes.current[i] = g;
                  }}
                >
                  {/* dim: darkened by --locked; partial: lit; full: glowing, haloed and ringed. */}
                  <Globe
                    skin={moonSkin(m.id, p.rotation)}
                    textures={p.textures}
                    size={0.16}
                    segments={20}
                    fallback={glow === "dim" ? p.colors.locked : tint}
                    dim={glow === "dim" ? p.colors.locked : null}
                    glow={glow === "full" ? 0.55 : glow === "partial" ? 0.22 : 0.02}
                    reduced={p.reduced}
                    onClick={pick}
                  />
                  <mesh onClick={pick} visible={false}>
                    <sphereGeometry args={[0.42, 8, 8]} />
                    <meshBasicMaterial />
                  </mesh>
                  {glow === "full" && (
                    <>
                      <mesh>
                        <sphereGeometry args={[0.3, 16, 16]} />
                        <meshBasicMaterial color={tint} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
                      </mesh>
                      <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.27, 0.025, 6, 28]} />
                        <meshBasicMaterial color={p.colors.corner} />
                      </mesh>
                    </>
                  )}
                  {isSel && (
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[0.42, 0.035, 6, 32]} />
                      <meshBasicMaterial color={p.colors.corner} />
                    </mesh>
                  )}
                </group>
              );
            })}
            {belt.map((b, i) => (
              <group
                key={i}
                ref={(g) => {
                  rocks.current[i] = g;
                }}
              >
                {/* Irregular, grey and unlit: never mistaken for a moon (3.10). No handler: nothing chooses it. */}
                <mesh scale={[b.s, b.s * b.squash, b.s * 0.8]} rotation={[b.tilt, b.tilt * 2, 0]} raycast={() => null}>
                  <dodecahedronGeometry args={[1, 0]} />
                  <meshLambertMaterial color={p.colors.line} flatShading />
                </mesh>
              </group>
            ))}
          </group>
        </>
      )}
    </group>
  );
}

/**
 * Orientation's belt (3.10): a handful of rocks, SEEDED from the student's own
 * rotation offset (the per-student value `GET /api/v1/cosmetics` derives), so
 * the same student sees the same belt every session. A plain LCG over a seed,
 * never Math.random and never a hash (the client derives nothing).
 */
function asteroidBelt(
  rotation: number,
  size: number,
): Array<{ r: number; a0: number; y: number; s: number; squash: number; tilt: number }> {
  let s = Math.floor(Math.abs(rotation) * 1e6) >>> 0 || 7;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  const n = 9 + Math.floor(rand() * 5);
  return Array.from({ length: n }, () => ({
    r: size + 1.1 + rand() * 1.1,
    a0: rand() * Math.PI * 2,
    y: (rand() - 0.5) * 0.18,
    s: 0.05 + rand() * 0.07,
    squash: 0.55 + rand() * 0.5,
    tilt: rand() * Math.PI,
  }));
}

/**
 * The camera: Starfield's tilted view of the whole system, easing to a
 * selected planet and back out. Fits the system to the screen's aspect, so a
 * portrait phone sees every orbit; shifts the picture right of the side panel
 * on a wide screen. Drag yaws the system (the page owns `yaw`). Also carries
 * and the frame-rate guard.
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
    const planetPos = p.selected ? p.positions.current.get(p.selected) : undefined;
    // A chosen moon: the camera eases on to it, closer than to a planet (3.2).
    const moonPos = p.selectedMoon ? p.positions.current.get(`moon:${p.selectedMoon}`) : undefined;
    const selPos = moonPos ?? planetPos;
    const wantTarget = selPos ?? tmp.set(0, 0, 0);
    const near = moonPos ? 7 : 16;
    const wantDist = selPos ? Math.min(fit, near * Math.max(1, (0.55 * H) / Math.max(1, fr.h))) : fit;
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

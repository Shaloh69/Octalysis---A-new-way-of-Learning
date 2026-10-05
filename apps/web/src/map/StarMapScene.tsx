import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  Mesh,
  Plane,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  Sprite,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { allTextureFiles, moonSkin, skinFor, SUN_MAP, type BodySkin, type RingStyle } from "../solar-system/bodies";
import { bodyOrbit, ellipsePoints, positionAt } from "../solar-system/kepler";
import { populations, SUN_SPIN_S } from "../solar-system/populations";
import { BODY_SCALE, MOON_SIZE, moonOrbitsOf, irregularShape, isGiant, isIrregular, moonDirection, planetSize, ringBands, ringSpan, rocheLimit } from "../solar-system/satellites";
import { Leftovers } from "./Leftovers";
import { HOME, clampPan, zoomToward, type ViewControl } from "./view";

/** The plane the system lies in, for finding what is under the pointer. */
const PLANE = new Plane(new Vector3(0, 1, 0), 0);
import { planetSkinKey } from "../solar-system/world";
import { SUN_RADIUS, type SolarLayout } from "../solar-system/layout";
import { orbitAngle } from "../solar-system/orbit";


/** How far a planet's own system reaches from its centre: its outermost moon's orbit, or the planet itself. */
function systemReach(pl: ScenePlanet, rotation: number, scale: number): number {
  const kind = skinFor(planetSkinKey(pl.id, pl.ring, pl.spoke, rotation)).kind;
  const size = planetSize(pl.moons.length, kind, scale);
  if (!pl.moons.length) return size * 2.6;
  const orbits = moonOrbitsOf({ planetId: pl.id, kind, moonIds: pl.moons.map((m) => m.id), size, scale, seed: rotation });
  return Math.max(...orbits.map((o) => o.a * (1 + o.e))) + MOON_SIZE * scale * 2;
}

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
  /** The student's own zoom, tilt and pan, and the gestures queued for the Rig (view.ts). */
  view: MutableRefObject<ViewControl>;
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
  // Bodies are drawn at one fixed scale (R4.9): wider orbits no longer grow the planets.
  const scale = BODY_SCALE;
  const pops = useMemo(() => populations(p.layout, p.rotation, p.lowQuality), [p.layout, p.rotation, p.lowQuality]);
  const ellipses = useMemo(
    () =>
      p.planets.flatMap((pl) => {
        const b = p.layout.bodies.get(pl.id);
        return b ? [{ a: b.radius, e: b.e ?? 0, omega: (b.omega ?? 0) + p.rotation }] : [];
      }),
    [p.planets, p.layout, p.rotation],
  );
  // The chosen planet's own orbit, drawn clearly over the faint rest.
  const chosenOrbit = useMemo(() => {
    const b = p.selected ? p.layout.bodies.get(p.selected) : undefined;
    return b ? [{ a: b.radius, e: b.e ?? 0, omega: (b.omega ?? 0) + p.rotation }] : null;
  }, [p.selected, p.layout, p.rotation]);
  // The giants (the worlds beyond the frost line): each carries Trojans at L4 and L5 (R4.8).
  const giants = useMemo(
    () => p.planets.filter((pl) => isGiant(skinFor(planetSkinKey(pl.id, pl.ring, pl.spoke, p.rotation)).kind)).map((pl) => pl.id),
    [p.planets, p.rotation],
  );

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
      {/* R4.7: each level a faint band, one planet per orbit inside it; the frost line between L2 and L3. */}
      <LevelBands bands={p.layout.bands} color={colors.line} />
      <FrostLine radius={p.layout.frost.radius} color={colors.glow} />
      <OrbitLines orbits={ellipses} color={colors.line} clock={clock} base={p.selected ? 0.07 : 0.13} breathe />
      {chosenOrbit && <OrbitLines orbits={chosenOrbit} color={colors.corner} clock={clock} base={0.7} />}
      <Leftovers pops={pops} layout={p.layout} rotation={p.rotation} giants={giants} lowQuality={p.lowQuality} clock={clock} colors={colors} />
      {p.planets.map((pl) => (
        <Planet
          key={pl.id}
          planet={pl}
          layout={p.layout}
          scale={scale}
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
      <Rig {...p} edge={p.layout.bands[p.layout.bands.length - 1]!.outer} positions={positions} />
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

/**
 * Orbits drawn as ONE set of line segments: one draw for all of them (R5.3).
 *
 * Faint by default (instructor, 5 Oct 2026: "only show the lines of a
 * selected planet or moon; the rest should be less visible or just fade in
 * and out"). With `breathe`, the opacity rises and falls slowly on the
 * scene's one clock, so reduced motion holds it still. A chosen body's orbit
 * is its own OrbitLines, drawn clearly in the selection colour.
 */
function OrbitLines({
  orbits, color, clock, base, breathe = false, segs = 160,
}: {
  orbits: ReadonlyArray<{ a: number; e: number; omega: number }>;
  color: Color;
  clock: MutableRefObject<number>;
  base: number;
  breathe?: boolean;
  segs?: number;
}): JSX.Element {
  const mat = useRef<LineBasicMaterial>(null);
  const arr = useMemo(() => {
    const out = new Float32Array(orbits.length * segs * 2 * 3);
    let o = 0;
    for (const orbit of orbits) {
      const pts = ellipsePoints(orbit, segs);
      for (let i = 0; i < segs; i++) {
        for (const pt of [pts[i]!, pts[i + 1]!]) {
          out[o++] = pt.x;
          out[o++] = 0;
          out[o++] = pt.y;
        }
      }
    }
    return out;
  }, [orbits, segs]);
  useFrame(() => {
    if (!mat.current) return;
    const k = breathe ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((2 * Math.PI * clock.current) / BREATH_S)) : 1;
    mat.current.opacity = base * k;
  });
  return (
    <lineSegments raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[arr, 3]} />
      </bufferGeometry>
      <lineBasicMaterial ref={mat} color={color} transparent opacity={base} depthWrite={false} />
    </lineSegments>
  );
}

/** Seconds for one slow breath of the faint orbits. */
const BREATH_S = 9;

/**
 * The levels' bands (R4.7: a level is a band of orbits, so distance still
 * reads as level), all seven in ONE flat mesh in the plane, drawn in one pass
 * (R5.3; seven transparent double-sided rings were fourteen draws).
 */
function LevelBands({ bands, color }: { bands: ReadonlyArray<{ inner: number; outer: number }>; color: Color }): JSX.Element {
  const geo = useMemo(() => {
    const seg = 128;
    const pos = new Float32Array(bands.length * (seg + 1) * 2 * 3);
    const index: number[] = [];
    let v = 0;
    bands.forEach((b) => {
      const base = v;
      for (let i = 0; i <= seg; i++) {
        const t = (i / seg) * Math.PI * 2;
        for (const r of [b.inner, b.outer]) {
          pos[v * 3] = Math.cos(t) * r;
          pos[v * 3 + 2] = Math.sin(t) * r;
          v++;
        }
      }
      for (let i = 0; i < seg; i++) {
        const k = base + i * 2;
        index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setIndex(index);
    return g;
  }, [bands]);
  return (
    <mesh geometry={geo} raycast={() => null}>
      <meshBasicMaterial color={color} transparent opacity={0.05} side={DoubleSide} forceSinglePass depthWrite={false} />
    </mesh>
  );
}

/** The frost line: rocky worlds inside it, gas and ice giants beyond (R4.7). Dashed: a boundary, not an orbit. */
function FrostLine({ radius, color }: { radius: number; color: Color }): JSX.Element {
  const arr = useMemo(() => {
    const n = 220;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      out[i * 3] = Math.cos(t) * radius;
      out[i * 3 + 2] = Math.sin(t) * radius;
    }
    return out;
  }, [radius]);
  return (
    <lineLoop raycast={() => null} onUpdate={(l) => l.computeLineDistances()}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[arr, 3]} />
      </bufferGeometry>
      <lineDashedMaterial color={color} dashSize={0.6} gapSize={0.5} transparent opacity={0.55} />
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
    // Prograde, the way its planets go round and its field lines wind (R4.8).
    if (body.current) body.current.rotation.y -= (dt * Math.PI * 2) / SUN_SPIN_S;
    if (map) map.offset.x = (map.offset.x + dt * 0.003) % 1;
    corona.current?.scale.setScalar(CORONA * (1 + 0.05 * Math.sin(t.current * 0.9)));
    halo.current?.scale.setScalar(HALO * (1 + 0.035 * Math.sin(t.current * 0.55 + 1.3)));
  });
  return (
    <group>
      <mesh ref={body}>
        <sphereGeometry args={[SUN_RADIUS, 48, 48]} />
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

/** The corona's and the halo's widths, in scene units, in proportion to the sun (R4.9: twice R4.7's 1.7). */
const CORONA = SUN_RADIUS * 3.4;
const HALO = SUN_RADIUS * 5.2;

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

/** The faint rings' grey: unshaded, a little under white, so a dusty ring never outshines its planet. Not a palette colour. */
const RING_TINT = new Color(0.82, 0.82, 0.82);

/**
 * A faint ring's radial profile (R4.8, `satellites.ts`'s `ringBands`, every
 * band inside the Roche limit), painted once per style on a strip: x runs
 * from the ring's inner edge to its outer, the alpha is each band's.
 */
const faintRings = new Map<RingStyle, CanvasTexture>();
function faintRingTexture(style: RingStyle): CanvasTexture | null {
  const have = faintRings.get(style);
  if (have) return have;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  for (const b of ringBands(style)) {
    ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha})`;
    ctx.fillRect(Math.floor(b.from * 512), 0, Math.max(1, Math.ceil((b.to - b.from) * 512)), 1);
  }
  const tex = new CanvasTexture(c);
  faintRings.set(style, tex);
  return tex;
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
  shape,
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
  /** A captured moon's three axes (R4.8): a lumpy, faceted body instead of a sphere. */
  shape?: [number, number, number] | undefined;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}): JSX.Element {
  const spin = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);
  const surface = textures.get(skin.map);
  const faint = useMemo(() => (skin.faintRing ? faintRingTexture(skin.faintRing) : null), [skin.faintRing]);
  const faintGeo = useMemo(() => (skin.faintRing ? radialRing(...ringSpan(size)) : null), [skin.faintRing, size]);
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
  const ringGeo = useMemo(() => (skin.ring ? radialRing(...ringSpan(size)) : null), [skin.ring, size]);

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
        scale={shape ?? [1, skin.oblate, 1]}
        {...(onClick
          ? {
              onClick,
              onPointerOver: () => (document.body.style.cursor = "pointer"),
              onPointerOut: () => (document.body.style.cursor = ""),
            }
          : {})}
      >
        {shape ? <icosahedronGeometry args={[size, 1]} /> : <sphereGeometry args={[size, segments, segments]} />}
        <meshStandardMaterial
          key={map ? "surface" : "tint"}
          color={tint}
          map={map ?? null}
          emissive={map ? WHITE : fallback}
          emissiveMap={map ?? null}
          emissiveIntensity={glow}
          roughness={skin.kind === "gas" || skin.kind === "ringed" ? 0.7 : 0.95}
          metalness={0}
          flatShading={!!shape}
        />
      </mesh>
      {faint && faintGeo && (
        <mesh geometry={faintGeo} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <meshBasicMaterial map={faint} color={dim ?? RING_TINT} transparent side={DoubleSide} forceSinglePass depthWrite={false} />
        </mesh>
      )}
      {clouds && (
        <mesh ref={cloudRef} scale={[1, skin.oblate, 1]} raycast={() => null}>
          <sphereGeometry args={[size * 1.025, segments, segments]} />
          <meshStandardMaterial key={clouds.uuid} color={dim ?? WHITE} alphaMap={clouds} transparent depthWrite={false} opacity={0.9} />
        </mesh>
      )}
      {ringGeo && ringTex && (
        <mesh geometry={ringGeo} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <meshBasicMaterial key={ringTex.uuid} map={ringTex} color={dim ?? WHITE} transparent side={DoubleSide} forceSinglePass depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

interface PlanetProps {
  planet: ScenePlanet;
  layout: SolarLayout;
  /** BODY_SCALE (satellites.ts): how large planets and moon systems are drawn. */
  scale: number;
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
 * Orientation's rocks circle on a faster clock, so they are seen to move. They
 * are not moons: the moons follow the planets' rules (`moonOrbitsOf`).
 */
const LOCAL_CLOCK = 10;

/* The moons' orbits are OrbitLines too, in Planet below. */

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
  // Moons orbit outside its Roche limit and inside its Hill sphere (satellites.ts, tested).
  const size = planetSize(p.planet.moons.length, skin.kind, p.scale);
  const moonMeshes = useRef<Array<Group | null>>([]);
  // The moons on the planets' rules (instructor, 5 Oct 2026; satellites.ts, tested).
  const moonOrbits = useMemo(
    () => moonOrbitsOf({ planetId: p.planet.id, kind: skin.kind, moonIds: p.planet.moons.map((m) => m.id), size, scale: p.scale, seed: p.rotation }),
    [p.planet.id, p.planet.moons, skin.kind, size, p.scale, p.rotation],
  );
  // A giant's outermost moons are captured irregulars, orbiting backwards (R4.8,
  // satellites.ts). Still moons: the same button, glow states and pick target.
  const captured = useMemo(() => {
    const n = p.planet.moons.length;
    return p.planet.moons.map((m, i) => ({
      dir: moonDirection(skin.kind, i, n, p.planet.id, p.rotation),
      shape: isIrregular(skin.kind, i, n, p.planet.id, p.rotation) ? irregularShape(m.id, p.rotation) : undefined,
    }));
  }, [p.planet.moons, p.planet.id, p.rotation, skin.kind]);
  const chosenMoonOrbit = useMemo(() => {
    const i = p.selectedMoon ? p.planet.moons.findIndex((m) => m.id === p.selectedMoon) : -1;
    return i >= 0 && moonOrbits[i] ? [moonOrbits[i]!] : null;
  }, [p.selectedMoon, p.planet.moons, moonOrbits]);
  const belt = useMemo(
    () => (p.planet.asteroids ? asteroidBelt(p.rotation, size, p.scale) : []),
    [p.planet.asteroids, p.rotation, size, p.scale],
  );
  // Its own ellipse, the sun at a focus, starting where the curriculum put it (R4.7, kepler.ts).
  // Its period from the star's mass (R4.8, orbit.ts).
  const orbit = useMemo(() => (body ? bodyOrbit(body, p.rotation) : null), [body, p.rotation]);
  const rocks = useRef<Array<Group | null>>([]);

  useFrame((_, dt) => {
    if (!body || !orbit || !group.current) return;
    const at = positionAt(orbit, p.clock.current);
    group.current.position.set(at.x, 0, at.y);
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
      const o = moonOrbits[i];
      if (!g || !o || !group.current) return;
      // Kepler around the planet; a captured moon runs its orbit backwards.
      const at = positionAt(o, p.clock.current * o.dir);
      g.position.set(at.x, 0, at.y);
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
            {moonOrbits.length > 0 && <OrbitLines orbits={moonOrbits} color={p.colors.line} clock={p.clock} base={0.12} breathe segs={96} />}
            {chosenMoonOrbit && <OrbitLines orbits={chosenMoonOrbit} color={p.colors.corner} clock={p.clock} base={0.75} segs={96} />}
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
                    size={MOON_SIZE * p.scale}
                    segments={20}
                    shape={captured[i]?.shape}
                    fallback={glow === "dim" ? p.colors.locked : tint}
                    dim={glow === "dim" ? p.colors.locked : null}
                    glow={glow === "full" ? 0.55 : glow === "partial" ? 0.22 : 0.02}
                    reduced={p.reduced}
                    onClick={pick}
                  />
                  <mesh onClick={pick} visible={false}>
                    <sphereGeometry args={[0.24 * p.scale, 8, 8]} />
                    <meshBasicMaterial />
                  </mesh>
                  {/* Mastered: bright (its emissive glow) and ringed. The ring is the shape
                      that says it; the halo sphere it once had cost a draw per moon and went
                      for R5.3's budget (5 Oct 2026). */}
                  {glow === "full" && (
                    <>
                      <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.19 * p.scale, 0.02 * p.scale, 6, 28]} />
                        <meshBasicMaterial color={p.colors.corner} />
                      </mesh>
                    </>
                  )}
                  {isSel && (
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[0.24 * p.scale, 0.03 * p.scale, 6, 32]} />
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
  scale: number,
): Array<{ r: number; a0: number; y: number; s: number; squash: number; tilt: number }> {
  let s = Math.floor(Math.abs(rotation) * 1e6) >>> 0 || 7;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  const n = 9 + Math.floor(rand() * 5);
  return Array.from({ length: n }, () => ({
    // Outside the Roche limit, like a moon: inside it, debris is a ring.
    r: rocheLimit(size) * 1.05 + rand() * 1.1 * scale,
    a0: rand() * Math.PI * 2,
    y: (rand() - 0.5) * 0.18,
    s: (0.05 + rand() * 0.07) * scale,
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
function Rig(p: SceneProps & { edge: number; positions: MutableRefObject<Map<string, Vector3>> }): null {
  const { camera, size } = useThree();
  const target = useRef(new Vector3());
  const dist = useRef<number | null>(null);
  const yawNow = useRef(0);
  const frames = useRef({ t: 0, n: 0, slow: 0, age: 0 });
  const tmp = useMemo(() => new Vector3(), []);
  const aim = useMemo(() => new Vector3(), []);
  const pan = useMemo(() => new Vector3(), []);
  const onPlane = useMemo(() => new Vector3(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const ray = useMemo(() => new Raycaster(), []);
  /** The view as drawn, easing toward the student's. */
  const now = useRef({ ...HOME });

  useFrame((_, dt) => {
    const W = size.width;
    const H = Math.max(1, size.height);
    const fr = p.frame ?? { x: 0, y: 0, w: W, h: H };
    const tan = Math.tan((20 * Math.PI) / 180);
    // Fit the tilted disc inside the free area: its width across the free
    // width, its foreshortened depth (≈ sin(pitch) of it) down the free height.
    // The width is exact: the disc's near side is closer to the camera and
    // projects wider, so a circle of radius R fills a half-width whose tangent
    // is t at d = R·√(1/t² + cos²pitch). Without the cos² term a portrait
    // phone clips the outer band by a few pixels a side (found R4.9).
    const PITCH = (58 * Math.PI) / 180;
    const tanW = tan * (Math.max(1, fr.w) / H);
    const byWidth = p.edge * Math.sqrt(1 / (tanW * tanW) + Math.cos(PITCH) ** 2) * 1.01;
    // R4.9 (instructor, 2 Oct 2026: "the map a tad bigger"): fitted to the outer
    // band's own edge, a little tighter than R4.7's 1.08 of its centre.
    const byHeight = ((p.edge * 0.86) / (tan * (Math.max(1, fr.h) / H))) * 0.98;
    const fit = Math.max(byWidth, byHeight);
    const planetPos = p.selected ? p.positions.current.get(p.selected) : undefined;
    // A chosen moon: the camera eases on to it, closer than to a planet (3.2).
    const moonPos = p.selectedMoon ? p.positions.current.get(`moon:${p.selectedMoon}`) : undefined;
    const selPos = moonPos ?? planetPos;
    const wantTarget = selPos ?? tmp.set(0, 0, 0);
    // A chosen planet's whole moon system fits the free area (R4.7: moons now
    // begin outside the Roche limit, so systems are wider than the old fixed 16).
    const scale = BODY_SCALE;
    const chosen = p.selected ? p.planets.find((pl) => pl.id === p.selected) : undefined;
    const reach = chosen ? systemReach(chosen, p.rotation, scale) : 0;
    const planetNear = (reach * 1.15) / (tan * (Math.max(1, Math.min(fr.w, fr.h)) / H));
    const near = moonPos ? 7 * scale : planetNear;
    const wantDist = selPos ? Math.min(fit, moonPos ? near * Math.max(1, (0.55 * H) / Math.max(1, fr.h)) : near) : fit;
    const k = p.reduced ? 1 : 1 - Math.exp(-dt * 6);

    /*
     * The student's own view (instructor, 5 Oct 2026; `view.ts`). The page
     * queues gestures in pixels; here a zoom finds the plane point under the
     * pointer (so it stays under it) and a pan turns pixels into distance at
     * the current zoom. The camera then eases to the view, or cuts under
     * reduced motion.
     */
    const vc = p.view.current;
    for (const z of vc.zoomAt) {
      ndc.set((z.x / W) * 2 - 1, -(z.y / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.ray.intersectPlane(PLANE, onPlane);
      const at = hit ?? target.current;
      vc.view = zoomToward(vc.view, z.f, { x: at.x, z: at.z }, { x: target.current.x, z: target.current.z });
    }
    vc.zoomAt = [];
    if (vc.panPx.dx !== 0 || vc.panPx.dy !== 0) {
      const perPx = (2 * (dist.current ?? wantDist) * tan) / H;
      const y = yawNow.current;
      const lift = Math.max(0.3, Math.sin(PITCH + now.current.tilt));
      vc.view = {
        ...vc.view,
        // Content follows the finger: the look-at point moves the other way.
        panX: vc.view.panX - vc.panPx.dx * perPx * Math.cos(y) - (vc.panPx.dy * perPx * Math.sin(y)) / lift,
        panZ: vc.view.panZ + vc.panPx.dx * perPx * Math.sin(y) - (vc.panPx.dy * perPx * Math.cos(y)) / lift,
      };
      vc.panPx = { dx: 0, dy: 0 };
    }
    vc.view = clampPan(vc.view, p.edge);
    const nv = now.current;
    nv.zoom += (vc.view.zoom - nv.zoom) * k;
    nv.tilt += (vc.view.tilt - nv.tilt) * k;
    nv.panX += (vc.view.panX - nv.panX) * k;
    nv.panZ += (vc.view.panZ - nv.panZ) * k;

    target.current.lerp(aim.copy(wantTarget).add(pan.set(nv.panX, 0, nv.panZ)), k);
    dist.current = dist.current === null ? wantDist : dist.current + (wantDist - dist.current) * k;
    yawNow.current += (p.yaw.current - yawNow.current) * (p.reduced ? 1 : 1 - Math.exp(-dt * 10));

    const pitch = PITCH + nv.tilt;
    const d = dist.current * nv.zoom;
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

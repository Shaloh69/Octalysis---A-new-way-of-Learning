import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { makeDotMaterial } from "./dots";
import { AdditiveBlending, BufferAttribute, Color, Group, InstancedMesh, Mesh, Object3D, Points, Vector3 } from "three";
import { bodyOrbit, lagrangePoint, orbitThrough, positionAt, radiusAt, type Orbit } from "../solar-system/kepler";
import type { SolarLayout } from "../solar-system/layout";
import {
  cometActivity,
  parkerField,
  trojanSwarms,
  SUN_SPIN_S,
  WIND_CROSSING_S,
  WIND_INNER,
  type Populations,
} from "../solar-system/populations";
import { starAngularSpeed } from "../solar-system/orbit";

/**
 * The system's leftovers (R4.7; the instructor's brief, 1 Oct 2026): the
 * asteroid belt at the frost line, dust, centaurs among the giants, the Kuiper
 * belt, the Oort cloud, comets with a coma and a tail near the star, and the
 * solar wind. R4.8 adds the Trojan swarms at L4 and L5 of every giant and the
 * star's magnetic field as Parker spirals. Where each sits is
 * `solar-system/populations.ts` (tested).
 *
 * COSMETIC, like the whole canvas (`aria-hidden`): small, grey or faint so no
 * one mistakes them for a planet or a moon, and UNPICKABLE (`raycast` is
 * empty on every object here), so nothing in them can be chosen. They move on
 * the scene's one clock, which reduced motion holds at 0.
 */

const noPick = () => null;

interface Props {
  pops: Populations;
  layout: SolarLayout;
  rotation: number;
  /** The giants' stage ids: each carries a Trojan swarm at L4 and at L5. */
  giants: readonly string[];
  lowQuality: boolean;
  clock: MutableRefObject<number>;
  colors: { line: Color; star: Color; glow: Color };
}

function Cloud({ positions, color, size, opacity, fixed = false }: { positions: Float32Array; color: Color; size: number; opacity: number; fixed?: boolean }): JSX.Element {
  if (!fixed) return <Dots positions={positions} color={color} size={size} opacity={opacity} />;
  return (
    <points raycast={noPick}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation={false} transparent opacity={opacity} depthWrite={false} />
    </points>
  );
}

/**
 * Round dots that never grow past a few pixels up close (map/dots.ts; the
 * belt and the Trojans were big squares when the camera came near, 6 Oct
 * 2026). The attenuation scale follows the drawing buffer's height.
 */
function useDotMaterial(color: Color, size: number, opacity: number) {
  const material = useMemo(() => makeDotMaterial(color, size, opacity), [color, size, opacity]);
  const height = useThree((s) => s.size.height * s.viewport.dpr);
  useEffect(() => {
    material.uniforms.uScale!.value = height / 2;
  }, [material, height]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

function Dots({ positions, color, size, opacity }: { positions: Float32Array; color: Color; size: number; opacity: number }): JSX.Element {
  const material = useDotMaterial(color, size, opacity);
  return (
    <points raycast={noPick} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
    </points>
  );
}

export function Leftovers({ pops, layout, rotation, giants, lowQuality, clock, colors }: Props): JSX.Element {
  const belt = useRef<Group>(null);
  const kuiper = useRef<Group>(null);
  const dust = useRef<Group>(null);
  const field = useRef<Group>(null);
  const centaurs = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const cometRefs = useRef<Array<Group | null>>([]);
  const wind = useRef<Points>(null);
  const trojans = useRef<Points>(null);
  const trojanDots = useDotMaterial(colors.star, 0.4, 0.85);

  // Every speed from the star's mass (R4.8, orbit.ts): the belts turn at their own distance's rate.
  const beltSpeed = starAngularSpeed((layout.frost.inner + layout.frost.outer) / 2);
  const kuiperSpeed = starAngularSpeed((layout.kuiper.inner + layout.kuiper.outer) / 2);
  const dustSpeed = starAngularSpeed(layout.frost.inner * 0.6);
  const orbits = useMemo(
    () => ({
      centaurs: pops.centaurs.map((c) => orbitThrough({ a: c.a, e: c.e, omega: c.omega + rotation, theta0: c.theta0 + rotation })),
      // At their real speed (R4.9: "much slower"): out at the edges nearly all the time, then in.
      comets: pops.comets.map((c) => orbitThrough({ a: c.a, e: c.e, omega: c.omega + rotation, theta0: c.theta0 + rotation })),
    }),
    [pops, rotation],
  );
  const windPositions = useMemo(() => new Float32Array(pops.wind.length * 3), [pops]);
  const windOuter = layout.frost.inner;
  const sun = useMemo(() => new Vector3(0, 0, 0), []);

  // The Trojans ride their giants' own orbits (the same ones the planets are drawn on).
  const swarms = useMemo(() => {
    const list = trojanSwarms(giants, rotation, lowQuality);
    return list.flatMap((s) => {
      const b = layout.bodies.get(s.planetId);
      return b ? [{ ...s, orbit: bodyOrbit(b, rotation) }] : [];
    });
  }, [giants, rotation, lowQuality, layout]);
  const trojanPositions = useMemo(() => new Float32Array(swarms.reduce((n, s) => n + s.members.length, 0) * 3), [swarms]);
  const fieldLines = useMemo(() => parkerField(layout, 12, 96), [layout]);

  useFrame(() => {
    const t = clock.current;
    // Turning one way, as the planets do (x towards z): rotation.y is the other sense.
    if (belt.current) belt.current.rotation.y = -(beltSpeed * t + rotation);
    if (kuiper.current) kuiper.current.rotation.y = -(kuiperSpeed * t + rotation);
    if (dust.current) dust.current.rotation.y = -(dustSpeed * t + rotation);
    // The field is the star's: it turns with the star, as the spirals do.
    if (field.current) field.current.rotation.y = -((2 * Math.PI * t) / SUN_SPIN_S + rotation);
    const cm = centaurs.current;
    if (cm) {
      orbits.centaurs.forEach((o: Orbit, i) => {
        const c = pops.centaurs[i]!;
        const p = positionAt(o, t);
        dummy.position.set(p.x, 0, p.y);
        dummy.scale.set(c.size, c.size * 0.7, c.size * 0.85);
        dummy.updateMatrix();
        cm.setMatrixAt(i, dummy.matrix);
      });
      cm.instanceMatrix.needsUpdate = true;
    }
    orbits.comets.forEach((o: Orbit, i) => {
      const g = cometRefs.current[i];
      if (!g) return;
      const p = positionAt(o, t);
      g.position.set(p.x, 0, p.y);
      const act = cometActivity(p.r, layout);
      const coma = g.children[1] as Mesh | undefined;
      const tail = g.children[2] as Mesh | undefined;
      if (coma) {
        coma.visible = act > 0;
        coma.scale.setScalar(0.2 + act * 0.9);
      }
      if (tail) {
        tail.visible = act > 0;
        // The tail points away from the star, longer the closer it falls.
        const len = 0.5 + act * 6;
        tail.scale.set(1, len, 1);
        g.lookAt(sun);
        tail.position.set(0, 0, -len / 2);
      }
    });
    const w = wind.current;
    if (w) {
      const span = windOuter - WIND_INNER;
      pops.wind.forEach((p, i) => {
        const r = WIND_INNER + ((((p.phase + t / WIND_CROSSING_S) % 1) + 1) % 1) * span;
        windPositions[i * 3] = p.dx * r;
        windPositions[i * 3 + 1] = p.y;
        windPositions[i * 3 + 2] = p.dz * r;
      });
      (w.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    }
    const tr = trojans.current;
    if (tr) {
      let o = 0;
      for (const s of swarms) {
        const L = lagrangePoint(s.orbit, t, s.side);
        for (const m of s.members) {
          const theta = L.theta + m.dTheta;
          const r = radiusAt(s.orbit, theta) + m.dr;
          trojanPositions[o++] = Math.cos(theta) * r;
          trojanPositions[o++] = m.y;
          trojanPositions[o++] = Math.sin(theta) * r;
        }
      }
      (tr.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group>
      <group ref={field}>
        {/* The star's magnetic field: twelve Parker spirals, one draw. */}
        <lineSegments raycast={noPick}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[fieldLines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={colors.glow} transparent opacity={0.09} depthWrite={false} />
        </lineSegments>
      </group>
      <group ref={dust}>
        <Cloud positions={pops.dust} color={colors.star} size={0.22} opacity={0.3} />
      </group>
      <group ref={belt}>
        <Cloud positions={pops.belt} color={colors.star} size={0.55} opacity={0.9} />
      </group>
      <group ref={kuiper}>
        <Cloud positions={pops.kuiper} color={colors.star} size={0.45} opacity={0.7} />
      </group>
      {/* The Oort cloud is as far out as the camera (R4.9), so it is drawn in pixels, as the stars are: never a square up close. */}
      <Cloud positions={pops.oort} color={colors.star} size={2} opacity={0.45} fixed />
      {/* Every giant's Trojans, at L4 and L5: one draw for all of them. */}
      <points ref={trojans} raycast={noPick} material={trojanDots}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trojanPositions, 3]} />
        </bufferGeometry>
      </points>
      {/* Every centaur, one draw (R5.3: they were a mesh each). They roam the whole system, so never culled as one. */}
      <instancedMesh ref={centaurs} args={[undefined, undefined, pops.centaurs.length]} raycast={noPick} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color={colors.line} flatShading />
      </instancedMesh>
      {pops.comets.map((c, i) => (
        <group
          key={`k${i}`}
          ref={(g) => {
            cometRefs.current[i] = g;
          }}
        >
          <mesh raycast={noPick}>
            <sphereGeometry args={[c.size, 8, 8]} />
            <meshBasicMaterial color={colors.line} />
          </mesh>
          <mesh raycast={noPick}>
            <sphereGeometry args={[0.45, 16, 16]} />
            <meshBasicMaterial color={colors.glow} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh raycast={noPick} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.35, 1, 12, 1, true]} />
            <meshBasicMaterial color={colors.glow} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <points ref={wind} raycast={noPick}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[windPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={colors.glow} size={0.07} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
      </points>
    </group>
  );
}

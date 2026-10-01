import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, Color, Group, Mesh, Points, Vector3 } from "three";
import { orbitThrough, positionAt, type Orbit } from "../solar-system/kepler";
import type { SolarLayout } from "../solar-system/layout";
import { cometActivity, type Populations } from "../solar-system/populations";
import { angularSpeed } from "../solar-system/orbit";

/**
 * The system's leftovers (R4.7; the instructor's brief, 1 Oct 2026): the
 * asteroid belt at the frost line, dust, centaurs among the giants, the Kuiper
 * belt, the Oort cloud, comets with a coma and a tail near the star, and the
 * solar wind. Where each sits is `solar-system/populations.ts` (tested).
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
  outer: number;
  rotation: number;
  clock: MutableRefObject<number>;
  colors: { line: Color; star: Color; glow: Color };
}

function Cloud({ positions, color, size, opacity }: { positions: Float32Array; color: Color; size: number; opacity: number }): JSX.Element {
  return (
    <points raycast={noPick}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={opacity} depthWrite={false} />
    </points>
  );
}

export function Leftovers({ pops, layout, outer, rotation, clock, colors }: Props): JSX.Element {
  const belt = useRef<Group>(null);
  const kuiper = useRef<Group>(null);
  const dust = useRef<Group>(null);
  const centaurRefs = useRef<Array<Mesh | null>>([]);
  const cometRefs = useRef<Array<Group | null>>([]);
  const wind = useRef<Points>(null);

  const beltSpeed = angularSpeed((layout.frost.inner + layout.frost.outer) / 2, outer);
  const kuiperSpeed = angularSpeed((layout.kuiper.inner + layout.kuiper.outer) / 2, outer);
  const dustSpeed = angularSpeed(layout.frost.inner * 0.6, outer);
  const orbits = useMemo(
    () => ({
      centaurs: pops.centaurs.map((c) => orbitThrough({ a: c.a, e: c.e, omega: c.omega + rotation, theta0: c.theta0 + rotation, outerA: outer })),
      // A comet's period at its true semi-major axis would be centuries of
      // screen time: its clock runs 40x, so one is seen falling in and out.
      comets: pops.comets.map((c) => orbitThrough({ a: c.a, e: c.e, omega: c.omega + rotation, theta0: c.theta0 + rotation, outerA: outer })),
    }),
    [pops, rotation, outer],
  );
  const windPositions = useMemo(() => new Float32Array(pops.wind.length * 3), [pops]);
  const windInner = 2.4;
  const windOuter = layout.frost.inner;
  const sun = useMemo(() => new Vector3(0, 0, 0), []);

  useFrame(() => {
    const t = clock.current;
    // Turning one way, as the planets do (x towards z): rotation.y is the other sense.
    if (belt.current) belt.current.rotation.y = -(beltSpeed * t + rotation);
    if (kuiper.current) kuiper.current.rotation.y = -(kuiperSpeed * t + rotation);
    if (dust.current) dust.current.rotation.y = -(dustSpeed * t + rotation);
    orbits.centaurs.forEach((o: Orbit, i) => {
      const m = centaurRefs.current[i];
      if (!m) return;
      const p = positionAt(o, t);
      m.position.set(p.x, 0, p.y);
    });
    orbits.comets.forEach((o: Orbit, i) => {
      const g = cometRefs.current[i];
      if (!g) return;
      const p = positionAt(o, t * 40);
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
      const span = windOuter - windInner;
      pops.wind.forEach((p, i) => {
        const r = windInner + (((p.phase + t * 0.05) % 1) + 1) % 1 * span;
        windPositions[i * 3] = p.dx * r;
        windPositions[i * 3 + 1] = p.y;
        windPositions[i * 3 + 2] = p.dz * r;
      });
      (w.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group>
      <group ref={dust}>
        <Cloud positions={pops.dust} color={colors.star} size={0.22} opacity={0.3} />
      </group>
      <group ref={belt}>
        <Cloud positions={pops.belt} color={colors.star} size={0.55} opacity={0.9} />
      </group>
      <group ref={kuiper}>
        <Cloud positions={pops.kuiper} color={colors.star} size={0.45} opacity={0.7} />
      </group>
      <Cloud positions={pops.oort} color={colors.star} size={0.6} opacity={0.45} />
      {pops.centaurs.map((c, i) => (
        <mesh
          key={`c${i}`}
          ref={(m) => {
            centaurRefs.current[i] = m;
          }}
          scale={[c.size, c.size * 0.7, c.size * 0.85]}
          raycast={noPick}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshLambertMaterial color={colors.line} flatShading />
        </mesh>
      ))}
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

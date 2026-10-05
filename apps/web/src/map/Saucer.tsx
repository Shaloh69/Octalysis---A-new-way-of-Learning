import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { AdditiveBlending, Color, Group, Vector3 } from "three";
import { alienComet, alienFirstPass, alienNear, alienOrbit } from "../solar-system/alien";
import { positionAt } from "../solar-system/kepler";
import type { SolarLayout } from "../solar-system/layout";
import type { Populations } from "../solar-system/populations";
import { BODY_SCALE } from "../solar-system/satellites";

/**
 * The easter egg's saucer (instructor, 5 Oct 2026; `solar-system/alien.ts`).
 * It rides a comet's ellipse on the scene's one clock (so reduced motion holds
 * it), bobs and spins a little, and is the one thing in the leftovers that can
 * be clicked: a generous invisible sphere, for a thumb. Each frame it writes
 * where it is on screen to the page's anchor (`data-alien`, `left`/`top`), so
 * the speech bubble follows it. Colours are tokens, read by the scene.
 */

/** With ?alien=now the saucer is this many seconds past perihelion: outbound, in the inner system, clear of the sun. */
const NOW_PAST_S = 12;

export interface SaucerColors {
  hull: Color;
  dome: Color;
  alien: Color;
  eyes: Color;
}

export function Saucer({
  pops, layout, rotation, now, clock, colors, positions, anchor, focused, onClick,
}: {
  pops: Populations;
  layout: SolarLayout;
  rotation: number;
  /** `?alien=now`: just past perihelion at t = 0, outbound and clear of the sun. */
  now: boolean;
  clock: MutableRefObject<number>;
  colors: SaucerColors;
  positions: MutableRefObject<Map<string, Vector3>>;
  anchor: MutableRefObject<HTMLElement | null>;
  focused: boolean;
  onClick: () => void;
}): JSX.Element | null {
  const { camera, size } = useThree();
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const v = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);
  const k = alienComet(pops.comets, rotation);
  const orbit = useMemo(
    () => (k >= 0 ? alienOrbit(pops.comets[k]!, rotation, now ? -NOW_PAST_S : alienFirstPass(rotation)) : null),
    [pops, k, rotation, now],
  );
  const s = BODY_SCALE * 0.9;

  useFrame(() => {
    const g = group.current;
    if (!g || !orbit) return;
    const t = clock.current;
    const p = positionAt(orbit, t);
    g.position.set(p.x, 0.6 * s + Math.sin(t * 2.2) * 0.15 * s, p.y);
    if (body.current) {
      body.current.rotation.y = t * 1.6;
      body.current.rotation.z = Math.sin(t * 1.3) * 0.12;
    }
    const w = positions.current.get("alien") ?? new Vector3();
    w.copy(g.position);
    positions.current.set("alien", w);
    // Where it is on screen, for the bubble (and a spec's click).
    const el = anchor.current;
    if (el) {
      v.copy(g.position).project(camera);
      // Its drawn radius on screen, so the bubble sits above the saucer, not on the alien's face.
      up.set(0, s * 1.1, 0).applyQuaternion(camera.quaternion).add(g.position).project(camera);
      const rPx = Math.hypot((up.x - v.x) * size.width, (up.y - v.y) * size.height) / 2;
      const on = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      el.style.left = `${((v.x + 1) / 2) * size.width}px`;
      el.style.top = `${((1 - v.y) / 2) * size.height}px`;
      el.style.setProperty("--alien-r", `${Math.round(rPx)}px`);
      el.dataset.alien = focused ? "focused" : on && alienNear(orbit, t, layout.frost.radius) ? "near" : "away";
    }
  });
  if (!orbit) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <group ref={group}>
      <group ref={body} scale={s}>
        {/* The hull: a flattened disc, metallic, catching the sun. */}
        <mesh scale={[1, 0.22, 1]} onClick={click}>
          <sphereGeometry args={[1, 28, 14]} />
          <meshStandardMaterial color={colors.hull} metalness={0.6} roughness={0.35} emissive={colors.hull} emissiveIntensity={0.45} />
        </mesh>
        {/* The alien, riding it: a round head with two big eyes. */}
        <mesh position={[0, 0.38, 0]}>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={colors.alien} roughness={0.6} emissive={colors.alien} emissiveIntensity={0.25} />
        </mesh>
        {/* Up close only (focused): at overview the saucer is a few pixels across, and the
            dome and eyes would be three draw calls nobody can see (R5.3's budget). */}
        {focused && (
          <>
            {/* The glass dome, glowing faintly. */}
            <mesh position={[0, 0.18, 0]} onClick={click}>
              <sphereGeometry args={[0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshBasicMaterial color={colors.dome} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
            {[-0.085, 0.085].map((x) => (
              <mesh key={x} position={[x, 0.45, 0.19]} rotation={[0, 0, x > 0 ? -0.35 : 0.35]} scale={[0.75, 1.25, 0.5]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshBasicMaterial color={colors.eyes} />
              </mesh>
            ))}
          </>
        )}
      </group>
      {/* A generous target, so a phone's thumb can catch a moving saucer. */}
      <mesh onClick={click} visible={false}>
        <sphereGeometry args={[2.2 * s, 10, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
// Named imports, not `import * as THREE`. A namespace import defeats
// tree-shaking and pulled the whole library in -- the chunk came out at 269 KB
// gzipped against a documented budget of 250 KB in VISUAL-SYSTEM-3D.md 5.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
} from "three";
import type { NodePosition } from "../lib/layout";
import type { StageNode } from "../lib/api";

/**
 * The galaxy — the presentation layer over the map.
 *
 * This file may not be the only thing that knows anything. It is aria-hidden and
 * pointer-events: none; every click, label and announcement is handled by the
 * DOM layer in StageMap.tsx. If this file fails to load, the map still works.
 *
 * Colours are read from the CSS custom properties in packages/tokens at scene
 * setup, never written as literals — the per-student accent system depends on
 * every colour flowing through a token, and the repo hook blocks a literal hex
 * in apps/ anyway.
 */

interface Props {
  nodes: StageNode[];
  positions: Map<string, NodePosition>;
}

/** Read a resolved CSS custom property as a THREE.Color. */
function tokenColor(name: string, fallbackHsl: [number, number, number]): Color {
  if (typeof window === "undefined") return new Color().setHSL(...fallbackHsl);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return new Color().setHSL(...fallbackHsl);
  try {
    return new Color(raw);
  } catch {
    return new Color().setHSL(...fallbackHsl);
  }
}

/** One instanced buffer, not N meshes. VISUAL-SYSTEM-3D.md §5. */
function StarField({ count = 2200 }: { count?: number }): JSX.Element {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    // A deterministic scatter: the sky should be the same every session, for the
    // same reason the map is.
    let seed = 0x9e3779b9;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < count; i++) {
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

  const color = useMemo(() => tokenColor("--ink-dim", [0.6, 0.1, 0.7]), []);

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.7} sizeAttenuation color={color} transparent opacity={0.55} />
    </points>
  );
}

function StageNodes({ nodes, positions }: Props): JSX.Element {
  const accent = useMemo(() => tokenColor("--accent", [0.08, 0.55, 0.5]), []);
  const dim = useMemo(() => tokenColor("--ink-dim", [0.6, 0.05, 0.35]), []);
  const lit = useMemo(() => tokenColor("--ink", [0.6, 0.05, 0.85]), []);

  return (
    <group>
      {nodes.map((n) => {
        const p = positions.get(n.id);
        if (!p) return null;
        const locked = n.state === "locked";
        const mastered = n.state === "mastered";
        return (
          <mesh key={n.id} position={[p.x3, p.y3, p.z3]}>
            <sphereGeometry args={[mastered ? 0.75 : 0.55, 16, 16]} />
            <meshBasicMaterial
              color={locked ? dim : mastered ? accent : lit}
              transparent
              opacity={locked ? 0.28 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Edges({ nodes, positions, edges }: Props & { edges: Array<{ from: string; to: string }> }): JSX.Element {
  const stateById = useMemo(() => new Map(nodes.map((n) => [n.id, n.state])), [nodes]);
  const color = useMemo(() => tokenColor("--ink-dim", [0.6, 0.05, 0.35]), []);

  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (const e of edges) {
      const a = positions.get(e.from);
      const b = positions.get(e.to);
      if (!a || !b) continue;
      pts.push(a.x3, a.y3, a.z3, b.x3, b.y3, b.z3);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [edges, positions]);

  void stateById;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.35} />
    </lineSegments>
  );
}

/** Very slow drift. Stops entirely when the tab is hidden. */
function Drift(): null {
  const { current: state } = useRef({ t: 0 });
  useFrame((three, delta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    state.t += delta;
    three.camera.position.x = Math.cos(state.t * 0.045) * 46;
    three.camera.position.z = Math.sin(state.t * 0.045) * 46;
    three.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function GalaxyCanvas({ nodes, positions }: Props): JSX.Element | null {
  const [failed, setFailed] = useState(false);

  // If WebGL is unavailable the canvas simply never appears. No error state:
  // the DOM map is already on screen and nothing is missing.
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) setFailed(true);
    } catch {
      setFailed(true);
    }
  }, []);

  const edges = useMemo(
    () => nodes.flatMap((n) => n.prereq.map((from) => ({ from, to: n.id }))),
    [nodes],
  );

  if (failed) return null;

  return (
    <Canvas
      // `demand` would freeze the drift; the drift itself skips work when the
      // tab is hidden, which is the battery case that matters.
      camera={{ position: [46, 14, 46], fov: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      dpr={[1, 1.6]}
    >
      <StarField />
      <Edges nodes={nodes} positions={positions} edges={edges} />
      <StageNodes nodes={nodes} positions={positions} />
      <Drift />
    </Canvas>
  );
}

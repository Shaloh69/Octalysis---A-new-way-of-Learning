import pathlib, sys

# ---------------------------------------------------------------- canvas
c = pathlib.Path('apps/web/src/solar-system/SolarSystemCanvas.tsx')
s = c.read_text(encoding='utf-8')
E = []

E.append(("""  projection: React.MutableRefObject<Map<string, ScreenPoint>>;
}""",
"""  projection: React.MutableRefObject<Map<string, ScreenPoint>>;
  /**
   * The stage whose planet the camera should fly to, or null to drift.
   *
   * `GAME-DESIGN.md` §3.2 settled the interaction: clicking a body eases the
   * camera to it rather than cutting. It named `cameraPosition(..., duration)`
   * from react-force-graph — which is not installed, and was not installed
   * precisely because `VISUAL-SYSTEM-3D.md` §5 dropped dependencies that were
   * doing one small job. So the easing is here, in `useFrame`, which is where
   * that file already says camera moves belong.
   */
  focusId: string | null;
}"""))

E.append(("""function Drift({ frozen, distance }: { frozen: boolean; distance: number }): null {
  const t = useRef(0);

  useFrame((three, delta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (!frozen) t.current += delta;
    three.camera.position.x = Math.cos(t.current * 0.035) * distance;
    three.camera.position.z = Math.sin(t.current * 0.035) * distance;
    three.camera.position.y = distance * 0.42;
    three.camera.lookAt(0, 0, 0);
  });

  return null;
}""",
"""function Drift({
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
       * Fly to the planet: sit off it, along the line from the sun outward, so
       * the body is framed against open space rather than against the middle of
       * the system.
       *
       * The scene keeps drifting behind an open HUD in the sense that nothing
       * is destroyed, but the camera stops orbiting — §2 requires the
       * background to stop animating while the dialog is open, and a camera
       * still sweeping past the planet you just selected is the opposite of
       * "focus".
       */
      const out = Math.hypot(focus.x, focus.z) || 1;
      target.current.set(
        focus.x + (focus.x / out) * 5.5,
        distance * 0.30,
        focus.z + (focus.z / out) * 5.5,
      );
      look.current.set(focus.x, focus.y, focus.z);
      // Frame-rate independent easing. `frozen` (reduced motion) jumps
      // straight there: state still changes, it just changes instantly.
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
}"""))

E.append(("""  rotationOffset,
  paletteVariant,
  projection,
}: Props): JSX.Element | null {""",
"""  rotationOffset,
  paletteVariant,
  projection,
  focusId,
}: Props): JSX.Element | null {"""))

E.append(("""      <Drift frozen={frozen} distance={distance} />""",
"""      <Drift frozen={frozen} distance={distance} focus={focus} />"""))

E.append(("""  // Frame the whole system: outermost ring plus a small margin.""",
"""  /*
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

  // Frame the whole system: outermost ring plus a small margin."""))

missing = [o.splitlines()[0][:55] for o, _ in E if o not in s]
if missing:
    print("CANVAS NOT FOUND:", missing); sys.exit(1)
for o, n in E:
    s = s.replace(o, n, 1)
c.write_text(s, encoding='utf-8')
print("canvas: camera focus wired")

# ---------------------------------------------------------------- StageMap
m = pathlib.Path('apps/web/src/components/StageMap.tsx')
s = m.read_text(encoding='utf-8')
E2 = []

E2.append(('import type { ScreenPoint } from "../solar-system/SolarSystemCanvas";',
           'import type { ScreenPoint } from "../solar-system/SolarSystemCanvas";\n'
           'import { PlanetHud } from "../solar-system/PlanetHud";'))

E2.append(("""  const projection = useRef<Map<string, ScreenPoint>>(new Map());""",
"""  const projection = useRef<Map<string, ScreenPoint>>(new Map());

  /*
   * The selected planet, and the reason this exists.
   *
   * Clicking a planet used to call `onOpen` directly, which navigated straight
   * to `/app/stage/:id`. So the whole §2 interaction — camera fly-in, HUD, the
   * printed lock reason, "Enter" — had never been built: the click was wired
   * to the destination, skipping the step in between. `GAME-DESIGN.md` §2 is
   * explicit that clicking a body opens a dialog *which then offers* Enter.
   *
   * The stage route is still exactly one click further on, from the HUD's own
   * button.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? data.nodes.find((n) => n.id === selectedId) ?? null : null;

  // Escape closes from anywhere, not only from inside the panel.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);"""))

E2.append(("""              projection={projection}
            />""",
"""              projection={projection}
              focusId={selectedId}
            />"""))

E2.append(("""          <PlanetHits data={data} projection={projection} onOpen={onOpen} />""",
"""          <PlanetHits data={data} projection={projection} onOpen={setSelectedId} />"""))

E2.append(("""      <ActList data={data} onOpen={onOpen} />""",
"""      {/* The HUD is the map's response to a click, on either layer -- the act
          list is the DOM representation of the same map, so selecting from it
          opens the same panel rather than a second, different behaviour. */}
      {selected && (
        <PlanetHud
          node={selected}
          prereqs={selected.prereq
            .map((id) => data.nodes.find((n) => n.id === id))
            .filter((n): n is StageNode => n !== undefined)}
          onEnter={(id) => {
            setSelectedId(null);
            onOpen(id);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}

      <ActList data={data} onOpen={setSelectedId} />"""))

missing = [o.splitlines()[0][:55] for o, _ in E2 if o not in s]
if missing:
    print("STAGEMAP NOT FOUND:", missing); sys.exit(1)
for o, n in E2:
    s = s.replace(o, n, 1)
m.write_text(s, encoding='utf-8')
print("StageMap: HUD wired, click no longer navigates")

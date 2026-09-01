import pathlib, sys

# ------------------------------------------------------------------ AppShell
a = pathlib.Path('apps/web/src/App.tsx')
s = a.read_text(encoding='utf-8')
E = []

E.append(('import { useCosmetics } from "./solar-system/cosmetic-seed";',
          'import { useCosmetics } from "./solar-system/cosmetic-seed";\n'
          'import { SolarProvider } from "./solar-system/SolarBackdrop";'))

E.append(("""  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>""",
"""  /*
   * Where the solar system is the page background, and where it deliberately
   * is not.
   *
   * OFF on content surfaces — the stage reader, the attempt runner, and the
   * labs and games that will live under them. Those carry their own theatre:
   * a LAB beat wears its encounter theme, a landing wears its biome, and a
   * star field behind either is a third visual system competing with them.
   *
   * The harder reason is the assessment. `DESIGN-MANDATE.md` §1B rule 1:
   * theatre dresses the practice, never the assessment. A drifting star field
   * behind a graded question is exactly what that rule exists to keep out, and
   * it would be *motion* behind an assessment, which is worse than decoration.
   */
  const onContentSurface = /^\\/app\\/stage\\//.test(location.pathname);
  const backdrop = !onContentSurface;

  return (
    <SolarProvider data={map} active={backdrop}>
    <div className={`app${backdrop ? " app-over-solar" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>"""))

E.append(("""          <Outlet />
        </main>
      </div>""",
"""          <Outlet />
        </main>
      </div>"""))

missing = [o.splitlines()[0][:50] for o, _ in E if o not in s]
if missing:
    print("APPSHELL NOT FOUND:", missing); sys.exit(1)
for o, n in E:
    s = s.replace(o, n, 1)

# Close the provider: find AppShell's closing and wrap.
old_close = """      </div>
    </div>
  );
}"""
assert old_close in s, "AppShell close not found"
s = s.replace(old_close, """      </div>
    </div>
    </SolarProvider>
  );
}""", 1)

# useLocation import
if "useLocation" not in s:
    s = s.replace("  useNavigate,", "  useNavigate,\n  useLocation,", 1)
s = s.replace("""function AppShell(): JSX.Element {
  const identity = useIdentity();
  const nav = useNavigate();""",
"""function AppShell(): JSX.Element {
  const identity = useIdentity();
  const nav = useNavigate();
  const location = useLocation();""", 1)

a.write_text(s, encoding='utf-8')
print("AppShell wrapped in SolarProvider")

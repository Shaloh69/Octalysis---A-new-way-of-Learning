import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, type StageDetail } from "../lib/api";
import { BiomeScene } from "../biomes/BiomeScene";
import { useSeededBiome } from "../biomes/useSeededBiome";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { SusSurvey } from "../components/SusSurvey";
import { Readout } from "./Readout";
import { KeyHintBar } from "./KeyHintBar";
import { useKeyHints } from "./keyHints";
import { NumberedTitle } from "./MissionPanel";
import { WarpLink } from "./RealmWarp";
import { useOnline } from "./useOnline";

/**
 * Inside a planet (WEB-REMAKE.md §3): the planet's biome holds the page, and
 * its chrome is Kenney's sprites.
 *
 *   the nav bar     a sprite bar across the top: Leave planet, the planet's
 *                   name, its tabs (Reading, and Check when one is open), and
 *                   Report a problem; the current tab is the pressed sprite
 *   the scene       the planet's biome behind everything (one per planet,
 *                   seeded from student and stage; `data-biome` is the realm's)
 *   the bottom bar  the registers as a sprite bar, and the key hints, at 1440;
 *                   on a phone it carries the tabs instead
 *
 * Leave planet returns to the map with this planet selected (`/app?stage=NN`),
 * through the warp. The side bars are the routes' own (`.sprite-panel`).
 */
export function BiomeShell({ signedIn }: { signedIn: boolean }): JSX.Element {
  const { id = "" } = useParams();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const biome = useSeededBiome();
  const online = useOnline();
  const [stage, setStage] = useState<StageDetail | null>(null);
  const [reporting, setReporting] = useState(false);

  // The nav needs the planet's name and whether a check is open. The reader
  // fetches the full stage itself; this is the chrome's own light read.
  useEffect(() => {
    let live = true;
    setStage(null);
    api
      .stage(id)
      .then((s) => live && setStage(s))
      .catch(() => {
        /* the route shows the real error; the nav keeps the id */
      });
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(() => setReporting(false), [pathname]);

  const check =
    stage && !stage.locked && stage.assessment
      ? `/app/stage/${id}/check?a=${encodeURIComponent(stage.assessment.id)}&t=${encodeURIComponent(stage.assessment.title)}`
      : null;
  const leaveTo = `/app?stage=${encodeURIComponent(id)}`;
  const title = stage ? `Stage ${id} · ${stage.title}` : `Stage ${id}`;

  useKeyHints("shell", [
    { key: "l", cap: "L", label: "Leave planet", run: () => nav(leaveTo) },
    { key: "r", cap: "R", label: "Reading", run: () => nav(`/app/stage/${id}`) },
    ...(check ? [{ key: "c", cap: "C", label: "Check", run: () => nav(check) }] : []),
    { key: "f", cap: "F", label: "Report a problem", run: () => setReporting(true) },
  ]);

  const tabs = (
    <ul className="biome-tabs">
      <li>
        <NavLink to={`/app/stage/${id}`} end className="sprite-button biome-tab">
          Reading
        </NavLink>
      </li>
      {check && (
        <li>
          <NavLink to={check} className="sprite-button biome-tab">
            Check
          </NavLink>
        </li>
      )}
    </ul>
  );

  return (
    <div className="biome-shell" data-shell>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <BiomeScene name={biome} />
      <div className="biome-scrim" aria-hidden="true" />

      <header className="biome-top sprite-bar">
        <nav className="biome-nav" aria-label="This planet">
          <WarpLink to={leaveTo} className="sprite-button biome-leave">
            <span className="sprite-arrow sprite-arrow-left" aria-hidden="true" />
            <span className="biome-leave-long">Leave planet</span>
            <span className="biome-leave-short" aria-hidden="true">
              Leave
            </span>
          </WarpLink>
          <p className="biome-planet">
            <NumberedTitle text={title} />
          </p>
          <div className="biome-tabs-top">{tabs}</div>
          <button type="button" className="sprite-button biome-report" onClick={() => setReporting(true)}>
            Report
          </button>
        </nav>
      </header>

      {!online && (
        <p className="shell-banner shell-banner-biome sprite-bar" role="status">
          You are offline. Answers you give in a check are kept and sent when you reconnect.
        </p>
      )}

      <main id="main" className="biome-main">
        <Outlet />
      </main>

      <footer className="biome-bottom">
        <Readout dress="sprite" />
        <KeyHintBar dress="sprite" />
        <nav className="biome-tabs-bottom sprite-bar" aria-label="This planet's pages">
          {tabs}
        </nav>
      </footer>

      {reporting && <FeedbackDialog framed="sprite-panel" onClose={() => setReporting(false)} />}
      {signedIn && <SusSurvey />}
    </div>
  );
}

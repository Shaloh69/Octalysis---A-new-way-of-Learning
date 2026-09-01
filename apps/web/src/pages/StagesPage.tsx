import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type StageMapData } from "../lib/api";
import { StageList } from "../components/StageList";

/**
 * `/app/stages` — every stage, as progress rather than prose.
 *
 * The map used to carry this list underneath it, four columns of paragraphs
 * covering the page. It moved here so a map can be a map, and so the list can
 * be arranged for the question it actually answers: where am I, what is next,
 * and why is that one shut.
 *
 * This page now carries the accessibility contract that
 * `SOLAR-SYSTEM-SPEC.md` §1.4b describes: **all 19 stages, locked included, in
 * full text, with every lock reason and its distance.** The 3D layer may
 * withhold a planet for effect; this never withholds anything.
 */
export function StagesPage(): JSX.Element {
  const [data, setData] = useState<StageMapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    void api
      .stages()
      .then(setData)
      .catch(() => setError("We could not load your stages. Reload the page to try again."));
  }, []);

  if (error) {
    return (
      <section className="state state-error">
        <h1>Stages</h1>
        <p>{error}</p>
      </section>
    );
  }

  if (!data) {
    // A skeleton matching the final layout, never a centred spinner
    // (PAGE-SPECS.md §5).
    return (
      <section className="stages-page">
        <h1>Stages</h1>
        <div className="skel skel-para" />
        <div className="skel skel-para" />
        <div className="skel skel-para" />
      </section>
    );
  }

  const mastered = data.nodes.filter((n) => n.state === "mastered").length;

  return (
    <section className="stages-page" aria-labelledby="stages-title">
      <p className="reader-eyebrow">Your route</p>
      <h1 id="stages-title">All 19 stages</h1>
      <p className="settings-note">
        <span className="mono">{mastered}</span> of{" "}
        <span className="mono">{data.nodes.length}</span> mastered. Every stage
        below is on one line through the syllabus — each needs the one before
        it, and a locked stage says what it is waiting for.
      </p>

      <StageList data={data} onOpen={(id) => nav(`/app/stage/${id}`)} />
    </section>
  );
}

import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { busiest, share } from "@/lib/live-view";
import { useDelayed } from "@/lib/useDelayed";
import { useLiveRoom } from "@/lib/useLiveRoom";
import { Button } from "@/components/ui/button";

/**
 * `/live/present` — the projector view, rebuilt 29 Sep 2026 as its own route
 * (`design/templates/console/live/SPEC.md`).
 *
 * Until then it was an overlay at `/live?present=1` drawn over the shell: Tab
 * walked into five nav links hidden behind it with focus invisible, and there
 * was no way out but the browser's Back. It now renders inside `AppShell`'s
 * guard with no frame (`<AppShell bare />`), so the nav is not in the page at
 * all, and Exit and Escape return to `/live`.
 *
 * It is read from the back of a lecture hall: large type, every value in mono,
 * contrast computed on all three themes like every other state, and no
 * decoration (`VISUAL-SYSTEM-3D.md`: do not spend the lecturer's GPU). It reads
 * the same payload as `/live`, which names no one, ever.
 */
export function LivePresentPage() {
  const navigate = useNavigate();
  const { snap, error, stale, refresh } = useLiveRoom(false);
  const waiting = useDelayed(!snap && !error, 400);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) navigate("/live");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const s = snap?.session ?? null;
  const pct = s ? share(s.correct, s.answered) : null;

  return (
    <main data-projector data-ready={snap ? "" : undefined} className="lv-present">
      <header className="lv-p-top">
        <h1 className="lv-p-title">CPE 412 · Lecture Mode</h1>
        <div className="lv-p-top-right">
          {stale && snap ? <p data-stale role="status" className="lv-p-stale">Showing the last reading</p> : null}
          <Link to="/live" className="lv-p-exit">
            Exit <kbd className="num">Esc</kbd>
          </Link>
        </div>
      </header>

      {error && !snap ? (
        <div role="alert" className="lv-p-body lv-p-center">
          <p className="lv-p-line">The room could not be read.</p>
          <Button variant="outline" onClick={refresh}>Try again</Button>
        </div>
      ) : !snap ? (
        <div className="lv-p-body lv-p-center" aria-busy="true">
          {waiting ? <p className="lv-p-line">Reading the room…</p> : null}
        </div>
      ) : s ? (
        <section className="lv-p-body" aria-label="The question">
          <p className="lv-p-eyebrow">
            Question · Stage <span className="num">{s.stageId}</span> · {s.stageTitle}
          </p>
          {s.objective ? <p className="lv-p-objective">{s.objective}</p> : null}
          <div data-result className="lv-p-result">
            <span className="lv-p-figure num">{s.answered}</span>
            <span className="lv-p-unit">answered</span>
          </div>
          {pct !== null ? (
            <div className="lv-p-share">
              <p className="lv-p-line">
                The class got <span className="num text-ink">{pct}%</span>
              </p>
              <div className="lv-p-track" aria-hidden="true">
                <div data-bar className="lv-p-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="lv-p-sub num">
                {s.correct} of {s.answered}
              </p>
            </div>
          ) : (
            <p className="lv-p-line">The result appears once {snap.minCohort} have answered.</p>
          )}
        </section>
      ) : (
        <section className="lv-p-body" aria-label="The room">
          <div data-result className="lv-p-result">
            <span className="lv-p-figure num">{snap.cohort}</span>
            <span className="lv-p-unit">{snap.cohort === 1 ? "person working now" : "people working now"}</span>
          </div>
          {snap.stages.length ? (
            <div className="lv-p-stages">
              <h2 className="lv-p-h2">The class so far</h2>
              <ul>
                {busiest(snap.stages).map((st) => (
                  <li key={st.stageId} data-stage-row={st.stageId} className="lv-p-stage">
                    <span className="lv-p-stage-name">
                      <span className="num">{st.stageId}</span> {st.title}
                    </span>
                    {st.avgMastery === null ? (
                      <span className="lv-p-held">fewer than {snap.minCohort}, not shown</span>
                    ) : (
                      <>
                        <span className="lv-p-track" aria-hidden="true">
                          <span data-bar className="lv-p-fill" style={{ width: `${st.avgMastery}%` }} />
                        </span>
                        <span className="lv-p-value num">{st.avgMastery}%</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      <p className="lv-p-foot">No names are shown here, ever.</p>
    </main>
  );
}

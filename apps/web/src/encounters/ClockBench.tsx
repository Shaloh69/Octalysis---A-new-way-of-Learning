import { useId, useMemo, useState } from "react";
import {
  BOOK_IC,
  BOOK_MHZ,
  BOOK_MIX,
  cpuTimeMs,
  cycleTimeNs,
  mipsRate,
  mixWithMisses,
  RELATIONS,
  weightedCpi,
} from "./clock-bench";
import "../styles/encounter.css";

/**
 * Clock Bench: moon 02.8's Drill (GAME-DESIGN.md §11; WEB-REVAMP 3.6, approved
 * 30 Sep 2026; template `design/templates/web/encounter-drill/`).
 *
 * The book's own situation, Example 2.2, on a bench: two dials (the clock,
 * and the share of memory references that miss the cache) and the book's
 * relations answering as they move. At the book's settings it reads what the
 * book reads: CPI 2.24, about 178 MIPS.
 *
 * IT GRADES NOTHING: there is nothing to answer here, so nothing is marked,
 * recorded or sent. The graded drill, re-rolled every journey, is this moon's
 * questions above it, solved and marked by the server.
 */

const MHZ = { min: 100, max: 4000, step: 100 };
const MISS = { min: 0, max: 30, step: 1 };
const BOOK_MISS = BOOK_MIX[3]!.mix;

const fmt = (n: number, digits: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function ClockBench(): JSX.Element {
  const [mhz, setMhz] = useState(BOOK_MHZ);
  const [miss, setMiss] = useState(BOOK_MISS);
  const id = useId();
  const mix = useMemo(() => mixWithMisses(miss), [miss]);
  const cpi = weightedCpi(mix);
  const atBook = mhz === BOOK_MHZ && miss === BOOK_MISS;

  return (
    <div className="bench" data-bench="" data-at-book={atBook ? "yes" : "no"}>
      <header className="sort-head">
        <p className="sort-eyebrow">Drill · a bench, never graded</p>
        <h2>Clock Bench</h2>
        <p className="sort-intro">
          The book&rsquo;s Example 2.2: <span className="mono">2</span> million instructions on a{" "}
          <span className="mono">400</span>-MHz processor, with this instruction mix. Turn the clock, or the share of
          memory references that miss the cache, and watch the book&rsquo;s relations answer.
        </p>
      </header>

      <div className="bench-grid">
        <section className="bench-panel sprite-panel" aria-labelledby={`${id}-dials`}>
          <h3 id={`${id}-dials`}>Dials</h3>
          <div className="bench-dial">
            <label htmlFor={`${id}-f`}>Clock frequency, f</label>
            <output className="mono" htmlFor={`${id}-f`} data-readout="f">
              {fmt(mhz, 0)} MHz
            </output>
            <input
              id={`${id}-f`}
              type="range"
              min={MHZ.min}
              max={MHZ.max}
              step={MHZ.step}
              value={mhz}
              onChange={(e) => setMhz(Number(e.target.value))}
            />
          </div>
          <div className="bench-dial">
            <label htmlFor={`${id}-miss`}>Memory references with cache miss</label>
            <output className="mono" htmlFor={`${id}-miss`} data-readout="miss">
              {miss}%
            </output>
            <input
              id={`${id}-miss`}
              type="range"
              min={MISS.min}
              max={MISS.max}
              step={MISS.step}
              value={miss}
              onChange={(e) => setMiss(Number(e.target.value))}
            />
            <p className="bench-note">The difference comes from, or goes to, arithmetic and logic.</p>
          </div>
          <button
            type="button"
            className="sprite-button"
            disabled={atBook}
            onClick={() => {
              setMhz(BOOK_MHZ);
              setMiss(BOOK_MISS);
            }}
          >
            Back to the book&rsquo;s example
          </button>
        </section>

        <section className="bench-panel sprite-panel" aria-labelledby={`${id}-mix`}>
          <h3 id={`${id}-mix`}>The instruction mix</h3>
          <table className="bench-table">
            <caption>Example 2.2, Stallings, ch. 2, §2.4{atBook ? "" : ", with your dials"}</caption>
            <thead>
              <tr>
                <th scope="col">Instruction type</th>
                <th scope="col">CPI</th>
                <th scope="col">Mix</th>
              </tr>
            </thead>
            <tbody>
              {mix.map((t) => (
                <tr key={t.name}>
                  <th scope="row">{t.name}</th>
                  <td className="mono">{t.cpi}</td>
                  <td className="mono">{t.mix}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="bench-panel sprite-panel" aria-labelledby={`${id}-out`}>
        <h3 id={`${id}-out`}>What the book&rsquo;s relations say</h3>
        <dl className="bench-readouts">
          <div>
            <dt>Cycle time, t = 1/f</dt>
            <dd className="mono" data-readout="t">{fmt(cycleTimeNs(mhz), 3)} ns</dd>
          </div>
          <div>
            <dt>CPI = Σ (CPIᵢ × fractionᵢ)</dt>
            <dd className="mono" data-readout="cpi">{fmt(cpi, 2)}</dd>
          </div>
          <div>
            <dt>MIPS rate = f / (CPI × 10⁶)</dt>
            <dd className="mono" data-readout="mips">{fmt(mipsRate(mhz, cpi), 1)}</dd>
          </div>
          <div>
            <dt>
              Processor time, T = I<sub>c</sub> × CPI × t
            </dt>
            <dd className="mono" data-readout="T">{fmt(cpuTimeMs(BOOK_IC, cpi, mhz), 2)} ms</dd>
          </div>
        </dl>
        <ul className="bench-sources">
          {atBook ? (
            <li>
              At the book&rsquo;s settings, the book: <q>{RELATIONS.example.text}</q> <cite>{RELATIONS.example.cite}</cite>
            </li>
          ) : null}
          <li>
            <q>{RELATIONS.cycle.text}</q>; <q>{RELATIONS.time.text}</q> <cite>{RELATIONS.time.cite}</cite>
          </li>
          <li>
            MIPS is <q>{RELATIONS.mips.text}</q> <cite>{RELATIONS.mips.cite}</cite>
          </li>
        </ul>
      </section>

      <p className="sort-note">Nothing here is recorded or marked. This moon is mastered by its questions above.</p>
      <p className="sr-only" role="status" aria-live="polite">
        {`CPI ${fmt(cpi, 2)}, ${fmt(mipsRate(mhz, cpi), 1)} MIPS at ${fmt(mhz, 0)} MHz`}
      </p>
    </div>
  );
}

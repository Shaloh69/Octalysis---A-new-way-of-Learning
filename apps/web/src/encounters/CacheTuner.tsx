import { useId, useState } from "react";
import { ADDRESS_BITS, exampleAt, fields, GIVENS, MAPPINGS, sizeWords, type Ways } from "./cache-tuner";
import "../styles/encounter.css";

/**
 * Cache Tuner: moon 04.5's Cache drill (WEB-REVAMP 3.6, approved 30 Sep 2026;
 * GAME-DESIGN.md §11; template `design/templates/web/encounter-cache/`).
 *
 * A bench on the book's Example 4.2: a 24-bit address for 16 MB of main
 * memory. The student chooses the cache's size, its line size and its
 * mapping, and the address splits into TAG, LINE or SET, and WORD as the
 * book's relations say. Where the dials land on one of the sources' own
 * worked examples, the bench quotes it.
 *
 * IT GRADES NOTHING: nothing to answer, nothing marked, recorded or sent. The
 * moon is mastered by its questions above, marked by the server.
 */

/** Powers of two on the dials: 1 KB to 1 MB, 4 B to 128 B. */
const SIZE_EXP = { min: 10, max: 20 };
const LINE_EXP = { min: 2, max: 7 };

export default function CacheTuner(): JSX.Element {
  const [sizeExp, setSizeExp] = useState(16); // 64 KB, the book's
  const [lineExp, setLineExp] = useState(2); // 4 B, the book's
  const [ways, setWays] = useState<Ways>(1);
  const id = useId();

  const cacheBytes = 2 ** sizeExp;
  const lineBytes = 2 ** lineExp;
  const f = fields(cacheBytes, lineBytes, ways);
  const example = exampleAt(cacheBytes, lineBytes, ways);
  const set = (s: number, l: number, w: Ways) => {
    setSizeExp(s);
    setLineExp(l);
    setWays(w);
  };
  const segments = [
    { name: "TAG", bits: f.tag },
    ...(f.indexName ? [{ name: f.indexName, bits: f.index }] : []),
    { name: "WORD", bits: f.word },
  ];

  return (
    <div className="bench" data-cache-tuner="" data-example={example ? "yes" : "no"}>
      <header className="sort-head">
        <p className="sort-eyebrow">Cache drill · a bench, never graded</p>
        <h2>Cache Tuner</h2>
        <p className="sort-intro">
          In the book&rsquo;s Example 4.2, <q>{GIVENS.text}</q> <cite className="bench-cite">{GIVENS.cite}</cite>.
          Choose a cache and a mapping, and see how the cache splits that address.
        </p>
      </header>

      <div className="bench-grid">
        <section className="bench-panel sprite-panel" aria-labelledby={`${id}-dials`}>
          <h3 id={`${id}-dials`}>The cache</h3>
          <div className="bench-dial">
            <label htmlFor={`${id}-size`}>Cache size</label>
            <output className="mono" htmlFor={`${id}-size`} data-readout="size">
              {sizeWords(cacheBytes)}
            </output>
            <input
              id={`${id}-size`}
              type="range"
              min={SIZE_EXP.min}
              max={SIZE_EXP.max}
              step={1}
              value={sizeExp}
              aria-valuetext={sizeWords(cacheBytes)}
              onChange={(e) => setSizeExp(Number(e.target.value))}
            />
          </div>
          <div className="bench-dial">
            <label htmlFor={`${id}-line`}>Line size (bytes per block)</label>
            <output className="mono" htmlFor={`${id}-line`} data-readout="line">
              {sizeWords(lineBytes)}
            </output>
            <input
              id={`${id}-line`}
              type="range"
              min={LINE_EXP.min}
              max={LINE_EXP.max}
              step={1}
              value={lineExp}
              aria-valuetext={sizeWords(lineBytes)}
              onChange={(e) => setLineExp(Number(e.target.value))}
            />
          </div>
          <fieldset className="bench-mapping">
            <legend>Mapping</legend>
            {MAPPINGS.map((m) => (
              <label key={m.label} className="bench-radio">
                <input type="radio" name={`${id}-map`} checked={ways === m.ways} onChange={() => setWays(m.ways)} />
                <span>{m.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="bench-presets">
            <button type="button" className="sprite-button" onClick={() => set(16, 2, 1)}>
              The book&rsquo;s Example 4.2
            </button>
            <button type="button" className="sprite-button" onClick={() => set(16, 4, 1)}>
              Stage 04&rsquo;s example
            </button>
          </div>
        </section>

        <section className="bench-panel sprite-panel" aria-labelledby={`${id}-addr`}>
          <h3 id={`${id}-addr`}>
            The <span className="mono">{ADDRESS_BITS}</span>-bit address
          </h3>
          <div className="addr-bar" role="img" aria-label={segments.map((s) => `${s.name} ${s.bits} bits`).join(", ")}>
            {segments.map((s) => (
              <span key={s.name} className="addr-field" data-field={s.name} style={{ flexGrow: Math.max(s.bits, 1) }}>
                <span className="addr-name">{s.name}</span>
                <span className="mono">{s.bits}</span>
              </span>
            ))}
          </div>
          <dl className="bench-readouts">
            <div>
              <dt>Lines = cache size / line size</dt>
              <dd className="mono" data-readout="lines">{f.lines.toLocaleString("en-US")}</dd>
            </div>
            {ways !== 1 && ways !== Infinity ? (
              <div>
                <dt>Sets = lines / ways</dt>
                <dd className="mono" data-readout="sets">{f.sets.toLocaleString("en-US")}</dd>
              </div>
            ) : null}
            <div>
              <dt>WORD = log₂(bytes per line)</dt>
              <dd className="mono" data-readout="word">{f.word}</dd>
            </div>
            {f.indexName ? (
              <div>
                <dt>
                  {f.indexName} = log₂({f.indexName === "LINE" ? "lines" : "sets"})
                </dt>
                <dd className="mono" data-readout="index">{f.index}</dd>
              </div>
            ) : null}
            <div>
              <dt>TAG = {ADDRESS_BITS} − the rest</dt>
              <dd className="mono" data-readout="tag">{f.tag}</dd>
            </div>
          </dl>
          {example ? (
            <p className="bench-example" data-sourced="">
              This is a worked example: <q>{example.quote}</q> <cite>{example.cite}</cite>
            </p>
          ) : null}
        </section>
      </div>

      <p className="sort-note">Nothing here is recorded or marked. This moon is mastered by its questions above.</p>
      <p className="sr-only" role="status" aria-live="polite">
        {segments.map((s) => `${s.name} ${s.bits}`).join(", ")}
      </p>
    </div>
  );
}

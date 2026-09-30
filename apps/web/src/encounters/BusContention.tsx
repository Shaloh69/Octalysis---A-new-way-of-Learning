import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  accessesFor,
  canRequest,
  clearTraffic,
  everyoneAsks,
  GROUPS,
  initialBus,
  INSTRUCTION_BITS,
  MODULES,
  moduleName,
  QUOTES,
  request,
  setArbitration,
  setWidth,
  SIGNALS,
  step,
  TRANSFERS,
  wire,
  WIDTHS,
  type BusState,
  type CycleReport,
  type GroupId,
  type ModuleId,
  type Quote,
} from "./bus-contention";
import type { BusView } from "./bus-scene";
import "../styles/encounter.css";

/**
 * Bus Contention: moon 03.9's Bus wiring (WEB-REVAMP 3.6, approved 30 Sep 2026;
 * GAME-DESIGN.md §11, stage 03; template `design/templates/web/encounter-bus/`).
 *
 * Figure 3.16 on a bench: tap a processor, memory and two I/O modules onto
 * the bus's three groups of lines, then let them ask for it. One transmits,
 * the others wait above their stops, and with the grant switched off two at
 * once garble. The canvas (Phaser, its own lazy chunk) draws it; every
 * control is a button here, so the keyboard path is the whole encounter, and
 * when the canvas cannot run the same bus is drawn in the DOM instead.
 *
 * IT GRADES NOTHING: nothing to answer, nothing marked, recorded or sent. The
 * moon is mastered by its questions above, marked by the server.
 */

type Canvas = "loading" | "ready" | "fallback";
const ASKERS: ModuleId[] = ["cpu", "io1", "io2"];
const RUN_MS = 700;

function useReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [r, setR] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

function canDrawCanvas(): boolean {
  try {
    return !!document.createElement("canvas").getContext("2d");
  } catch {
    return false;
  }
}

function Cited({ q }: { q: Quote }): JSX.Element {
  return (
    <>
      <q>{q.text}</q> <cite className="bench-cite">{q.cite}</cite>
    </>
  );
}

function summary(last: CycleReport | null): string {
  if (!last) return "The bus is idle.";
  if (last.garbled) return `Cycle ${last.cycle}: ${last.transmitters.map(moduleName).join(" and ")} transmitted at once, and the signals garbled.`;
  if (!last.transmitters.length) return `Cycle ${last.cycle}: nobody asked; the bus is idle.`;
  const who = moduleName(last.transmitters[0]!);
  const wait = last.waiting.length ? ` ${last.waiting.map(moduleName).join(", ")} ${last.waiting.length > 1 ? "wait" : "waits"}.` : "";
  return `Cycle ${last.cycle}: ${who} has the bus, ${last.data}.${wait}`;
}

export default function BusContention(): JSX.Element {
  const [bus, setBus] = useState<BusState>(initialBus);
  const [running, setRunning] = useState(false);
  const [canvas, setCanvas] = useState<Canvas>("loading");
  const reduced = useReducedMotion();
  const id = useId();
  const stage = useRef<HTMLDivElement>(null);
  const view = useRef<BusView | null>(null);

  const onModule = useCallback((m: ModuleId) => setBus((s) => request(s, m)), []);
  const onTap = useCallback((m: ModuleId, g: GroupId) => setBus((s) => wire(s, m, g)), []);

  // The canvas, loaded only here and only now (GAME-DESIGN §10.2).
  useEffect(() => {
    const el = stage.current;
    if (!el || !canDrawCanvas()) {
      setCanvas("fallback");
      return;
    }
    let live = true;
    import("./bus-scene")
      .then(({ mountBusScene }) => mountBusScene(el, { reduced, onModule, onTap }))
      .then((v) => {
        if (!live) return v.destroy();
        view.current = v;
        setCanvas("ready");
      })
      .catch(() => live && setCanvas("fallback"));
    return () => {
      live = false;
      view.current?.destroy();
      view.current = null;
    };
  }, [reduced, onModule, onTap]);

  useEffect(() => {
    if (canvas === "ready") view.current?.update(bus);
  }, [bus, canvas]);

  const idle = bus.queue.length === 0;
  useEffect(() => {
    if (!running) return;
    if (idle) {
      setRunning(false);
      return;
    }
    const t = window.setInterval(() => setBus((s) => step(s)), RUN_MS);
    return () => window.clearInterval(t);
  }, [running, idle]);

  const last = bus.last;
  const pending = (m: ModuleId) => bus.queue.filter((q) => q.id === m).length;
  const allWired = MODULES.every((m) => bus.wired[m.id].length === GROUPS.length);
  const bookSays: Quote = last?.garbled || (last?.waiting.length ?? 0) > 0 ? QUOTES.garbled : QUOTES.shared;
  const lineNow: Record<GroupId, string> = {
    control: last?.control.length ? last.control.join(" · ") : "idle",
    address: last?.address ?? "idle",
    data: last?.data ?? "idle",
  };

  return (
    <div className="bench bus" data-bus-contention="" data-canvas={canvas}>
      <header className="sort-head">
        <p className="sort-eyebrow">Bus wiring · a bench, never graded</p>
        <h2>Bus Contention</h2>
        <p className="sort-intro">
          <Cited q={QUOTES.shared} /> Tap each module onto the bus&rsquo;s three groups of lines, then let them ask for it,
          and watch who waits.
        </p>
      </header>

      <section className="bench-panel sprite-panel bus-board" aria-labelledby={`${id}-bus`}>
        <h3 id={`${id}-bus`}>The bus</h3>
        <div
          ref={stage}
          className="bus-stage"
          data-bus-canvas={canvas}
          data-motion={reduced ? "still" : "packet"}
          aria-hidden="true"
          hidden={canvas === "fallback"}
        />
        {canvas === "fallback" ? (
          <>
            <p className="bus-notice" data-bus-notice="">
              The animated bus could not start on this device; the same bus is drawn below, and every control works.
            </p>
            <div className="bus-fallback" data-bus-fallback="" aria-hidden="true">
              <ol className="bus-modules">
                {MODULES.map((m) => (
                  <li key={m.id} className="bus-module" data-module={m.id} data-active={last?.transmitters.includes(m.id) ? "yes" : "no"}>
                    <span className="bus-riders">
                      {Array.from({ length: pending(m.id) }, (_, i) => (
                        <span key={i} className="bus-rider" />
                      ))}
                    </span>
                    <span className="bus-module-name">{m.short}</span>
                    <span className="bus-taps">{GROUPS.filter((g) => bus.wired[m.id].includes(g.id)).map((g) => g.name.split(" ")[0]).join(" · ") || "not wired"}</span>
                  </li>
                ))}
              </ol>
              {GROUPS.map((g) => (
                <div key={g.id} className="bus-line" data-line={g.id} data-garbled={g.id === "data" && last?.garbled ? "yes" : "no"}>
                  <span className="bus-line-name">{g.name}</span>
                  <span
                    className="bus-line-bar"
                    style={g.id === "data" ? { height: `${Math.max(2, Math.log2(bus.width) * 2 - 3)}px` } : undefined}
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}
        <dl className="bench-readouts" data-bus-readout="">
          <div>
            <dt>Bus cycle</dt>
            <dd className="mono" data-readout="cycle">{bus.cycle}</dd>
          </div>
          {GROUPS.slice().reverse().map((g) => (
            <div key={g.id}>
              <dt>{g.name}</dt>
              <dd className="bus-now" data-readout={g.id}>{lineNow[g.id]}</dd>
            </div>
          ))}
          <div>
            <dt>Waiting for the bus</dt>
            <dd className="bus-now" data-readout="waiting">
              {bus.queue.length ? MODULES.filter((m) => pending(m.id)).map((m) => `${m.name} (${pending(m.id)})`).join(", ") : "nobody"}
            </dd>
          </div>
        </dl>
        <p className="bench-example" data-book-says="">
          <Cited q={bookSays} />
        </p>
        {last?.control.length ? (
          <ul className="bus-signals" aria-label="What the control lines just said">
            {last.control.map((name) => (
              <li key={name}>
                <Cited q={SIGNALS[name].quote} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="bench-grid">
        <section className="bench-panel sprite-panel" aria-labelledby={`${id}-wire`}>
          <h3 id={`${id}-wire`}>1 · Wire it</h3>
          <p className="bus-help">
            <Cited q={QUOTES.groups} />
          </p>
          <table className="bus-wiring">
            <thead>
              <tr>
                <th scope="col">Module</th>
                {GROUPS.map((g) => (
                  <th key={g.id} scope="col">
                    {g.name.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.name}</th>
                  {GROUPS.map((g) => {
                    const on = bus.wired[m.id].includes(g.id);
                    return (
                      <td key={g.id}>
                        <button
                          type="button"
                          className="sprite-button bus-tap"
                          aria-pressed={on}
                          aria-label={`${on ? "Wired" : "Wire"}: ${m.name} to the ${g.name.toLowerCase()}`}
                          data-tap={`${m.id}-${g.id}`}
                          onClick={() => setBus((s) => wire(s, m.id, g.id))}
                        >
                          {on ? "Wired" : "Wire"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="bus-groups">
            {GROUPS.map((g) => (
              <li key={g.id}>
                <strong>{g.name}.</strong> <Cited q={g.quote} />
              </li>
            ))}
          </ul>
          <div className="bench-presets">
            <button
              type="button"
              className="sprite-button"
              disabled={allWired}
              onClick={() => setBus((s) => MODULES.reduce((acc, m) => GROUPS.reduce((a, g) => (a.wired[m.id].includes(g.id) ? a : wire(a, m.id, g.id)), acc), s))}
            >
              Wire every module
            </button>
          </div>
        </section>

        <section className="bench-panel sprite-panel" aria-labelledby={`${id}-ask`}>
          <h3 id={`${id}-ask`}>2 · Ask for it</h3>
          <p className="bus-help">
            <Cited q={QUOTES.operation} />
          </p>
          <ul className="bus-askers">
            {ASKERS.map((m) => {
              const may = canRequest(bus, m);
              const t = m === "cpu" ? TRANSFERS.cpu : TRANSFERS.io;
              return (
                <li key={m} className="bus-asker">
                  <button
                    type="button"
                    className="sprite-button"
                    disabled={!may.ok}
                    aria-describedby={`${id}-why-${m}`}
                    data-ask={m}
                    onClick={() => setBus((s) => request(s, m))}
                  >
                    {moduleName(m)}: request the bus
                  </button>
                  <p id={`${id}-why-${m}`} className="bus-why">
                    {may.reason ?? <Cited q={t.quote} />}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="bench-presets">
            <button type="button" className="sprite-button" disabled={!ASKERS.some((m) => canRequest(bus, m).ok)} onClick={() => setBus(everyoneAsks)}>
              Everyone asks at once
            </button>
            <button type="button" className="sprite-button" disabled={idle} data-step="" onClick={() => setBus(step)}>
              Step one bus cycle
            </button>
            <button type="button" className="sprite-button" disabled={idle && !running} aria-pressed={running} onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : "Run"}
            </button>
            <button
              type="button"
              className="sprite-button"
              disabled={idle && bus.cycle === 0}
              onClick={() => {
                setRunning(false);
                setBus(clearTraffic);
              }}
            >
              Clear the traffic
            </button>
          </div>
          {idle ? <p className="bus-why">Nobody has asked for the bus yet, so there is no cycle to step.</p> : null}
        </section>

        <section className="bench-panel sprite-panel" aria-labelledby={`${id}-change`}>
          <h3 id={`${id}-change`}>3 · Change the bus</h3>
          <fieldset className="bench-mapping">
            <legend>Data bus width</legend>
            {WIDTHS.map((w) => (
              <label key={w} className="bench-radio">
                <input type="radio" name={`${id}-width`} checked={bus.width === w} onChange={() => setBus((s) => setWidth(s, w))} />
                <span>
                  <span className="mono">{w}</span> lines
                </span>
              </label>
            ))}
          </fieldset>
          <p className="bench-example" data-readout="accesses">
            A <span className="mono">{INSTRUCTION_BITS}</span>-bit instruction over <span className="mono">{bus.width}</span> data lines
            takes <span className="mono">{accessesFor(bus.width)}</span> {accessesFor(bus.width) === 1 ? "access" : "accesses"}.{" "}
            <Cited q={bus.width === 32 ? QUOTES.widthExample : QUOTES.width} />
          </p>
          <label className="bench-radio bus-switch">
            <input type="checkbox" checked={bus.arbitration} onChange={(e) => setBus((s) => setArbitration(s, e.target.checked))} />
            <span>Bus request and bus grant (arbitration)</span>
          </label>
          <p className="bus-why">
            {bus.arbitration ? (
              <>A module transmits only once it is granted the bus, in the order the requests were raised.</>
            ) : (
              <>
                With no grant, every module with a request drives the lines in the same cycle. <Cited q={QUOTES.garbled} />
              </>
            )}
          </p>
        </section>
      </div>

      <p className="sort-note">
        Nothing here is recorded or marked. This moon is mastered by its questions above. The bench grants the bus in the order
        it was asked for, and lets an I/O module&rsquo;s transfer take one bus cycle; the book leaves both to its Appendix C.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {summary(last)}
      </p>
    </div>
  );
}

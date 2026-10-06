import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RATES, speakable, useListen, useVoices } from "../lib/listen";
import { drawLine, fillTo, holdLine, locate, paint, unpaint, type Located } from "../lib/follow";

/**
 * Listen: the stage's lesson read aloud (the audiobook; instructor rulings of
 * 6 Oct 2026, docs/FIGURES-AND-AUDIO.md). Controls, against DESIGN-MANDATE.md §1:
 *
 *   Listen                in the header: hear the lesson hands-free
 *   Pause / Resume / Stop on the strip along the bottom, where they stay in
 *                         reach however far the reading has scrolled
 *   Speed                 0.75x to 1.5x, from the paragraph being read
 *   Voice                 the device's English voices, the most natural first;
 *                         remembered per device
 *
 * It FOLLOWS the voice (instructor, 6 Oct 2026: "change the way it follows or
 * highlights the sentences while it reads, with animation like a line or
 * progress bar along the bottom"; template-listen.png): the sentence being
 * said is tinted, the word (where the voice reports words) is lit, a line
 * under the sentence fills as it is read, and a progress line across the
 * bottom strip fills through the whole lesson. Under reduced motion nothing
 * glides: each moves at once. Only the reader mounts this, never a paper
 * (hard rule 9).
 */
export function ListenBar({ blocks }: { blocks: ReadonlyArray<{ kind: string; body: string }> }): JSX.Element | null {
  const chunks = useMemo(() => speakable(blocks), [blocks]);
  const { voices, voice, choose } = useVoices();
  const { supported, state, pos, rate, play, pause, resume, stop, setRate, restart } = useListen(chunks, voice);
  // A new voice takes over from the paragraph being read (after the ref has it).
  const lastVoice = useRef(voice?.name);
  useEffect(() => {
    if (lastVoice.current !== voice?.name) {
      lastVoice.current = voice?.name;
      restart();
    }
  }, [voice, restart]);

  const active = state !== "idle" && pos !== null;
  const block = active ? (chunks[pos.chunk]?.block ?? null) : null;
  const totalSentences = useMemo(() => chunks.reduce((n, c) => n + c.sentences.length, 0), [chunks]);
  const firstOf = useMemo(() => {
    const at: number[] = [];
    let n = 0;
    for (const c of chunks) {
      at.push(n);
      n += c.sentences.length;
    }
    return at;
  }, [chunks]);
  const sentenceNo = active ? (firstOf[pos.chunk] ?? 0) + pos.sentence + 1 : 0;
  const calm = useCalm();

  // The block being read: marked, and its sentences found on the page once.
  const found = useRef<{ el: HTMLElement; first: number; list: Array<Array<Located | null>> } | null>(null);
  const layer = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (block === null) return;
    const el = document.querySelector<HTMLElement>(`[data-reading] [data-block="${block}"]`);
    if (!el) return;
    const first = chunks.findIndex((c) => c.block === block);
    const list = locate(
      el,
      chunks.filter((c) => c.block === block).map((c) => c.sentences),
    );
    found.current = { el, first, list };
    el.setAttribute("data-speaking", "");
    // A block whose sentences can be followed is marked lightly; one that cannot keeps the tinted panel.
    if (list.some((s) => s.some(Boolean))) el.setAttribute("data-follow", "");
    return () => {
      el.removeAttribute("data-speaking");
      el.removeAttribute("data-follow");
      el.querySelector(":scope > .rd-follow")?.remove();
      layer.current = null;
      found.current = null;
      unpaint();
    };
  }, [block, chunks]);

  // The sentence and the word: painted, underlined, and kept in view.
  useEffect(() => {
    const f = found.current;
    if (!active || !f) return;
    const loc = f.list[pos.chunk - f.first]?.[pos.sentence] ?? null;
    if (!loc) {
      unpaint();
      f.el.querySelector(":scope > .rd-follow")?.remove();
      layer.current = null;
      inView(f.el.getBoundingClientRect(), calm);
      return;
    }
    const spokenWords = chunks[pos.chunk]!.spoken[pos.sentence]!.match(/\S+/g)?.length ?? 0;
    // Symbols said as words ("×" as "times") shift the count: then only the sentence is lit.
    const word = pos.word !== null && spokenWords === loc.words.length ? (loc.words[pos.word] ?? null) : null;
    paint(loc.sentence, word);
    const key = `${pos.chunk}:${pos.sentence}`;
    if (pos.word === null) {
      layer.current = drawLine(f.el, loc.sentence, { glideMs: pos.glideMs }, calm);
      layer.current.dataset.key = key;
    } else {
      const upTo = word ? (pos.word + 1) / loc.words.length : 1;
      if (layer.current?.dataset.key === key) fillTo(layer.current, upTo);
      else {
        layer.current = drawLine(f.el, loc.sentence, { upTo }, calm);
        layer.current.dataset.key = key;
      }
    }
    inView(loc.sentence.getBoundingClientRect(), calm);
  }, [active, pos, chunks, calm]);

  // Paused: the line under the sentence and the progress line both hold still.
  useEffect(() => holdLine(layer.current, state === "paused"), [state, pos]);

  // Stopped: nothing painted is left behind.
  useEffect(() => () => unpaint(), []);

  // The strip sits just above the biome's own bottom bar (the readout and key
  // hints at 1440, the tab bar at 380), and the Contents pill rises above it.
  const strip = useRef<HTMLDivElement>(null);
  const showing = state !== "idle";
  useLayoutEffect(() => {
    const host = strip.current?.closest<HTMLElement>("[data-reader]");
    if (!showing || !host || !strip.current) return;
    const measure = () => {
      const foot = document.querySelector(".biome-bottom")?.getBoundingClientRect();
      host.style.setProperty("--strip-lift", `${foot ? window.innerHeight - foot.top : 0}px`);
      host.style.setProperty("--strip-h", `${strip.current?.getBoundingClientRect().height ?? 0}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(strip.current);
    const foot = document.querySelector(".biome-bottom");
    if (foot) ro.observe(foot);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      host.style.removeProperty("--strip-lift");
      host.style.removeProperty("--strip-h");
    };
  }, [showing]);

  if (chunks.length === 0) return null;
  if (!supported) {
    return (
      <p className="rd-listen-note" data-listen="unsupported">
        This browser cannot read the lesson aloud.
      </p>
    );
  }

  const pct = active ? Math.round(pos.from * 100) : 0;
  const host = typeof document !== "undefined" ? document.querySelector("[data-reader]") : null;

  return (
    <>
      <div className="rd-listen" data-listen={state} role="group" aria-label="Listen to the lesson">
        {state === "idle" ? (
          <button type="button" className="sprite-button" onClick={play}>
            Listen
          </button>
        ) : (
          <span className="rd-listen-where">Reading aloud: the controls are on the strip at the bottom.</span>
        )}
        {voices.length > 1 && (
          <label className="rd-listen-voice">
            <span className="rd-listen-voice-name">Voice</span>
            <select value={voice?.name ?? ""} onChange={(e) => choose(e.target.value)}>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="rd-listen-speed" role="group" aria-label="Reading speed">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              className="rd-listen-rate"
              aria-pressed={rate === r}
              aria-label={`Speed ${r} times`}
              onClick={() => setRate(r)}
            >
              <span className="mono">{r}×</span>
            </button>
          ))}
        </span>
      </div>
      {state !== "idle" &&
        host &&
        createPortal(
          <div ref={strip} className="rd-strip sprite-panel" data-listen-strip={state} role="group" aria-label="Reading aloud">
            <Progress from={pos?.from ?? 0} to={pos?.to ?? 0} glideMs={pos?.glideMs ?? 0} paused={state === "paused"} calm={calm} pct={pct} />
            <div className="rd-strip-row">
              <button type="button" className="sprite-button" onClick={state === "playing" ? pause : resume}>
                {state === "playing" ? "Pause" : "Resume"}
              </button>
              <button type="button" className="sprite-button" onClick={stop}>
                Stop
              </button>
              <span className="rd-strip-where">
                {state === "paused" ? "Paused: sentence" : "Sentence"} <span className="mono">{sentenceNo}</span> of{" "}
                <span className="mono">{totalSentences}</span>
              </span>
              <span className="rd-strip-pct mono" aria-hidden="true">
                {pct}%
              </span>
            </div>
          </div>,
          host,
        )}
    </>
  );
}

/** The line across the top of the strip: how far through the whole lesson the voice is. */
function Progress(props: { from: number; to: number; glideMs: number; paused: boolean; calm: boolean; pct: number }) {
  const { from, to, glideMs, paused, calm, pct } = props;
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    for (const a of el.getAnimations()) a.cancel();
    if (calm || glideMs === 0) {
      el.style.transform = `scaleX(${calm ? from : to})`;
      return;
    }
    el.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }], {
      duration: glideMs,
      easing: "linear",
      fill: "forwards",
    });
  }, [from, to, glideMs, calm]);
  useEffect(() => {
    for (const a of bar.current?.getAnimations() ?? []) {
      if (paused) a.pause();
      else a.play();
    }
  }, [paused]);
  return (
    <div
      className="rd-strip-track"
      role="progressbar"
      aria-label="Through the lesson"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span ref={bar} className="rd-strip-fill" />
    </div>
  );
}

function useCalm(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [calm, setCalm] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const q = window.matchMedia(query);
    const on = () => setCalm(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return calm;
}

/** Scroll a sentence (or a block) back into view when it reaches the strip (or the Contents pill above it) or leaves the top. */
function inView(r: DOMRect, calm: boolean): void {
  let bottom = window.innerHeight;
  for (const el of document.querySelectorAll(".rd-strip, .rd-pill")) {
    const b = el.getBoundingClientRect();
    if (b.height > 0) bottom = Math.min(bottom, b.top);
  }
  bottom -= 24;
  if (r.top >= 80 && r.bottom <= bottom) return;
  window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: calm ? "auto" : "smooth" });
}

import { useCallback, useEffect, useRef, useState } from "react";
import { parseBlocks, plain, type Block } from "./markdown";

/**
 * The audiobook (instructor rulings, 6 Oct 2026; docs/FIGURES-AND-AUDIO.md):
 * the stage's approved lesson text, read aloud by the browser's own voice.
 * Recorded MP3s from Google Cloud TTS are the next step.
 *
 * Instructor, 6 Oct 2026, three rounds: "intonation and voice quality is
 * horrible" (the best English voice is now chosen and a paragraph is spoken
 * whole); the paragraph mark was "too close"; and "change the way it follows
 * or highlights the SENTENCES while it reads, with animation like a line or
 * progress bar along the bottom". So it now FOLLOWS: it knows which sentence,
 * and where the voice reports it which word, is being spoken, and how far
 * through the whole lesson it is (ListenBar draws all three).
 *
 * The pure half lives here and is unit-tested: the sentences of each
 * paragraph as written (for the highlight) and as said (symbols as words),
 * the utterance plan for a voice, and the mapping from a spoken character back
 * to a sentence and a word.
 */

/** One paragraph, heading or list item, and the block it is in. */
export interface Chunk {
  readonly block: number;
  /** Its sentences exactly as the page shows them (whitespace collapsed). */
  readonly sentences: readonly string[];
  /** The same sentences as the voice is given them. */
  readonly spoken: readonly string[];
}

/** Chrome's online "Google" voices stop after ~15 s of one utterance: keep them short. */
const SHORT_CHARS = 200;
/** Every other voice keeps its intonation across a whole paragraph. */
const LONG_CHARS = 1200;

const SAY: ReadonlyArray<[RegExp, string]> = [
  [/×/g, " times "],
  [/−/g, " minus "],
  [/≈/g, " about "],
  [/≤/g, " at most "],
  [/≥/g, " at least "],
  [/→/g, " to "],
  [/←/g, " from "],
  [/·/g, ", "],
  [/…/g, "..."],
  [/\be\.g\./gi, "for example"],
  [/\bi\.e\./gi, "that is"],
];

/** Text as a voice should say it: symbols as words, and a pause at the end. */
export function speechText(text: string): string {
  let s = text;
  for (const [re, w] of SAY) s = s.replace(re, w);
  s = s.replace(/\s+/g, " ").trim();
  // A heading or list item with no full stop runs into the next one without a pause.
  if (s && !/[.!?:;]$/.test(s)) s += ".";
  return s;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Split at sentence ends: a full stop, "?" or "!" (and any closing quote or
 * bracket) followed by a space. "3.5", "e.g." and a lone initial are not ends.
 */
export function splitSentences(text: string): string[] {
  const flat = collapse(text);
  if (!flat) return [];
  const out: string[] = [];
  const re = /[.!?]+["')\]]*(?=\s)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const end = m.index + m[0].length;
    const piece = flat.slice(start, end);
    if (/(^|[\s(])(e\.g|i\.e|etc|vs|cf|Fig|ed|No)\.$/i.test(piece) || /(^|\s)[A-Z]\.$/.test(piece)) continue;
    out.push(piece.trim());
    start = end;
  }
  const rest = flat.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

function blockText(b: Block): string[] {
  switch (b.t) {
    case "h":
      return [plain(b.c)];
    case "p":
      return [plain(b.c)];
    case "list":
      return b.items.map((i) => plain(i));
    case "quote":
      return b.c.flatMap(blockText);
    case "table": {
      // A table is read row by row; the page shows its cells, so it is followed by row.
      const head = b.head?.map((c) => plain(c).trim()) ?? null;
      return b.rows.map((row) =>
        row
          .map((cell, i) => {
            const v = plain(cell).trim();
            const h = head?.[i];
            return h && v && i > 0 ? `${h}: ${v}` : v;
          })
          .filter(Boolean)
          .join(", "),
      );
    }
  }
}

/**
 * Everything to be read, in order. `blocks` is the reader's own list (kind,
 * body); a chunk's `block` is the reader's block index.
 */
export function speakable(blocks: ReadonlyArray<{ kind: string; body: string }>): Chunk[] {
  const out: Chunk[] = [];
  blocks.forEach((b, block) => {
    if (b.kind === "code") return;
    for (const piece of parseBlocks(b.body ?? "").flatMap(blockText)) {
      const sentences = splitSentences(piece);
      if (sentences.length === 0) continue;
      out.push({ block, sentences, spoken: sentences.map(speechText) });
    }
  });
  return out;
}

/** One utterance: some consecutive sentences of a chunk, joined, and where each starts. */
export interface Utterance {
  readonly text: string;
  /** Sentence indexes within the chunk. */
  readonly sentences: readonly number[];
  /** The start of each of those sentences within `text`. */
  readonly starts: readonly number[];
}

/**
 * The utterances for a chunk: as many whole sentences per utterance as fit in
 * `max` characters (a long sentence alone is still one utterance; the voices
 * that need short ones get `SHORT_CHARS`, which few sentences exceed).
 */
export function planUtterances(chunk: Chunk, max: number): Utterance[] {
  const out: Utterance[] = [];
  let text = "";
  let sentences: number[] = [];
  let starts: number[] = [];
  chunk.spoken.forEach((s, i) => {
    if (text && text.length + 1 + s.length > max) {
      out.push({ text, sentences, starts });
      text = "";
      sentences = [];
      starts = [];
    }
    if (text) text += " ";
    starts.push(text.length);
    sentences.push(i);
    text += s;
  });
  if (text) out.push({ text, sentences, starts });
  return out;
}

/** Which sentence of an utterance a spoken character index falls in. */
export function sentenceAt(u: Utterance, charIndex: number): number {
  let k = 0;
  for (let i = 0; i < u.starts.length; i++) if (u.starts[i]! <= charIndex) k = i;
  return u.sentences[k]!;
}

/** The nth word (0-based) of a spoken sentence that a character index falls on. */
export function wordIndexAt(spokenSentence: string, charInSentence: number): number {
  const before = spokenSentence.slice(0, Math.max(0, charInSentence));
  const words = before.match(/\S+/g);
  // A boundary sits at the START of a word, so the words before it are its index.
  return words ? words.length - (/\S$/.test(before) ? 1 : 0) : 0;
}

/** The length, in spoken characters, of the whole lesson and of everything before a point. */
export function progressOf(chunks: readonly Chunk[], chunk: number, sentence: number, within = 0): number {
  let total = 0;
  let done = 0;
  chunks.forEach((c, ci) =>
    c.spoken.forEach((s, si) => {
      total += s.length;
      if (ci < chunk || (ci === chunk && si < sentence)) done += s.length;
      if (ci === chunk && si === sentence) done += Math.min(within, s.length);
    }),
  );
  return total === 0 ? 0 : done / total;
}

/** Roughly how long a sentence takes to say, for the bar's glide where no word events come. */
export function estimateMs(spoken: string, rate: number): number {
  // ~14 characters a second at rate 1 for an English voice.
  return Math.max(400, (spoken.length / 14 / rate) * 1000);
}

/* ------------------------------------------------------------------ voices */

export interface VoiceLike {
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
}

/**
 * English voices, best first. Neural voices name themselves ("Natural",
 * "Neural", "Online", "Google", "Enhanced", "Premium"); the oldest local ones
 * (Microsoft David/Zira, eSpeak) are what browsers fall back to and sound worst.
 */
export function rankVoices<V extends VoiceLike>(voices: readonly V[]): V[] {
  const score = (v: V): number => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural/.test(n)) s += 6;
    if (/online/.test(n)) s += 3;
    if (/google/.test(n)) s += 3;
    if (/enhanced|premium|siri/.test(n)) s += 3;
    if (/espeak|david|zira|mark\b/.test(n)) s -= 3;
    if (!v.localService) s += 1;
    if (/^en[-_](us|gb)/i.test(v.lang)) s += 1;
    return s;
  };
  return voices
    .filter((v) => /^en\b|^en[-_]/i.test(v.lang))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

/** How long one utterance may be for this voice. */
export function maxCharsFor(voice: VoiceLike | null): number {
  return voice && /google/i.test(voice.name) ? SHORT_CHARS : LONG_CHARS;
}

const VOICE_KEY = "octa:listen-voice";

/** The device's English voices, best first, and the one in use (remembered per device). */
export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [chosen, setChosen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VOICE_KEY);
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!speechSupported()) return;
    const read = () => setVoices(rankVoices(window.speechSynthesis.getVoices()));
    read();
    window.speechSynthesis.addEventListener?.("voiceschanged", read);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", read);
  }, []);
  const voice = voices.find((v) => v.name === chosen) ?? voices[0] ?? null;
  const choose = useCallback((name: string) => {
    setChosen(name);
    try {
      localStorage.setItem(VOICE_KEY, name);
    } catch {
      /* private window: the choice lasts for this page */
    }
  }, []);
  return { voices, voice, choose };
}

/* ------------------------------------------------------------------ playing */

export type ListenState = "idle" | "playing" | "paused";
export const RATES = [0.75, 1, 1.25, 1.5] as const;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Where the voice is: a chunk, a sentence in it, and (when the voice says) a word. */
export interface Position {
  readonly chunk: number;
  readonly sentence: number;
  /** The word within the sentence, or null when the voice sends no word events. */
  readonly word: number | null;
  /** 0..1 through the whole lesson, at the START of this sentence. */
  readonly from: number;
  /** 0..1 at the END of this sentence: the bar glides from one to the other. */
  readonly to: number;
  /** How long the glide should take; 0 when word events drive the bar instead. */
  readonly glideMs: number;
}

/**
 * Play the chunks, following them sentence by sentence. Word boundary events,
 * where the voice sends them, move the sentence and the word exactly; where it
 * does not (Google's online voices), each utterance's sentences advance on an
 * estimate of their length, and the next utterance corrects it.
 * `generation` guards against the stale events `cancel()` fires.
 */
export function useListen(chunks: readonly Chunk[], voice: SpeechSynthesisVoice | null) {
  const supported = speechSupported();
  const [state, setState] = useState<ListenState>("idle");
  const [pos, setPos] = useState<Position | null>(null);
  const [rate, setRateState] = useState<number>(1);
  const generation = useRef(0);
  const atRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(voice);
  voiceRef.current = voice;
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  const place = useCallback(
    (chunk: number, sentence: number, word: number | null, glide: boolean) => {
      const spoken = chunks[chunk]?.spoken[sentence] ?? "";
      setPos({
        chunk,
        sentence,
        word,
        from: progressOf(chunks, chunk, sentence),
        to: progressOf(chunks, chunk, sentence + 1),
        glideMs: glide ? estimateMs(spoken, rateRef.current) : 0,
      });
    },
    [chunks],
  );

  const speakFrom = useCallback(
    (i: number) => {
      if (!supported) return;
      const gen = ++generation.current;
      clearTimers();
      window.speechSynthesis.cancel();
      const next = (k: number) => {
        if (gen !== generation.current) return;
        clearTimers();
        if (k >= chunks.length) {
          setState("idle");
          setPos(null);
          atRef.current = 0;
          return;
        }
        atRef.current = k;
        const v = voiceRef.current;
        const plan = planUtterances(chunks[k]!, maxCharsFor(v));
        const say = (p: number) => {
          if (gen !== generation.current) return;
          clearTimers();
          if (p >= plan.length) return next(k + 1);
          const u = plan[p]!;
          let sawWord = false;
          place(k, u.sentences[0]!, null, true);
          // No word events (yet): step through this utterance's sentences on estimates.
          let t = 0;
          for (let q = 1; q < u.sentences.length; q++) {
            t += estimateMs(chunks[k]!.spoken[u.sentences[q - 1]!]!, rateRef.current);
            const s = u.sentences[q]!;
            timers.current.push(
              window.setTimeout(() => {
                if (!sawWord && gen === generation.current) place(k, s, null, true);
              }, t),
            );
          }
          const utt = new SpeechSynthesisUtterance(u.text);
          utt.rate = rateRef.current;
          if (v) {
            utt.voice = v;
            utt.lang = v.lang;
          } else {
            utt.lang = "en-US";
          }
          utt.onboundary = (e: SpeechSynthesisEvent) => {
            if (gen !== generation.current || e.name !== "word") return;
            sawWord = true;
            clearTimers();
            const s = sentenceAt(u, e.charIndex);
            const local = e.charIndex - u.starts[u.sentences.indexOf(s)]!;
            const word = wordIndexAt(chunks[k]!.spoken[s]!, local);
            setPos({
              chunk: k,
              sentence: s,
              word,
              from: progressOf(chunks, k, s, local),
              to: progressOf(chunks, k, s, local),
              glideMs: 0,
            });
          };
          utt.onend = () => say(p + 1);
          utt.onerror = (e) => {
            // "interrupted" and "canceled" are ours (stop, a new rate or voice); anything else skips on.
            if (e.error === "interrupted" || e.error === "canceled") return;
            say(p + 1);
          };
          window.speechSynthesis.speak(utt);
        };
        say(0);
      };
      setState("playing");
      next(i);
    },
    [chunks, supported, place],
  );

  const play = useCallback(() => speakFrom(0), [speakFrom]);
  const pause = useCallback(() => {
    if (!supported) return;
    clearTimers();
    window.speechSynthesis.pause();
    setState("paused");
  }, [supported]);
  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setState("playing");
  }, [supported]);
  const stop = useCallback(() => {
    generation.current++;
    clearTimers();
    if (supported) window.speechSynthesis.cancel();
    setState("idle");
    setPos(null);
    atRef.current = 0;
  }, [supported]);
  const setRate = useCallback(
    (r: number) => {
      rateRef.current = r;
      setRateState(r);
      // A new speed takes effect from the start of the paragraph being read.
      if (state === "playing") speakFrom(atRef.current);
    },
    [state, speakFrom],
  );
  /** A new voice, likewise, from the start of the paragraph being read. */
  const restart = useCallback(() => {
    if (state === "playing") speakFrom(atRef.current);
  }, [state, speakFrom]);

  // Leaving the page stops the voice; a voice reading a page you left is a bug.
  useEffect(
    () => () => {
      generation.current++;
      clearTimers();
      if (speechSupported()) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, state, pos, rate, play, pause, resume, stop, setRate, restart };
}

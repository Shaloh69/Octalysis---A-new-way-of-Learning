import { useCallback, useEffect, useRef, useState } from "react";
import { parseBlocks, plain, type Block } from "./markdown";

/**
 * The audiobook (instructor rulings, 6 Oct 2026; docs/FIGURES-AND-AUDIO.md):
 * the stage's approved lesson text, read aloud by the browser's own voice
 * (the Web Speech API: free, no key, nothing stored). Recorded MP3s from
 * Google Cloud TTS are the next step (instructor, 6 Oct 2026).
 *
 * "Intonation and voice quality is horrible" (instructor, 6 Oct 2026). Two
 * causes, both fixed here: no voice was ever chosen, so browsers used their
 * oldest robotic one; and every SENTENCE was its own utterance, so the voice
 * restarted its intonation at every full stop. Now the best English voice the
 * device has is chosen (a natural or online one first), the student may pick
 * another, and a whole paragraph is spoken at once where the voice allows it.
 *
 * It reads the blocks in order and skips what does not survive being spoken:
 * code listings are read as nothing, a figure only as its caption. Symbols
 * are said as words. Never offered on a paper (hard rule 9).
 */

/** One stretch of reading (a paragraph, a heading, a list item), and its block. */
export interface Chunk {
  readonly block: number;
  readonly text: string;
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
      // A table is read row by row, each cell named by its column when there is a head.
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
 * Split text into pieces of at most `max` characters, keeping whole sentences
 * together where they fit, then breaking a long sentence at a comma or space.
 */
export function sentences(text: string, max = SHORT_CHARS): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  const pieces: string[] = [];
  for (const s of flat.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [flat]) {
    let rest = s.trim();
    while (rest.length > max) {
      // Search back from just under the limit, so the piece (with its comma) still fits.
      const cut = Math.max(rest.lastIndexOf(", ", max - 2), rest.lastIndexOf(" ", max - 1));
      const at = cut > 40 ? cut + 1 : max;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) pieces.push(rest);
  }
  // Group consecutive sentences back together up to the limit: fewer restarts, better intonation.
  const out: string[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last !== undefined && last.length + 1 + p.length <= max) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  return out;
}

/**
 * Everything to be read, in order: one chunk per paragraph, heading or list
 * item. `blocks` is the reader's own list (kind, body); an index here is the
 * reader's block index.
 */
export function speakable(blocks: ReadonlyArray<{ kind: string; body: string }>): Chunk[] {
  const out: Chunk[] = [];
  blocks.forEach((b, block) => {
    if (b.kind === "code") return;
    for (const piece of parseBlocks(b.body ?? "").flatMap(blockText)) {
      const text = speechText(piece);
      if (text && text !== ".") out.push({ block, text });
    }
  });
  return out;
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
  return voices.filter((v) => /^en\b|^en[-_]/i.test(v.lang)).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
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

/**
 * Play the chunks. Each chunk is spoken as one utterance, or as a few if the
 * voice needs them short. `generation` guards against the stale end events
 * that `cancel()` fires on the utterance it interrupts.
 */
export function useListen(chunks: readonly Chunk[], voice: SpeechSynthesisVoice | null) {
  const supported = speechSupported();
  const [state, setState] = useState<ListenState>("idle");
  const [at, setAt] = useState(0);
  const [rate, setRateState] = useState<number>(1);
  const generation = useRef(0);
  const atRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(voice);
  voiceRef.current = voice;

  const speakFrom = useCallback(
    (i: number) => {
      if (!supported) return;
      const gen = ++generation.current;
      window.speechSynthesis.cancel();
      const next = (k: number) => {
        if (gen !== generation.current) return;
        if (k >= chunks.length) {
          setState("idle");
          setAt(0);
          atRef.current = 0;
          return;
        }
        atRef.current = k;
        setAt(k);
        const v = voiceRef.current;
        const parts = sentences(chunks[k]!.text, maxCharsFor(v));
        const say = (p: number) => {
          if (gen !== generation.current) return;
          if (p >= parts.length) return next(k + 1);
          const u = new SpeechSynthesisUtterance(parts[p]!);
          u.rate = rateRef.current;
          if (v) {
            u.voice = v;
            u.lang = v.lang;
          } else {
            u.lang = "en-US";
          }
          u.onend = () => say(p + 1);
          u.onerror = (e) => {
            // "interrupted" and "canceled" are ours (stop, a new rate or voice); anything else skips on.
            if (e.error === "interrupted" || e.error === "canceled") return;
            say(p + 1);
          };
          window.speechSynthesis.speak(u);
        };
        say(0);
      };
      setState("playing");
      next(i);
    },
    [chunks, supported],
  );

  const play = useCallback(() => speakFrom(0), [speakFrom]);
  const pause = useCallback(() => {
    if (!supported) return;
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
    if (supported) window.speechSynthesis.cancel();
    setState("idle");
    setAt(0);
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
      if (speechSupported()) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, state, at, rate, play, pause, resume, stop, setRate, restart };
}

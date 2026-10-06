import { useCallback, useEffect, useRef, useState } from "react";
import { parseBlocks, plain, type Block } from "./markdown";

/**
 * The audiobook (instructor rulings, 6 Oct 2026; docs/FIGURES-AND-AUDIO.md):
 * the stage's approved lesson text, read aloud by the browser's own voice
 * (the Web Speech API: free, no key, nothing stored; the voice varies by
 * device). Pre-recorded MP3s are a later upgrade.
 *
 * It reads the blocks in order and skips what does not survive being spoken:
 * code listings are read as nothing, a figure only as its caption. It is never
 * offered on a paper (hard rule 9): only the reader mounts it.
 */

/** One stretch of speech, and the block it belongs to (for the highlight). */
export interface Chunk {
  readonly block: number;
  readonly text: string;
}

/** Longer utterances are cut off by some engines (Chrome stops after ~15 s). */
const MAX_CHARS = 220;

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

/** Split a paragraph at sentence ends, then at commas, so no piece is too long to speak whole. */
export function sentences(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  const out: string[] = [];
  for (const s of flat.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [flat]) {
    let rest = s.trim();
    while (rest.length > MAX_CHARS) {
      // Search back from just under the limit, so the piece (with its comma) still fits.
      const cut = Math.max(rest.lastIndexOf(", ", MAX_CHARS - 2), rest.lastIndexOf(" ", MAX_CHARS - 1));
      const at = cut > 40 ? cut + 1 : MAX_CHARS;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * Everything to be spoken, in reading order. `blocks` is the reader's own
 * list (kind, body); an index here is the reader's block index.
 */
export function speakable(blocks: ReadonlyArray<{ kind: string; body: string }>): Chunk[] {
  const out: Chunk[] = [];
  blocks.forEach((b, block) => {
    if (b.kind === "code") return;
    for (const piece of parseBlocks(b.body ?? "").flatMap(blockText)) {
      for (const text of sentences(piece)) out.push({ block, text });
    }
  });
  return out;
}

export type ListenState = "idle" | "playing" | "paused";
export const RATES = [0.75, 1, 1.25, 1.5] as const;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/**
 * Play the chunks, one utterance each. `generation` guards against the stale
 * end events that `cancel()` fires on the utterance it interrupts.
 */
export function useListen(chunks: readonly Chunk[]) {
  const supported = speechSupported();
  const [state, setState] = useState<ListenState>("idle");
  const [at, setAt] = useState(0);
  const [rate, setRateState] = useState<number>(1);
  const generation = useRef(0);
  const atRef = useRef(0);
  const rateRef = useRef(1);

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
        const u = new SpeechSynthesisUtterance(chunks[k]!.text);
        u.rate = rateRef.current;
        u.lang = "en";
        u.onend = () => next(k + 1);
        u.onerror = (e) => {
          // "interrupted" and "canceled" are ours (stop, a new rate); anything else skips on.
          if (e.error === "interrupted" || e.error === "canceled") return;
          next(k + 1);
        };
        window.speechSynthesis.speak(u);
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
      // A new speed takes effect from the start of the sentence being read.
      if (state === "playing") speakFrom(atRef.current);
    },
    [state, speakFrom],
  );

  // Leaving the page stops the voice; a voice reading a page you left is a bug.
  useEffect(
    () => () => {
      generation.current++;
      if (speechSupported()) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, state, at, rate, play, pause, resume, stop, setRate };
}

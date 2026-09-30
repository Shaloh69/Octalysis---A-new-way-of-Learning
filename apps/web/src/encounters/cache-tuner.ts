/**
 * Cache Tuner: moon 04.5, "Compute for cache addresses and size"
 * (WEB-REVAMP 3.6, approved 30 Sep 2026; GAME-DESIGN.md §11).
 *
 * HARD RULE 5. The relations are the book's (Stallings ch. 4, §4.3, "Mapping
 * Function": word = log₂ block size, line or set = log₂ lines or sets, tag =
 * whatever is left) and stage 04's reading states them the same way. The
 * address is the book's Example 4.2: 24 bits, for 16 MB of byte-addressable
 * main memory. Five configurations are the sources' own worked examples, and
 * when the dials land on one the bench quotes it. `test/cache-tuner.spec.ts`
 * checks every quote against its file and every example against the arithmetic.
 *
 * NOT BUILT, AND WHY: GAME-DESIGN §11 imagined a live hit-rate meter ("beat
 * 90%"). A hit rate needs an address trace, and the sources give none; one
 * made up here would be invented content. The bench computes what the moon's
 * objective asks for, the address fields and the sizes.
 *
 * IT GRADES NOTHING: nothing to answer, nothing marked, recorded or sent.
 */

export const ADDRESS_BITS = 24;

/** Ways per set; `Infinity` is fully associative (one set holding every line). */
export type Ways = 1 | 2 | 4 | 8 | typeof Infinity;

export const MAPPINGS: ReadonlyArray<{ ways: Ways; label: string }> = [
  { ways: 1, label: "Direct mapped" },
  { ways: 2, label: "2-way set associative" },
  { ways: 4, label: "4-way set associative" },
  { ways: 8, label: "8-way set associative" },
  { ways: Infinity, label: "Fully associative" },
];

export interface Fields {
  /** Lines in the cache: cache bytes / line bytes. */
  lines: number;
  /** Sets: lines / ways (1 when fully associative). */
  sets: number;
  /** WORD bits: log₂(bytes per line). */
  word: number;
  /** LINE bits (direct) or SET bits (set associative); 0 when fully associative. */
  index: number;
  /** TAG bits: whatever is left of the address. */
  tag: number;
  /** "LINE", "SET" or null (fully associative has no index field). */
  indexName: "LINE" | "SET" | null;
}

const log2 = (n: number) => Math.round(Math.log2(n));

export function fields(cacheBytes: number, lineBytes: number, ways: Ways, addressBits = ADDRESS_BITS): Fields {
  const lines = cacheBytes / lineBytes;
  const sets = ways === Infinity ? 1 : lines / ways;
  const word = log2(lineBytes);
  const index = ways === Infinity ? 0 : log2(sets);
  return {
    lines,
    sets,
    word,
    index,
    tag: addressBits - index - word,
    indexName: ways === Infinity ? null : ways === 1 ? "LINE" : "SET",
  };
}

export interface SourcedExample {
  cacheBytes: number;
  lineBytes: number;
  ways: Ways;
  /** The fields the source states. */
  expect: { tag: number; index: number; word: number };
  /** The source's own words for it, quoted. */
  quote: string;
  file: "book" | "stage";
  cite: string;
}

const KB = 1024;

export const EXAMPLES: readonly SourcedExample[] = [
  {
    cacheBytes: 64 * KB, lineBytes: 4, ways: 1, expect: { tag: 8, index: 14, word: 2 },
    quote: "The 14-bit line number is used as an index into the cache to access a particular line. If the 8-bit tag number matches the tag number currently stored in that line, then the 2-bit word number is used to select one of the 4 bytes in that line.",
    file: "book", cite: "Stallings, ch. 4, §4.3, Example 4.2a",
  },
  {
    cacheBytes: 64 * KB, lineBytes: 4, ways: Infinity, expect: { tag: 22, index: 0, word: 2 },
    quote: "A main memory address consists of a 22-bit tag and a 2-bit byte number.",
    file: "book", cite: "Stallings, ch. 4, §4.3, Example 4.2b",
  },
  {
    cacheBytes: 64 * KB, lineBytes: 4, ways: 2, expect: { tag: 9, index: 13, word: 2 },
    quote: "The 13-bit set number identifies a unique set of two lines within the cache.",
    file: "book", cite: "Stallings, ch. 4, §4.3, Example 4.2c",
  },
  {
    cacheBytes: 64 * KB, lineBytes: 16, ways: 1, expect: { tag: 8, index: 12, word: 4 },
    quote: "TAG  = 24 − 12 − 4 = 8 bits",
    file: "stage", cite: "Stage 04, the reading",
  },
  {
    cacheBytes: 64 * KB, lineBytes: 16, ways: 4, expect: { tag: 10, index: 10, word: 4 },
    quote: "TAG  = 24 − 10 − 4 = 10 bits",
    file: "stage", cite: "Stage 04, the reading",
  },
];

export function exampleAt(cacheBytes: number, lineBytes: number, ways: Ways): SourcedExample | null {
  return EXAMPLES.find((e) => e.cacheBytes === cacheBytes && e.lineBytes === lineBytes && e.ways === ways) ?? null;
}

/** The book's statement of the givens, quoted (Example 4.2). */
export const GIVENS = {
  text: "The main memory consists of 16 MB, with each byte directly addressable by a 24-bit address",
  cite: "Stallings, ch. 4, §4.3, Example 4.2",
};

/** Human sizes: 65536 → "64 KB". */
export function sizeWords(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)} MB`;
  if (bytes >= 1024) return `${bytes / 1024} KB`;
  return `${bytes} B`;
}

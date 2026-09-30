/**
 * Two Columns: moon 01.2, "Differentiate Computer Organization and Computer
 * Architecture" (GAME-DESIGN.md §11; WEB-REVAMP 3.6, approved 30 Sep 2026).
 *
 * HARD RULE 5: NOTHING HERE IS INVENTED. Every card's words are quoted
 * verbatim from the source it cites, and so is the sentence that places it.
 * `test/two-columns.spec.ts` reads the cited files and fails if a quote is
 * not in them. Two sources only:
 *
 *   book   docs/source/book/ch-01.md, Stallings ch. 1, section 1.1
 *   stage  content/stages/01.md, the stage's own authored reading
 *
 * This is practice content, the same facts the reading states, not an
 * assessment item: it is never graded, never recorded, never sent anywhere,
 * and a student may skip it. It carries no score and computes none.
 */

export type Column = "architecture" | "organization";

export interface Source {
  /** Which file the words come from. */
  file: "book" | "stage";
  /** How a student is told where to look. */
  cite: string;
}

export interface Card {
  id: string;
  /** The decision, quoted. */
  text: string;
  /** The book's column. */
  column: Column;
  /** The sentence that places it, quoted. */
  why: string;
  source: Source;
}

const BOOK: Source = { file: "book", cite: "Stallings, ch. 1, §1.1" };
const STAGE: Source = { file: "stage", cite: "Stage 01, the reading" };

const BOOK_ARCH =
  "Examples of architectural attributes include the instruction set, the number of bits used to represent various data types (e.g., numbers, characters), I/O mechanisms, and techniques for addressing memory.";
const BOOK_ORG =
  "Organizational attributes include those hardware details transparent to the programmer, such as control signals; interfaces between the computer and peripherals; and the memory technology used.";

export const TWO_COLUMNS: readonly Card[] = [
  { id: "isa", text: "the instruction set", column: "architecture", why: BOOK_ARCH, source: BOOK },
  { id: "control", text: "control signals", column: "organization", why: BOOK_ORG, source: BOOK },
  {
    id: "bits",
    text: "the number of bits used to represent various data types",
    column: "architecture",
    why: BOOK_ARCH,
    source: BOOK,
  },
  {
    id: "interfaces",
    text: "interfaces between the computer and peripherals",
    column: "organization",
    why: BOOK_ORG,
    source: BOOK,
  },
  { id: "io", text: "I/O mechanisms", column: "architecture", why: BOOK_ARCH, source: BOOK },
  { id: "memtech", text: "the memory technology used", column: "organization", why: BOOK_ORG, source: BOOK },
  { id: "addressing", text: "techniques for addressing memory", column: "architecture", why: BOOK_ARCH, source: BOOK },
  {
    id: "multiply-unit",
    text: "whether that instruction will be implemented by a special multiply unit",
    column: "organization",
    why: "It is an organizational issue whether that instruction will be implemented by a special multiply unit or by a mechanism that makes repeated use of the add unit of the system.",
    source: BOOK,
  },
  {
    id: "multiply-instr",
    text: "whether a computer will have a multiply instruction",
    column: "architecture",
    why: "it is an architectural design issue whether a computer will have a multiply instruction.",
    source: BOOK,
  },
  { id: "cache", text: "Cache", column: "organization", why: "Cache — organization; a program cannot see it, only feel it.", source: STAGE },
  { id: "registers", text: "Number of registers", column: "architecture", why: "Number of registers — architecture.", source: STAGE },
  { id: "pipelining", text: "Pipelining", column: "organization", why: "Pipelining — organization.", source: STAGE },
];

export const COLUMN_WORD: Record<Column, string> = {
  architecture: "Architecture",
  organization: "Organization",
};

/** What each column means, quoted from the book, shown above the columns. */
export const COLUMN_RULE: Record<Column, { text: string; source: Source }> = {
  architecture: {
    text: "those attributes of a system visible to a programmer",
    source: BOOK,
  },
  organization: {
    text: "the operational units and their interconnections that realize the architectural specifications",
    source: BOOK,
  },
};

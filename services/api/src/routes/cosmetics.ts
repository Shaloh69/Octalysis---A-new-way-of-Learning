import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { identityFrom } from "../auth.js";
import type { Env } from "../env.js";

/**
 * Per-student cosmetic seeding.
 *
 * THE BOUNDARY THIS FILE EXISTS TO HOLD, stated before anything else because it
 * is the whole reason the endpoint is separate:
 *
 *   "Each student gets a unique game" and "each student gets a unique exam
 *   paper" are two different mechanisms and must stay two different mechanisms.
 *
 * The exam paper's uniqueness is a FAIRNESS guarantee. Its seed is
 * `sha256(studentId ‖ stageId ‖ attemptNo ‖ examSalt)` in
 * `services/api/src/engine/seed.ts`, it embeds `EXAM_SALT_SECRET`, and that
 * construction is written out in `docs/redesign/SOLAR-SYSTEM-SPEC.md` §3 —
 * public. Any value derived from it and computed in a browser would therefore
 * be a bruteforce oracle against the salt.
 *
 * The solar system's uniqueness is COSMETIC. It decides what a student looks
 * at, never what they can do, learn, attempt or be graded on.
 *
 * So: this file derives from `student_id` ALONE, it does not import from
 * `../engine/seed.js`, and it never sees `EXAM_SALT_SECRET`.
 * `scripts/check-redesign-boundary.mjs` enforces the import rule, and
 * `services/api/test/cosmetics.spec.ts` enforces the behaviour.
 *
 * The hash here is deliberately NOT hardened the way the exam seed is. Someone
 * working out that their seatmate's planets are palette variant 2 has learned
 * nothing and gained nothing. Treating a cosmetic like a secret would imply the
 * two mechanisms are the same kind of thing, which is the exact confusion this
 * whole design is trying to prevent.
 *
 * There was no avatar system to match, either: `DESIGN-MANDATE.md` §4 specifies
 * DiceBear seeded from `student_id`, but nothing implements it yet. This is the
 * FIRST consumer of that seed, not a second one — so when the avatar is built,
 * it should read this endpoint rather than growing a second derivation.
 */

/** Bump when a derivation changes, so a student's look is stable until then. */
const COSMETIC_VERSION = "octa-cosmetic-v1";

export interface Cosmetics {
  /** Radians, 0 to 2π. Rotates the ENTIRE system by one angle. */
  readonly rotationOffset: number;
  /** Which pre-computed, contrast-checked planet palette. */
  readonly paletteVariant: number;
  /** A registry-style name. Cosmetic only, never an identifier. */
  readonly callsign: string;
  /** Which landing biome, 0-6. See BIOME-AND-LOADING-SPEC.md §2. */
  readonly biomeIndex: number;
}

export const PALETTE_VARIANTS = 4;
export const BIOMES = [
  "neutral",
  "jungle",
  "desert",
  "arctic",
  "city",
  "cave",
  "ocean",
] as const;

/**
 * Callsign vocabulary.
 *
 * Deliberately shaped so it can never be mistaken for, or collide with, a real
 * student number — those are nine digits (`232129001`). A word plus two hex
 * characters cannot collide with that, which is the actual requirement in
 * `SOLAR-SYSTEM-SPEC.md` §3 ("not used as an identifier anywhere it could
 * collide with a real one").
 */
const CALLSIGN_WORDS = [
  "KESTREL", "MERIDIAN", "LANTERN", "HARBOUR", "QUARRY", "BEACON",
  "TRESTLE", "GANTRY", "CINDER", "FATHOM", "PARAPET", "SEXTANT",
  "BALLAST", "KEYSTONE", "MARLIN", "CALIPER",
] as const;

/** Deterministic 32-bit words from a key. No secret, by design. */
function digestWords(key: string): number[] {
  const h = createHash("sha256").update(`${COSMETIC_VERSION}:${key}`).digest();
  const words: number[] = [];
  for (let i = 0; i < 8; i += 1) words.push(h.readUInt32BE(i * 4));
  return words;
}

/**
 * Derive every cosmetic from one key. Pure, so it is testable without a server.
 *
 * `key` is the student's `student_id`. Staff have none, so callers pass the
 * user id instead — staff see the map for support and QA, and a stable look is
 * better than a crash or a constant.
 */
export function deriveCosmetics(key: string): Cosmetics {
  const [w0, w1, w2, w3] = digestWords(key) as [number, number, number, number];

  const word = CALLSIGN_WORDS[w2 % CALLSIGN_WORDS.length] ?? CALLSIGN_WORDS[0];
  const tag = (w3 % 256).toString(16).toUpperCase().padStart(2, "0");

  return {
    // A single angle for the WHOLE system. Never per-ring and never per-planet:
    // a global rotation cannot disturb relative ordering or any radius, which
    // is precisely what keeps it cosmetic now that angle carries real `ordinal`
    // data and radius carries the level hierarchy.
    rotationOffset: (w0 / 0xffffffff) * Math.PI * 2,
    paletteVariant: w1 % PALETTE_VARIANTS,
    callsign: `${word}-${tag}`,
    biomeIndex: (w1 >>> 8) % BIOMES.length,
  };
}

export function registerCosmeticRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/cosmetics -- this student's look. Read-only.
   * -------------------------------------------------------- */
  app.get("/api/v1/cosmetics", async (req) => {
    const id = await identityFrom(req, env);

    // `student_id` is the intended key. Staff accounts have none; falling back
    // to the user id keeps the endpoint total rather than special-casing an
    // error for a case that carries no stakes either way.
    const key = id.studentId ?? id.userId;

    return {
      ...deriveCosmetics(key),
      // Echoed so a client can tell one derivation generation from another
      // without guessing, and so a stale cached look is diagnosable.
      version: COSMETIC_VERSION,
      biomes: BIOMES,
    };
  });
}

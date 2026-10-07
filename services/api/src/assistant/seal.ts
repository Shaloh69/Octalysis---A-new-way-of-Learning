import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { ApiEngineId } from "@octa/contracts/assistant";

/**
 * Sealing a teacher's engine key (docs/AI-ASSISTANT-PLAN.md §4-now;
 * .claude/rules/assistant.md "Keys").
 *
 * AES-256-GCM, with a key derived (HKDF-SHA256) from ASSISTANT_KEY_SECRET, which
 * exists only in Render's environment. The sealed bytes are
 *     nonce (12) | tag (16) | ciphertext
 * which is what `assistant_engine_keys.sealed` holds (at least 29 bytes).
 *
 * The owner and the engine are the cipher's associated data: a sealed key copied
 * onto another teacher's row, or filed under another engine, does not open. The
 * database's foreign key stops teacher B's job running on teacher A's key row;
 * this stops A's sealed bytes being made into B's row.
 *
 * A key is never logged, never returned by a route, never in an error message.
 * What the page may see is its last four characters.
 */

export interface SealScope {
  ownerId: string;
  engine: ApiEngineId;
}

const NONCE = 12;
const TAG = 16;
const INFO = "octa assistant engine keys v1";

export class SealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealError";
  }
}

function keyFrom(secret: string): Buffer {
  if (secret.length < 32) throw new SealError("ASSISTANT_KEY_SECRET is shorter than 32 characters");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), INFO, 32));
}

function aad(scope: SealScope): Buffer {
  return Buffer.from(`${scope.ownerId}:${scope.engine}`, "utf8");
}

export function seal(secret: string, scope: SealScope, plaintext: string): Buffer {
  if (plaintext.length === 0) throw new SealError("an empty key is not a key");
  const nonce = randomBytes(NONCE);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), nonce);
  cipher.setAAD(aad(scope));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]);
}

/** Opens a sealed key, or throws SealError. The message never holds key material. */
export function open(secret: string, scope: SealScope, sealed: Buffer): string {
  if (sealed.length < NONCE + TAG + 1) throw new SealError("sealed key is too short");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), sealed.subarray(0, NONCE));
  decipher.setAAD(aad(scope));
  decipher.setAuthTag(sealed.subarray(NONCE, NONCE + TAG));
  try {
    return Buffer.concat([decipher.update(sealed.subarray(NONCE + TAG)), decipher.final()]).toString("utf8");
  } catch {
    throw new SealError("sealed key did not open: wrong secret, wrong owner or engine, or altered bytes");
  }
}

/** What the page is shown: "ends ••••a1f3". */
export function last4(plaintext: string): string {
  const t = plaintext.trim();
  return t.length >= 4 ? t.slice(-4) : t.padStart(4, "•");
}

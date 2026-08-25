import { createPublicKey, verify as cryptoVerify } from "node:crypto";

/**
 * Asymmetric JWT verification against Supabase's JWKS endpoint.
 *
 * WHY THIS EXISTS, and it is a correction rather than an addition.
 *
 * `auth.ts` originally verified tokens with HS256 against a shared
 * `SUPABASE_JWT_SECRET`. That is the LEGACY Supabase scheme. This project's
 * keys are the new format (`sb_publishable_` / `sb_secret_`), and the project's
 * JWKS reports:
 *
 *     { "alg": "ES256", "kty": "EC", "crv": "P-256", ... }
 *
 * ES256 is ECDSA over P-256 — asymmetric. There is no shared secret to verify
 * against, so the HS256 path would have rejected every real token. It passed
 * its tests only because those tests minted HS256 tokens themselves, which is
 * the classic shape of a test that validates the mock rather than the system.
 *
 * Two details that are easy to get wrong:
 *
 *  1. A JWT's ECDSA signature is raw `R || S` (64 bytes for P-256). Node's
 *     `crypto.verify` expects DER unless told otherwise, so `dsaEncoding` must
 *     be `ieee-p1363`. Without it every signature fails and the failure looks
 *     like a bad token.
 *  2. Keys rotate. The JWKS is cached, but a `kid` miss forces one refetch
 *     before giving up — otherwise a rotation locks every user out until the
 *     service restarts.
 */

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
}

interface CacheEntry {
  keys: Map<string, Jwk>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

async function fetchJwks(supabaseUrl: string, apikey: string): Promise<Map<string, Jwk>> {
  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, {
    headers: { apikey },
  });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const map = new Map<string, Jwk>();
  for (const k of body.keys ?? []) if (k.kid) map.set(k.kid, k);
  if (map.size === 0) throw new Error("JWKS contained no usable keys");
  return map;
}

async function getKey(
  supabaseUrl: string,
  apikey: string,
  kid: string,
  allowRefetch = true,
): Promise<Jwk> {
  const entry = cache.get(supabaseUrl);
  const fresh = entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;

  if (fresh && entry.keys.has(kid)) return entry.keys.get(kid)!;

  if (!fresh || (allowRefetch && !entry?.keys.has(kid))) {
    const keys = await fetchJwks(supabaseUrl, apikey);
    cache.set(supabaseUrl, { keys, fetchedAt: Date.now() });
    const found = keys.get(kid);
    if (found) return found;
  }

  throw new Error(`no JWKS key matches kid ${kid}`);
}

const b64urlToBuf = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Algorithms we accept. `none` and HS* are refused outright. */
const ALLOWED = new Set(["ES256", "RS256"]);

export interface VerifiedJwt {
  sub?: string;
  email?: string;
  exp?: number;
  aud?: string | string[];
  app_metadata?: { role?: string; student_id?: string };
}

/**
 * Verify an asymmetrically-signed Supabase access token.
 *
 * Throws on any failure. The CALLER converts that into one generic message —
 * a token that says why it was rejected is an oracle.
 */
export async function verifyAsymmetricJwt(
  token: string,
  opts: { supabaseUrl: string; apikey: string; audience?: string },
): Promise<VerifiedJwt> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const header = JSON.parse(b64urlToBuf(headerB64).toString("utf8")) as {
    alg?: string;
    kid?: string;
  };

  // Refusing `alg: none` and algorithm-substitution is the whole reason this is
  // an allow-list rather than a switch on whatever the token claims.
  if (!header.alg || !ALLOWED.has(header.alg)) {
    throw new Error(`unacceptable alg: ${header.alg}`);
  }
  if (!header.kid) throw new Error("token has no kid");

  const jwk = await getKey(opts.supabaseUrl, opts.apikey, header.kid);
  const publicKey = createPublicKey({ key: jwk as never, format: "jwk" });

  const signed = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = b64urlToBuf(sigB64);

  const ok =
    header.alg === "ES256"
      ? cryptoVerify("sha256", signed, { key: publicKey, dsaEncoding: "ieee-p1363" }, signature)
      : cryptoVerify("sha256", signed, publicKey, signature);

  if (!ok) throw new Error("signature does not verify");

  const payload = JSON.parse(b64urlToBuf(payloadB64).toString("utf8")) as VerifiedJwt;

  if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) {
    throw new Error("token expired");
  }
  if (opts.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(opts.audience)) throw new Error("audience mismatch");
  }

  return payload;
}

/** Test seam: drop the cached JWKS so a rotation test can force a refetch. */
export function clearJwksCache(): void {
  cache.clear();
}

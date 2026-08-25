import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyAsymmetricJwt, clearJwksCache } from "../src/jwks.js";

/**
 * Verify a REAL Supabase-issued token, not one this suite minted.
 *
 * This test exists because the rest of the auth suite mints its own HS256
 * tokens, which validates the mock rather than the system. Supabase's current
 * keys sign with ES256 against a JWKS endpoint, so every real token would have
 * been REJECTED by the HS256 path and no self-minted test could have shown it.
 *
 * Skips cleanly when `.env` has no Supabase credentials, so CI without secrets
 * is not red -- but says so loudly rather than passing silently.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function readEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(resolve(ROOT, ".env"), "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const env = readEnv();
const LIVE = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);

const adminHeaders = {
  "content-type": "application/json",
  apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
};

let userId: string | null = null;
let accessToken: string | null = null;
const EMAIL = `octa-jwks-${Date.now()}@octa-test.local`;
const PASSWORD = "correct horse battery staple";

beforeAll(async () => {
  if (!LIVE) return;

  const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role: "student", student_id: "21-JWKS" },
    }),
  });
  const body = (await created.json()) as { id?: string };
  userId = body.id ?? null;

  const signin = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: env.SUPABASE_ANON_KEY! },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const tok = (await signin.json()) as { access_token?: string };
  accessToken = tok.access_token ?? null;
}, 60_000);

afterAll(async () => {
  if (LIVE && userId) {
    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: adminHeaders,
    }).catch(() => {});
  }
});

describe.skipIf(!LIVE)("JWKS verification against a REAL Supabase token", () => {
  it("obtained a live token to test with", () => {
    expect(accessToken, "no access token -- check .env credentials").toBeTruthy();
  });

  it("the token really is ES256, not HS256", () => {
    // The finding that made src/jwks.ts necessary. If this ever flips back to
    // HS256, the legacy path in auth.ts becomes correct again and this test
    // should be the thing that tells you.
    const header = JSON.parse(
      Buffer.from(accessToken!.split(".")[0]!, "base64url").toString("utf8"),
    ) as { alg: string; kid: string };
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBeTruthy();
  });

  it("verifies, and carries the claims RLS depends on", async () => {
    const payload = await verifyAsymmetricJwt(accessToken!, {
      supabaseUrl: env.SUPABASE_URL!,
      apikey: env.SUPABASE_ANON_KEY!,
      audience: "authenticated",
    });
    expect(payload.sub).toBe(userId);
    // jwt_role() and is_stage_unlocked() both read these.
    expect(payload.app_metadata?.role).toBe("student");
    expect(payload.app_metadata?.student_id).toBe("21-JWKS");
  });

  it("REJECTS a token whose signature has been altered", async () => {
    const [h, p, s] = accessToken!.split(".") as [string, string, string];
    // Flip one character of the signature.
    const tampered = `${h}.${p}.${s.slice(0, -2)}${s.slice(-2) === "AA" ? "BB" : "AA"}`;
    await expect(
      verifyAsymmetricJwt(tampered, {
        supabaseUrl: env.SUPABASE_URL!,
        apikey: env.SUPABASE_ANON_KEY!,
      }),
    ).rejects.toThrow();
  });

  it("REJECTS a token whose payload has been altered but signature kept", async () => {
    // The attack that matters: escalate role to admin and keep the signature.
    const [h, , s] = accessToken!.split(".") as [string, string, string];
    const forged = Buffer.from(
      JSON.stringify({ sub: userId, aud: "authenticated", app_metadata: { role: "admin" } }),
    ).toString("base64url");
    await expect(
      verifyAsymmetricJwt(`${h}.${forged}.${s}`, {
        supabaseUrl: env.SUPABASE_URL!,
        apikey: env.SUPABASE_ANON_KEY!,
      }),
    ).rejects.toThrow();
  });

  it("REFUSES alg:none outright", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", kid: "x" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: userId })).toString("base64url");
    await expect(
      verifyAsymmetricJwt(`${header}.${payload}.`, {
        supabaseUrl: env.SUPABASE_URL!,
        apikey: env.SUPABASE_ANON_KEY!,
      }),
    ).rejects.toThrow(/unacceptable alg/);
  });

  it("REFUSES an HS256 token even if someone knows a shared secret", async () => {
    // Algorithm substitution. Without the allow-list this is a real forgery.
    const { createHmac } = await import("node:crypto");
    const h = Buffer.from(JSON.stringify({ alg: "HS256", kid: "x" })).toString("base64url");
    const p = Buffer.from(JSON.stringify({ sub: userId, app_metadata: { role: "admin" } })).toString("base64url");
    const sig = createHmac("sha256", "guessed").update(`${h}.${p}`).digest("base64url");
    await expect(
      verifyAsymmetricJwt(`${h}.${p}.${sig}`, {
        supabaseUrl: env.SUPABASE_URL!,
        apikey: env.SUPABASE_ANON_KEY!,
      }),
    ).rejects.toThrow(/unacceptable alg/);
  });

  it("recovers from a cold cache", async () => {
    clearJwksCache();
    const payload = await verifyAsymmetricJwt(accessToken!, {
      supabaseUrl: env.SUPABASE_URL!,
      apikey: env.SUPABASE_ANON_KEY!,
    });
    expect(payload.sub).toBe(userId);
  });
});

describe.skipIf(LIVE)("JWKS verification — skipped", () => {
  it("has no Supabase credentials in .env, so the live checks did not run", () => {
    // Deliberately visible. A silently-skipped security test is a security test
    // you do not have.
    expect(LIVE).toBe(false);
  });
});

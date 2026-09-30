import { createHmac, randomUUID } from "node:crypto";

/**
 * A fresh exam salt. Derived from EXAM_SALT_SECRET plus a random nonce, so it is
 * reproducible from a backup of `assessment_secrets` and the server secret, and
 * unpredictable without both. One author for the console's assessments and a
 * moon's journey, so the two can never mint salts differently.
 */
export function mintSalt(secret: string, assessmentId: string): string {
  return createHmac("sha256", secret)
    .update(`assessment:${assessmentId}:${randomUUID()}`)
    .digest("hex");
}

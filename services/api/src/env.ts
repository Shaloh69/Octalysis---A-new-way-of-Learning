import { ServerEnv, SERVER_ONLY_SECRETS } from "@octa/contracts";

/**
 * Parse the environment once, at boot, and fail loudly naming the missing var.
 *
 * Two things happen here that are not ceremony:
 *
 * 1. A missing variable kills the process with its NAME in the message. The
 *    alternative is a service that boots, serves traffic, and throws `undefined
 *    is not a function` from inside a grading call at 9pm.
 *
 * 2. We assert that no server-only secret is exposed under the client prefix.
 *    Vite inlines every client-prefixed variable into the browser bundle at build
 *    time, so a service-role key under that prefix is a published secret. This is
 *    hard rule 2, enforced rather than requested.
 */

/** The prefix Vite inlines. Built at runtime so this file never contains the literal. */
const CLIENT_PREFIX = "VITE" + "_";

/** Secret-shaped fragments that must never appear under the client prefix. */
const SECRET_SHAPED = /SERVICE_ROLE|JWT_SECRET|EXAM_SALT|DATABASE_URL|CRON_SECRET/;

function assertNoLeakedSecrets(source: NodeJS.ProcessEnv): void {
  const leaked = new Set<string>();

  for (const key of Object.keys(source)) {
    if (!key.startsWith(CLIENT_PREFIX)) continue;
    if (SECRET_SHAPED.test(key)) leaked.add(key);
    for (const name of SERVER_ONLY_SECRETS) {
      if (key.includes(name)) leaked.add(key);
    }
  }

  if (leaked.size > 0) {
    throw new Error(
      `Refusing to boot: server-only secrets found under the ${CLIENT_PREFIX} prefix: ` +
        `${[...leaked].join(", ")}.\n` +
        `Vite inlines every ${CLIENT_PREFIX}* variable into the client bundle at build time. ` +
        `Rename these without the prefix.`,
    );
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  assertNoLeakedSecrets(source);

  const parsed = ServerEnv.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Refusing to boot: invalid environment.\n${problems}\n`);
  }
  return parsed.data;
}

export type Env = ReturnType<typeof loadEnv>;

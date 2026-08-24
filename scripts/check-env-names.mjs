#!/usr/bin/env node
// OCTA -- environment name guard.
//
// Vite inlines every client-prefixed variable into the browser bundle at build
// time. A service-role key, a JWT secret, an exam salt or a database URL under
// that prefix is therefore a PUBLISHED secret, not a misconfiguration.
//
// Hard rule 2, enforced rather than requested. Runs in CI and can be run by
// hand: `node scripts/check-env-names.mjs`
//
// Checks three places:
//   1. every .env* file in the repo (including ones git ignores -- a leak on a
//      developer machine still ends up in a build)
//   2. the current process environment
//   3. the built client bundles, for the literal secret VALUES

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// Built at runtime so this file never contains the literal string it forbids.
const CLIENT_PREFIX = "VITE" + "_";

const SECRET_SHAPED = /SERVICE_ROLE|JWT_SECRET|EXAM_SALT|DATABASE_URL|CRON_SECRET|PASSWORD|PRIVATE_KEY/i;

const findings = [];

function checkName(name, where) {
  if (!name.startsWith(CLIENT_PREFIX)) return;
  if (SECRET_SHAPED.test(name)) {
    findings.push({ where, detail: `${name} is server-only but carries the client prefix` });
  }
}

async function walkEnvFiles(dir, depth = 0) {
  if (depth > 4) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkEnvFiles(p, depth + 1)));
    else if (/^\.env($|\.)/.test(e.name)) out.push(p);
  }
  return out;
}

async function main() {
  console.log(c.bold("\nOCTA -- environment name guard\n"));

  // 1. process env
  for (const name of Object.keys(process.env)) checkName(name, "process env");

  // 2. .env files
  const envFiles = await walkEnvFiles(ROOT);
  const secretValues = [];
  for (const file of envFiles) {
    const rel = file.replace(ROOT, "").replace(/^[\\/]/, "");
    const text = await readFile(file, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const name = t.slice(0, eq).trim();
      const value = t.slice(eq + 1).trim();
      checkName(name, rel);

      // Collect real-looking secret VALUES so we can grep the bundles for them.
      if (SECRET_SHAPED.test(name) && value.length >= 12 && !value.includes("replace-me")) {
        secretValues.push({ name, value, file: rel });
      }
    }
  }
  console.log(c.dim(`  ${envFiles.length} env file(s) inspected`));

  // 3. built bundles, for the literal values
  const bundles = ["apps/web/dist", "apps/console/dist"].filter((d) =>
    existsSync(resolve(ROOT, d)),
  );
  let scanned = 0;
  for (const dir of bundles) {
    const stack = [resolve(ROOT, dir)];
    while (stack.length) {
      const current = stack.pop();
      let entries;
      try {
        entries = await readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = join(current, e.name);
        if (e.isDirectory()) {
          stack.push(p);
          continue;
        }
        if (!/\.(js|mjs|cjs|html|css|json|map)$/.test(e.name)) continue;
        const info = await stat(p);
        if (info.size > 30 * 1024 * 1024) continue;
        const text = await readFile(p, "utf8");
        scanned++;
        for (const s of secretValues) {
          if (text.includes(s.value)) {
            findings.push({
              where: p.replace(ROOT, "").replace(/^[\\/]/, ""),
              detail: `contains the VALUE of ${s.name} (from ${s.file})`,
            });
          }
        }
      }
    }
  }
  console.log(c.dim(`  ${scanned} built file(s) scanned across ${bundles.length} bundle(s)`));
  console.log(c.dim(`  ${secretValues.length} secret value(s) available to grep for`));

  if (findings.length === 0) {
    console.log(c.green("\n  Clean. No server-only secret is reachable from the client.\n"));
    process.exit(0);
  }

  console.log(c.red(`\n  ${findings.length} finding(s):\n`));
  for (const f of findings) {
    console.log(`    ${c.red(f.where)}`);
    console.log(`      ${c.dim(f.detail)}`);
  }
  console.log(
    c.red(
      `\n  Every ${CLIENT_PREFIX}* variable is inlined into the browser bundle at build time.\n` +
        `  Rename these without the prefix. See hard rule 2.\n`,
    ),
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(c.red(`\n${err.stack || err.message}\n`));
  process.exit(1);
});

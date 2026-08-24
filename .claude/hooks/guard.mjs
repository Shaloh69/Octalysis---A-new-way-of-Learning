// Blocks the four worst failure modes before they reach disk.
// Anything enforceable mechanically should not be a request in CLAUDE.md.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const path = input.tool_input?.file_path ?? "";
const body = input.tool_input?.content ?? input.tool_input?.new_string ?? "";

const deny = (reason) => {
  console.error(reason);
  process.exit(2); // exit 2 blocks the tool call and surfaces the reason
};

const inClient = path.includes("/apps/");

if (inClient && /SERVICE_ROLE/.test(body))
  deny("Blocked: service role key referenced in a client package. Server-only.");

if (/VITE_[A-Z_]*SERVICE_ROLE/.test(body))
  deny("Blocked: VITE_ vars are inlined into the client bundle at build time.");

if (inClient && !path.includes("/packages/tokens/") && /#[0-9a-fA-F]{6}\b/.test(body))
  deny("Blocked: literal hex color. Use a token from packages/tokens — the per-student accent depends on it.");

if (inClient && /(engine\/solvers|correct_value)/.test(body))
  deny("Blocked: answer-key surface referenced in a client package.");

process.exit(0);

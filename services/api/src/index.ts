import { loadEnv } from "./env.js";
import { buildServer } from "./server.js";

/**
 * Boot. Environment is parsed before anything else so a missing variable kills
 * the process with its name in the message, rather than surfacing as a runtime
 * error inside a grading call.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer(env);

  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void close("SIGTERM"));
  process.on("SIGINT", () => void close("SIGINT"));

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

import { useEffect, useState } from "react";
import { wakeApi } from "@/lib/api";
import { useDelayed } from "@/lib/useDelayed";
import type { ReadoutLine } from "@/components/GateFrame";

export type WakeState = "waking" | "online" | "no-answer";

/**
 * Wake the API on arrival and report how it went (`wakeApi` says why).
 *
 * Returns the readout line and, when there is something to say, the sentence
 * that says it. Nothing is said while the server answers quickly: under 3s
 * the wake is invisible except for its readout line, per design.md's rule that
 * a slow wait is said in words and a fast one is not said at all.
 */
export function useApiWake(): { line: ReadoutLine; notice: JSX.Element | null } {
  const [state, setState] = useState<WakeState>("waking");
  const slow = useDelayed(state === "waking", 3_000);

  useEffect(() => {
    let alive = true;
    void wakeApi().then((ok) => {
      if (alive) setState(ok ? "online" : "no-answer");
    });
    return () => {
      alive = false;
    };
  }, []);

  const line: ReadoutLine =
    state === "online"
      ? { label: "SERVER", value: "ONLINE" }
      : state === "no-answer"
        ? { label: "SERVER", value: "NO ANSWER", tone: "warn" }
        : { label: "SERVER", value: "WAKING" };

  const notice =
    state === "no-answer" ? (
      <p role="status" className="mt-3 text-xs text-ink-muted">
        The console&apos;s server did not answer. Signing in still works, but the pages behind it may
        not load until it does.
      </p>
    ) : slow ? (
      <p role="status" className="mt-3 text-xs text-ink-muted">
        The console&apos;s server was asleep and is starting up. Carry on: it should be ready by the
        time you have signed in.
      </p>
    ) : null;

  return { line, notice };
}

import { useEffect, useState } from "react";
import type { StageNode } from "../lib/api";

/**
 * Detects a planet forming — a stage that has just become reachable.
 *
 * `SOLAR-SYSTEM-SPEC.md` §1.4b: only planets the student has reached render in
 * the 3D scene, and on completing a stage the next one **forms**, with a calm
 * notification.
 *
 * HOW "just": the set of revealed stage ids is remembered per device. A stage
 * present now and absent from the remembered set has formed since the last
 * visit. That is deliberately not a server concern — nothing here is gradeable,
 * nothing here is state the server needs, and asking the API to track "have we
 * shown you this animation yet" would be a schema change for a decoration.
 * `CLAUDE.md` bans `localStorage` for anything that affects a grade; this
 * affects whether a toast appears.
 *
 * FIRST VISIT IS NOT A FORMATION EVENT. With nothing remembered, every revealed
 * planet would count as new and a student opening the map for the first time
 * would get a pile of toasts. The first run seeds the set silently.
 */
const KEY = "octa:revealed-stages";

function read(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null; // private window: no memory, so no formation events
  }
}

function write(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* private window; the toast simply never fires */
  }
}

export function useFormation(nodes: StageNode[]): { formed: StageNode | null; dismiss: () => void } {
  const [formed, setFormed] = useState<StageNode | null>(null);

  useEffect(() => {
    if (nodes.length === 0) return;
    const revealed = new Set(nodes.filter((n) => n.state !== "locked").map((n) => n.id));
    const known = read();

    if (known === null) {
      write(revealed); // first run on this device: seed, announce nothing
      return;
    }

    // Curriculum order, so if several formed at once the student is told about
    // the earliest rather than an arbitrary one.
    const fresh = nodes
      .filter((n) => revealed.has(n.id) && !known.has(n.id))
      .sort((a, b) => a.ordinal - b.ordinal);

    if (fresh.length > 0) setFormed(fresh[0] ?? null);
    write(revealed);
  }, [nodes]);

  return { formed, dismiss: () => setFormed(null) };
}

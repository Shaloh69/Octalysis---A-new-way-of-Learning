import { useEffect, useSyncExternalStore } from "react";

/**
 * What the Register Bar shows, when a route has something true to put there.
 *
 * `.claude/rules/design.md`: the bar idles in stages 00-11 and shows the
 * **question index as PC during an assessment**. The runner sets PC; nothing
 * else does yet. A module store, like the toasts, because the bar lives in the
 * shell and the paper lives in a route.
 */

export type RegisterName = "PC" | "IR" | "MAR" | "MBR" | "ACC";

export interface RegisterValue {
  value: string;
  /** What a screen reader hears for it: "question 3 of 8". */
  spoken: string;
}

let registers: Partial<Record<RegisterName, RegisterValue>> = {};
const listeners = new Set<() => void>();

function set(name: RegisterName, v: RegisterValue | null): void {
  const next = { ...registers };
  if (v) next[name] = v;
  else delete next[name];
  registers = next;
  for (const l of listeners) l();
}

export function useRegisters(): Partial<Record<RegisterName, RegisterValue>> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => registers,
  );
}

/** Hold a register at `v` while the calling component is mounted. */
export function useRegister(name: RegisterName, v: RegisterValue | null): void {
  const value = v?.value ?? null;
  const spoken = v?.spoken ?? null;
  useEffect(() => {
    set(name, value === null || spoken === null ? null : { value, spoken });
    return () => set(name, null);
  }, [name, value, spoken]);
}

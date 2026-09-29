import { useRegisters } from "../lib/registers";

const REGISTERS = ["PC", "IR", "MAR", "MBR", "ACC"] as const;
const CAST: Record<(typeof REGISTERS)[number], string> = {
  PC: "pc",
  IR: "ir",
  MAR: "mar",
  MBR: "mbr",
  ACC: "ac",
};

/**
 * The registers, reworked (WEB-REMAKE.md §0.6): the ship's readout strip in the
 * star HUD, a sprite bar inside a biome. Same information as the old Register
 * Bar (`lib/registers.ts` is unchanged: `useRegister("PC", …)` from anywhere),
 * dressed by the shell that renders it.
 *
 * Each register keeps its fixed cast colour (`--reg-*`), so PC is the same hue
 * on every screen for the whole term. Idle registers read "idle" to a screen
 * reader and `----` on screen.
 */
export function Readout({ dress }: { dress: "hud" | "sprite" }): JSX.Element {
  const live = useRegisters();
  const pc = live.PC;
  return (
    <div
      className={`readout readout-${dress}${dress === "sprite" ? " sprite-bar" : ""}`}
      data-readout
      role="status"
      aria-label={pc ? `Machine registers: program counter at ${pc.spoken}` : "Machine registers, idle"}
    >
      {dress === "hud" && <span className="readout-brand">OCTA</span>}
      <span className="readout-cells">
        {REGISTERS.map((r) => {
          const v = live[r];
          return (
            <span
              key={r}
              className={`readout-cell reg-${CAST[r]}${v ? " is-live" : ""}`}
              data-register={r}
            >
              <span className="readout-name">{r}</span>
              <span className="register-value mono">{v ? v.value : "----"}</span>
            </span>
          );
        })}
      </span>
    </div>
  );
}

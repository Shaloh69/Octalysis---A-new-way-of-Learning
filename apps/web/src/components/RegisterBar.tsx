import { useRegisters } from "../lib/registers";

/**
 * The Register Bar.
 *
 * Deliberately unexplained until Stage 12 (DESIGN-MANDATE 2). It idles now; it
 * shows real values once the simulator exists. Teaching register names by
 * osmosis over fourteen weeks is the entire point, so it is present from day
 * one and labelled for a screen reader without being explained on screen.
 *
 * **During a paper, PC is the question number** (`.claude/rules/design.md`,
 * `PAGE-SPECS.md` §/app/stage/:id/check; built 29 Sep 2026). The runner holds
 * it through `useRegister`; every other register keeps idling.
 */
const REGISTERS = ["PC", "IR", "MAR", "MBR", "ACC"] as const;

export function RegisterBar(): JSX.Element {
  const live = useRegisters();
  const pc = live.PC;
  return (
    <div
      className="register-bar"
      role="status"
      aria-label={pc ? `Machine registers: program counter at ${pc.spoken}` : "Machine registers, currently idle"}
    >
      <span className="register-bar-brand">OCTA</span>
      <div className="register-bar-cells">
        {REGISTERS.map((r) => {
          const v = live[r];
          return (
            <span key={r} className={`register-cell${v ? " register-cell-live" : ""}`} data-register={r}>
              <span className="register-name">{r}</span>
              <span className="register-value mono">{v ? v.value : "----"}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

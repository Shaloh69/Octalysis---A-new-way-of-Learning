/**
 * The Register Bar.
 *
 * Deliberately unexplained until Stage 12 (DESIGN-MANDATE 2). It idles now; it
 * shows real values once the simulator exists. Teaching register names by
 * osmosis over fourteen weeks is the entire point, so it is present from day
 * one and labelled for a screen reader without being explained on screen.
 */
const REGISTERS = ["PC", "IR", "MAR", "MBR", "ACC"] as const;

export function RegisterBar(): JSX.Element {
  return (
    <div className="register-bar" role="status" aria-label="Machine registers, currently idle">
      <span className="register-bar-brand">OCTA</span>
      <div className="register-bar-cells">
        {REGISTERS.map((r) => (
          <span key={r} className="register-cell">
            <span className="register-name">{r}</span>
            <span className="register-value mono">----</span>
          </span>
        ))}
      </div>
    </div>
  );
}

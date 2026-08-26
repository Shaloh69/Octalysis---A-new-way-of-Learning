import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BootPanel, type BootLine } from "../components/BootPanel";
import { register, signIn } from "../lib/auth";

/**
 * Sign in and register.
 *
 * The theatre is in `BootPanel`. What lives here is the part that must stay
 * boring and correct:
 *
 *   - **One failure message.** An unknown student ID, an ID someone else has
 *     already claimed, and a wrong password all print the same fault line. The
 *     server returns them identically on purpose; interpreting them here would
 *     rebuild the enumeration oracle it exists to prevent.
 *   - **Nothing is decided in the browser.** Whether an ID is on the roster is
 *     a server question, answered inside a transaction that claims the row.
 *   - **The form works before the animation finishes.** Fields are real inputs
 *     from first paint; the sequence never moves focus or blocks submission.
 */

const SIGNIN_LINES: BootLine[] = [
  { label: "CPU", value: "READY" },
  { label: "MEM", value: "OK" },
  { label: "BUS", value: "OK" },
  { label: "AUTH", value: "WAITING" },
];

const REGISTER_LINES: BootLine[] = [
  { label: "CPU", value: "READY" },
  { label: "MEM", value: "OK" },
  { label: "ROSTER", value: "MOUNTED" },
  { label: "CLAIM", value: "WAITING" },
];

export function LoginPage(): JSX.Element {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFault(null);
    const r = await signIn(identifier, password);
    setBusy(false);
    if (r.ok) nav("/app", { replace: true });
    else setFault(r.message ?? "Check your ID and password.");
  }

  return (
    <main className="auth-page" id="main">
      <BootPanel
        title="Sign in"
        subtitle="CPE 412 — Computer Architecture and Organization"
        lines={SIGNIN_LINES}
      >
        <form onSubmit={(e) => void submit(e)} noValidate>
          <div className="field">
            <label htmlFor="identifier">Student ID</label>
            <input
              id="identifier"
              className="mono"
              autoComplete="username"
              inputMode="numeric"
              placeholder="23212905"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <p className="field-hint">The number on your registration form. Your email works too.</p>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/*
           * The fault line. Styled like a POST failure -- mono, left-aligned,
           * prefixed -- because that is the vocabulary of this screen. It is
           * still just one generic message.
           */}
          {fault && (
            <p className="boot-fault mono" role="alert">
              <span className="boot-fault-tag">FAULT</span> {fault}
            </p>
          )}

          <button type="submit" className="btn-primary boot-go" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>

        <p className="auth-alt">
          First time here? <Link to="/register">Claim your account</Link>
        </p>
      </BootPanel>
    </main>
  );
}

export function RegisterPage(): JSX.Element {
  const nav = useNavigate();
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Length is the only rule worth enforcing in the browser, because it is the
  // only one the browser can check honestly. Everything else is the server's.
  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tooShort || mismatch) return;
    setBusy(true);
    setFault(null);
    const r = await register({ studentId: studentId.trim(), email: email.trim(), password });
    setBusy(false);
    if (r.ok) setDone(true);
    else setFault(r.message ?? "That did not work.");
  }

  if (done) {
    return (
      <main className="auth-page" id="main">
        <BootPanel
          title="Account claimed"
          subtitle="Your roster entry is now yours."
          lines={[
            { label: "ROSTER", value: "CLAIMED" },
            { label: "PROFILE", value: "CREATED" },
            { label: "SYSTEM", value: "READY" },
          ]}
        >
          <p className="auth-done">
            You can sign in with your student ID and the password you just set.
          </p>
          <button type="button" className="btn-primary" onClick={() => nav("/login")}>
            Go to sign in
          </button>
        </BootPanel>
      </main>
    );
  }

  return (
    <main className="auth-page" id="main">
      <BootPanel
        title="Claim your account"
        subtitle="Your student ID must already be on your instructor's roster."
        lines={REGISTER_LINES}
      >
        <form onSubmit={(e) => void submit(e)} noValidate>
          <div className="field">
            <label htmlFor="sid">Student ID</label>
            <input
              id="sid"
              className="mono"
              inputMode="numeric"
              placeholder="23212905"
              autoComplete="off"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="field-hint">Used to sign in and to recover your account.</p>
          </div>

          <div className="field">
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="pw-hint"
              required
            />
            <p id="pw-hint" className={tooShort ? "field-hint field-hint-warn" : "field-hint"}>
              At least 10 characters. Length beats punctuation.
            </p>
          </div>

          <div className="field">
            <label htmlFor="pw2">Confirm password</label>
            <input
              id="pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {mismatch && <p className="field-hint field-hint-warn">These do not match yet.</p>}
          </div>

          {fault && (
            <p className="boot-fault mono" role="alert">
              <span className="boot-fault-tag">FAULT</span> {fault}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary boot-go"
            disabled={busy || tooShort || mismatch || !studentId || !email || !password}
          >
            {busy ? "Claiming…" : "Claim account"}
          </button>
        </form>

        <p className="auth-alt">
          Already claimed it? <Link to="/login">Sign in</Link>
        </p>
      </BootPanel>
    </main>
  );
}

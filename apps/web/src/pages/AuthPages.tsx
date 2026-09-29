import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TitleScreen, type MenuItem } from "../components/TitleScreen";
import { register, signIn } from "../lib/auth";

/**
 * Sign in and register, on the title screen (components/TitleScreen.tsx).
 *
 * What lives here is the part that must stay boring and correct:
 *
 *   - **One failure message.** An unknown student ID, an ID someone else has
 *     already claimed, and a wrong password all print the same fault line. The
 *     server returns them identically on purpose; interpreting them here would
 *     rebuild the enumeration oracle it exists to prevent.
 *   - **Nothing is decided in the browser.** Whether an ID is on the roster is
 *     a server question, answered inside a transaction that claims the row.
 *   - **The form works from the first paint.** Nothing waits on an animation.
 */

const menu = (current: "login" | "register"): MenuItem[] => [
  { to: "/login", label: "Sign in", current: current === "login" },
  { to: "/register", label: "Claim your account", current: current === "register" },
];

const WELCOME = {
  title: "Welcome aboard",
  body: (
    <>
      <p>
        Nineteen stages, one star system: a planet for each chapter, from the top level of the machine down to its
        digital logic.
      </p>
      <p>Your answers are saved as you give them, and every check is yours alone.</p>
    </>
  ),
};

function Fault({ text }: { text: string }): JSX.Element {
  return (
    <p className="title-fault" role="alert">
      <span className="title-fault-tag">Fault</span> {text}
    </p>
  );
}

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
    <TitleScreen menu={menu("login")} panelTitle="Sign in" card={WELCOME}>
      <form className="title-form" onSubmit={(e) => void submit(e)} noValidate>
        <label className="field-label" htmlFor="identifier">
          Student ID
        </label>
        <input
          id="identifier"
          className="field mono"
          autoComplete="username"
          inputMode="numeric"
          placeholder="23212905"
          aria-describedby="identifier-hint"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <p className="note" id="identifier-hint">
          The number on your registration form. Your email works too.
        </p>

        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="field"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {fault && <Fault text={fault} />}

        <button type="submit" className="button hud-button button-primary title-go" disabled={busy}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
      <p className="title-alt">
        First time here? <Link to="/register">Claim your account</Link>
      </p>
    </TitleScreen>
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
      <TitleScreen
        menu={menu("register")}
        panelTitle="Account claimed"
        card={{ title: "Your roster entry is yours", body: <p>Your profile is made and your star system is ready.</p> }}
      >
        <p className="title-done">You can sign in with your student ID and the password you just set.</p>
        <button type="button" className="button hud-button button-primary title-go" onClick={() => nav("/login")}>
          Go to sign in
        </button>
      </TitleScreen>
    );
  }

  return (
    <TitleScreen
      menu={menu("register")}
      panelTitle="Claim your account"
      card={{
        title: "Before you start",
        body: (
          <p>
            Your student ID must already be on your instructor&apos;s roster. Claiming it sets your password; it can be
            claimed once.
          </p>
        ),
      }}
    >
      <form className="title-form" onSubmit={(e) => void submit(e)} noValidate>
        <label className="field-label" htmlFor="sid">
          Student ID
        </label>
        <input
          id="sid"
          className="field mono"
          inputMode="numeric"
          placeholder="23212905"
          autoComplete="off"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="field"
          type="email"
          autoComplete="email"
          aria-describedby="email-hint"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <p className="note" id="email-hint">
          Used to sign in and to recover your account.
        </p>

        <label className="field-label" htmlFor="pw">
          Password
        </label>
        <input
          id="pw"
          className="field"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="pw-hint"
          required
        />
        <p id="pw-hint" className={tooShort ? "note title-warn" : "note"}>
          At least <span className="mono">10</span> characters. Length beats punctuation.
        </p>

        <label className="field-label" htmlFor="pw2">
          Confirm password
        </label>
        <input
          id="pw2"
          className="field"
          type="password"
          autoComplete="new-password"
          aria-describedby={mismatch ? "pw2-hint" : undefined}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {mismatch && (
          <p className="note title-warn" id="pw2-hint">
            These do not match yet.
          </p>
        )}

        {fault && <Fault text={fault} />}

        <button
          type="submit"
          className="button hud-button button-primary title-go"
          disabled={busy || tooShort || mismatch || !studentId || !email || !password}
        >
          {busy ? "Claiming…" : "Claim account"}
        </button>
      </form>
      <p className="title-alt">
        Already claimed it? <Link to="/login">Sign in</Link>
      </p>
    </TitleScreen>
  );
}

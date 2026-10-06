import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TitleScreen, type MenuItem } from "../components/TitleScreen";
import { primeRecovery, recoveryLinkState, requestPasswordReset, setNewPassword } from "../lib/recovery";
import { toast } from "../lib/toast";

/**
 * `/forgot-password` and `/reset-password`: a student resets their own
 * password by email (instructor ruling, 6 Oct 2026). On the title screen,
 * like sign in. The rules are the console's (lib/recovery.ts): the request
 * page never says whether an account exists; the reset page decides its state
 * from the address alone, and takes the recovery token off the address bar
 * once supabase-js has read it.
 */

const menu = (current: "forgot" | "reset"): MenuItem[] => [
  { to: "/login", label: "Sign in" },
  { to: "/forgot-password", label: "Forgot password", current: current === "forgot" || current === "reset" },
];

function Fault({ text }: { text: string }): JSX.Element {
  return (
    <p className="title-fault" role="alert">
      <span className="title-fault-tag">Fault</span> {text}
    </p>
  );
}

const HELP = {
  title: "Forgot your password?",
  body: (
    <>
      <p>
        Type the email you claimed your account with. A link to choose a new password is sent there; it works once,
        for a short time.
      </p>
      <p>No email arriving, or no longer using that address? Your instructor can reset it for you.</p>
    </>
  ),
};

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setFault("Type the email you claimed your account with.");
      return;
    }
    setBusy(true);
    setFault(null);
    const r = await requestPasswordReset(email);
    setBusy(false);
    if (r.ok) setSent(true);
    else setFault(r.message);
  }

  return (
    <TitleScreen menu={menu("forgot")} panelTitle="Reset your password" card={HELP}>
      {sent ? (
        <div className="title-form" role="status" data-reset-sent="">
          <p className="title-done">
            If an account uses <span className="mono">{email.trim()}</span>, a link is on its way. Check that inbox,
            and its spam folder.
          </p>
          <p className="title-alt">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      ) : (
        <form className="title-form" onSubmit={(e) => void submit(e)} noValidate data-reset-request="">
          <label className="field-label" htmlFor="reset-email">
            Email
          </label>
          <input
            id="reset-email"
            className="field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {fault && <Fault text={fault} />}
          <button type="submit" className="button hud-button button-primary title-go" disabled={busy}>
            {busy ? "Sending…" : "Send the link"}
          </button>
          <p className="title-alt">
            Remembered it? <Link to="/login">Sign in</Link>
          </p>
        </form>
      )}
    </TitleScreen>
  );
}

export function ResetPasswordPage(): JSX.Element {
  const nav = useNavigate();
  // Read once, on the first render, before anything can clear the address.
  const [link] = useState(() => recoveryLinkState(window.location.hash, window.location.search));
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void primeRecovery().then(() => {
      if (alive && (window.location.hash || window.location.search)) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setFault("Choose a password of at least 10 characters.");
      return;
    }
    if (password !== again) {
      setFault("The two passwords are not the same. Type it again.");
      return;
    }
    setBusy(true);
    setFault(null);
    const r = await setNewPassword(password);
    setBusy(false);
    if (!r.ok) {
      setFault(r.message);
      return;
    }
    toast.success("Password changed", "You are signed in with it.");
    nav("/app", { replace: true });
  }

  const card = {
    title: link.kind === "recovery" ? "Choose a new password" : link.kind === "expired" ? "This link has expired" : "No reset link here",
    body:
      link.kind === "recovery" ? (
        <p>At least 10 characters. Nobody else, your instructor included, will see it.</p>
      ) : link.kind === "expired" ? (
        <p>Each link works once, for a short time, and a newer one replaces it. Ask for a new one.</p>
      ) : (
        <p>This page sets a new password from the link in a reset email, and there is no link in this address.</p>
      ),
  };

  return (
    <TitleScreen menu={menu("reset")} panelTitle={card.title} card={{ title: "Reset your password", body: card.body }}>
      {link.kind === "recovery" ? (
        <form className="title-form" onSubmit={(e) => void save(e)} noValidate data-reset-form="">
          <label className="field-label" htmlFor="reset-new">
            New password
          </label>
          <input
            id="reset-new"
            className="field"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
          />
          <label className="field-label" htmlFor="reset-again">
            Type it again
          </label>
          <input
            id="reset-again"
            className="field"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            required
          />
          {fault && <Fault text={fault} />}
          <button type="submit" className="button hud-button button-primary title-go" disabled={busy}>
            {busy ? "Saving…" : "Save the new password"}
          </button>
        </form>
      ) : (
        <div className="title-form" data-reset-state={link.kind}>
          <Link className="button hud-button button-primary title-go" to="/forgot-password">
            Ask for a new link
          </Link>
          <p className="title-alt">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      )}
    </TitleScreen>
  );
}

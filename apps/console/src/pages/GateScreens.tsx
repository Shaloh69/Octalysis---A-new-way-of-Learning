import { useState } from "react";
import { GateFrame, type ReadoutLine } from "@/components/GateFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewPasswordFields } from "@/components/NewPasswordFields";
import { api } from "@/lib/api";
import { newPasswordState } from "@/lib/password";
import type { Identity } from "@/lib/session";

/**
 * The two gate screens `AppShell` renders in place of the console.
 *
 * They render at whatever guarded URL was asked for, because the guard lives
 * in the shell -- so they never had a route of their own, and until 25 Sep 2026
 * they never had the sign-in page's frame either. They are the same gate, so
 * they wear the same `GateFrame` (`design/templates/console/signin/SPEC.md`).
 *
 * Both render what the server will already enforce. The student screen is not
 * what keeps a student out -- `requireStaff()` and RLS are -- and the
 * credential screen is not what makes the bootstrap flag stick: it lives in
 * `app_metadata`, which only the service role can write.
 */

/* ------------------------------------------------------ a student account */

const WEB_URL = import.meta.env.VITE_WEB_URL ?? "http://localhost:5183";

/**
 * Signed in, but as a student. Nothing to retry, so it explains and offers the
 * two things that help: the app they actually wanted, and a way OUT of this
 * session so a teacher sharing the machine can sign in.
 *
 * No `fault` tone anywhere on this screen: red is for failed staff actions,
 * and a student at the wrong door has done nothing wrong.
 */
export function StudentAccountScreen({
  identity, onSignOut,
}: { identity: Identity; onSignOut: () => void }): JSX.Element {
  const readout: ReadoutLine[] = [
    { label: "AUTH", value: "GRANTED" },
    { label: "ROLE", value: "STUDENT" },
    { label: "CONSOLE", value: "STAFF ONLY" },
  ];

  return (
    <GateFrame
      title="This is the teacher console"
      lede={
        <p>
          You are signed in as <span className="num">{identity.email ?? "a student"}</span>, which
          is a student account. If that is wrong, your instructor can change it.
        </p>
      }
      readout={readout}
      caption="Your stages, checks and grades are on the student app."
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={WEB_URL}>Go to the student app</a>
        </Button>
        <Button variant="outline" onClick={onSignOut}>
          Sign in as someone else
        </Button>
      </div>
    </GateFrame>
  );
}

/* ------------------------------------------------- bootstrap credentials */

/**
 * The blocking change-your-credentials screen.
 *
 * Shown while `app_metadata.must_change_credentials` is set, which
 * `bootstrap-admin.mjs` stamps on every account it creates. Both fields are
 * required together: the bootstrap account has an address someone chose and a
 * password a terminal printed, and replacing one leaves half of a known pair.
 *
 * There is no "later". The one thing this screen offers besides changing the
 * credentials is signing out, because an admin who opened the console on the
 * wrong account needs a way back -- not a way past.
 */
export function ChangeCredentialsScreen({
  identity, onSignOut,
}: { identity: Identity; onSignOut: () => void }): JSX.Element {
  const [email, setEmail] = useState(identity.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready = email.includes("@") && newPasswordState(password, confirm).ready;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      await api.setOwnCredentials({ email: email.trim(), password });
      /*
       * The token in hand still carries the old email and the flag. Supabase
       * mints claims at sign-in, so the only honest thing to do is send them
       * back through it rather than pretend the session is current.
       */
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That change was not saved.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <GateFrame
        title="Credentials changed"
        lede={
          <p>
            Sign in again with your new email and password. Your current session still carries the
            old details, so it has to be replaced rather than refreshed.
          </p>
        }
        readout={[
          { label: "EMAIL", value: "CHANGED" },
          { label: "PASSWORD", value: "CHANGED" },
          { label: "SESSION", value: "STALE" },
          { label: "CONSOLE", value: "SIGN IN AGAIN", tone: "accent" },
        ]}
      >
        <Button onClick={onSignOut}>Sign in again</Button>
      </GateFrame>
    );
  }

  return (
    <GateFrame
      title="Change your email and password"
      lede={
        <p>
          This account was created with a temporary password that was printed to a terminal, so it
          is not a secret. Replace both before doing anything else.
        </p>
      }
      readout={[
        { label: "AUTH", value: "GRANTED" },
        { label: "ACCOUNT", value: "BOOTSTRAP" },
        { label: "PASSWORD", value: "TEMPORARY", tone: "warn" },
        { label: "CONSOLE", value: "LOCKED", tone: "warn" },
      ]}
      caption="This account can read every answer key in the bank. Nothing else in the console opens until both are replaced."
    >
      {/*
        The warning that matters most, said BEFORE the email is chosen. A
        forgotten password is reset by a link to this address (/forgot-password,
        approved 25 Sep 2026) and to no other, so an address nobody reads is a
        password nobody can recover.
      */}
      <p className="mb-5 rounded-md border border-warning bg-warning-bg px-3 py-2 text-xs text-warning">
        <strong>Use an email address you can read.</strong> A forgotten password is reset by a link
        sent to this address, and no other. Put the new password in a password manager now.
      </p>

      <form onSubmit={(e) => void save(e)} noValidate>
        <div className="mb-4">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <NewPasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
        />

        {err ? (
          <p role="alert" className="gate-fault mb-4 flex gap-2 border border-danger bg-danger-bg p-2.5 font-mono text-xs text-danger">
            <span className="shrink-0 font-semibold">FAULT</span>
            <span>{err}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !ready}>
            {busy ? "Saving…" : "Change and continue"}
          </Button>
          <Button type="button" variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </form>
    </GateFrame>
  );
}

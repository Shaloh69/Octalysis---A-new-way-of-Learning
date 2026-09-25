import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { GateFrame, type ReadoutLine } from "@/components/GateFrame";
import { NewPasswordFields } from "@/components/NewPasswordFields";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { newPasswordState } from "@/lib/password";
import { LINK_EXPIRED, getIdentity, primeRecovery, recoveryLinkState, setNewPassword } from "@/lib/session";
import { useApiWake } from "@/lib/useApiWake";
import { useDelayed } from "@/lib/useDelayed";

/**
 * `/reset-password` -- where the link in a reset email lands.
 *
 * Approved by the instructor 25 Sep 2026. Template: shadcn-admin's `/sign-up`,
 * the closest stock page with a password and its confirmation, in the gate's
 * frame; see `design/templates/console/reset-password/SPEC.md`.
 *
 * Three states, decided by the address (`recoveryLinkState`), never by a
 * guess:
 *
 * - **a recovery link** -> the new-password form, the same fields and rule
 *   as the forced credential change (`NewPasswordFields`, `lib/password.ts`)
 * - **an expired or used link** -> say so, offer a new one
 * - **no link** -> say so, offer one. There is NO password form without a
 *   link: a signed-in session is not permission to change a password without
 *   the old one, and this page is not a back door to that
 *
 * The link is taken off the address bar once supabase-js has read it, so the
 * recovery token is not left in history or in a screenshot of the tab.
 *
 * It also wakes the API: a reset ends on /locks, which needs it.
 */
export function ResetPasswordPage(): JSX.Element {
  const nav = useNavigate();
  // Read once, on the first render, before anything can clear the hash.
  const [link] = useState(() => recoveryLinkState(window.location.hash, window.location.search));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const slow = useDelayed(busy, 3_000);
  const wake = useApiWake();

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

  const { ready } = newPasswordState(password, confirm);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setFault(null);
    const r = await setNewPassword(password);
    if (!r.ok) {
      setBusy(false);
      setFault(r.message);
      return;
    }
    const id = await getIdentity();
    setBusy(false);
    // Raised here, read on /locks: the toaster lives at the app root.
    toast.success(id?.email ? `Password changed for ${id.email}` : "Password changed");
    nav("/locks", { replace: true });
  }

  const newLink = (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link to="/forgot-password">Send a new link</Link>
      </Button>
      <Button asChild variant="outline">
        <Link to="/signin">Back to sign in</Link>
      </Button>
    </div>
  );

  if (link.kind === "none") {
    return (
      <GateFrame
        title="No reset link here"
        lede={
          <p>
            This page sets a new password from the link in a reset email, and there is no reset
            link in this address. Ask for one, then open it from the email.
          </p>
        }
        readout={[
          { label: "AUTH", value: "RECOVERY" },
          { label: "LINK", value: "MISSING" },
          wake.line,
        ]}
      >
        {newLink}
      </GateFrame>
    );
  }

  if (link.kind === "expired") {
    return (
      <GateFrame
        title="This link has expired"
        lede={
          <p>
            This reset link has expired or was already used. Each link works once, and a newer one
            replaces it. Ask for a new one.
          </p>
        }
        readout={[
          { label: "AUTH", value: "RECOVERY" },
          { label: "LINK", value: "EXPIRED", tone: "warn" },
          wake.line,
        ]}
      >
        {newLink}
      </GateFrame>
    );
  }

  const readout: ReadoutLine[] = [
    { label: "AUTH", value: "RECOVERY" },
    { label: "LINK", value: "PRESENT" },
    wake.line,
    busy
      ? { label: "PASSWORD", value: "SAVING" }
      : fault
        ? { label: "PASSWORD", value: "FAULT", tone: "fault" }
        : { label: "PASSWORD", value: "WAITING" },
  ];

  return (
    <GateFrame
      title="Set a new password"
      lede={<p>Choose a new password for your staff account. It replaces the old one at once.</p>}
      readout={readout}
      caption="Your email address and your role do not change here. Only the password does."
      footer={
        <p>
          Changed your mind?{" "}
          <Link to="/signin" className="gate-link">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={(e) => void save(e)} noValidate>
        <NewPasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
        />

        {fault ? (
          <p role="alert" className="gate-fault mb-4 flex gap-2 border border-danger bg-danger-bg p-2.5 font-mono text-xs text-danger">
            <span className="shrink-0 font-semibold">FAULT</span>
            <span>{fault}</span>
          </p>
        ) : null}
        {/* An expired link has exactly one way forward, so it is offered right here. */}
        {fault === LINK_EXPIRED ? (
          <Button asChild variant="outline" size="sm" className="mb-4">
            <Link to="/forgot-password">Send a new link</Link>
          </Button>
        ) : null}

        <Button type="submit" className="w-full" disabled={busy || !ready}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" aria-hidden="true" /> Set new password
            </>
          )}
        </Button>

        {slow ? (
          <p role="status" className="mt-3 text-xs text-ink-muted">
            Still saving. The sign-in service is slow to answer; this can take up to a minute.
          </p>
        ) : null}
        {wake.notice}
      </form>
    </GateFrame>
  );
}

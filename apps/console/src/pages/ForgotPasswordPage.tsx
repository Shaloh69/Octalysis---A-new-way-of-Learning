import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { GateFrame, type ReadoutLine } from "@/components/GateFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/session";
import { useDelayed } from "@/lib/useDelayed";

/**
 * `/forgot-password` -- ask for a reset link.
 *
 * Approved by the instructor 25 Sep 2026. Template: shadcn-admin's
 * `/forgot-password`, in the gate's frame; see
 * `design/templates/console/forgot-password/SPEC.md`.
 *
 * **It never says whether an account exists.** The promise is conditional --
 * "if an account exists for that address" -- before the request and after it,
 * and `resetRequestFailureMessage` keeps every refusal that could tell the
 * difference reading as "sent". Only failures that say nothing about accounts
 * are reported: a rate limit, a malformed address, a service that did not
 * answer.
 */
export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const slow = useDelayed(busy, 3_000);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setFault(null);
    const r = await requestPasswordReset(email);
    setBusy(false);
    if (!r.ok) {
      setFault(r.message);
      return;
    }
    setSentTo(email.trim());
  }

  const readout: ReadoutLine[] = [
    { label: "AUTH", value: "RECOVERY" },
    { label: "LINK", value: "ONE USE" },
    busy
      ? { label: "MAIL", value: "SENDING" }
      : fault
        ? { label: "MAIL", value: "FAULT", tone: "fault" }
        : sentTo
          ? { label: "MAIL", value: "REQUESTED", tone: "accent" }
          : { label: "MAIL", value: "WAITING" },
  ];

  return (
    <GateFrame
      title="Reset your password"
      lede={
        <p>
          Enter the email address of your staff account. If an account exists for it, we will send
          a link to set a new password.
        </p>
      }
      readout={readout}
      caption="The link works once, and only from the address it was sent to. Nothing changes until you use it."
      footer={
        <p>
          Remembered it?{" "}
          <Link to="/signin" className="gate-link">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sentTo ? (
        /*
         * The confirmation IS the page: the action's result, in words, where
         * the form was. Not a toast, because there is nothing else here to look
         * at, and not "sent", because an unknown address gets this too.
         */
        <div role="status" className="gate-fault rounded-md border border-line-strong bg-surface-1 p-4">
          <p className="mb-2 text-sm text-ink">
            If an account exists for <span className="num">{sentTo}</span>, a reset link is on its
            way.
          </p>
          <p className="mb-4 text-xs text-ink-muted">
            It can take a few minutes. Check your spam folder before asking for another: each new
            link replaces the last one.
          </p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void send()}>
            {busy ? "Sending…" : "Send it again"}
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void send(e)} noValidate>
          <div className="mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {fault ? (
            <p role="alert" className="gate-fault mb-4 flex gap-2 border border-danger bg-danger-bg p-2.5 font-mono text-xs text-danger">
              <span className="shrink-0 font-semibold">FAULT</span>
              <span>{fault}</span>
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy || !email.includes("@")}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" aria-hidden="true" /> Send reset link
              </>
            )}
          </Button>

          {slow ? (
            <p role="status" className="mt-3 text-xs text-ink-muted">
              Still sending. The sign-in service is slow to answer; this can take up to a minute.
            </p>
          ) : null}
        </form>
      )}
    </GateFrame>
  );
}

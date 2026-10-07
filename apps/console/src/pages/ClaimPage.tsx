import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";
import { GateFrame, type ReadoutLine } from "@/components/GateFrame";
import { NewPasswordFields } from "@/components/NewPasswordFields";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, claimTeacher } from "@/lib/api";
import { newPasswordState } from "@/lib/password";
import { signIn } from "@/lib/session";
import { useDelayed } from "@/lib/useDelayed";

/**
 * `/claim` (console) -- a teacher claims the employee ID the admin put on the
 * teacher roster (T1, 7 Oct 2026; `design/templates/console/claim/SPEC.md`).
 *
 * In the gate's frame, beside `/signin` and `/forgot-password`. The ROLE comes
 * from the roster on the server, never from this form. Every refusal that
 * could say whether an ID exists is one sentence, from the server.
 */
export function ClaimPage(): JSX.Element {
  const nav = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const slow = useDelayed(busy, 3_000);

  const pw = newPasswordState(password, confirm);
  const ready =
    employeeId.trim().length >= 3 && fullName.trim().length > 0 && email.includes("@") && pw.ready;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setFault(null);
    try {
      await claimTeacher({ employeeId: employeeId.trim(), fullName: fullName.trim(), email: email.trim(), password });
    } catch (err) {
      setBusy(false);
      setFault(
        err instanceof ApiError && err.status === 429
          ? "Too many tries. Wait a minute and try again."
          : err instanceof ApiError && err.status === 404
            ? // The route is mounted only with a Supabase project (a local stack has none).
              "Claiming an account is not available on this server. Ask your admin."
          : err instanceof ApiError
            ? err.message
            : "The server did not answer. Check your connection and try again.",
      );
      return;
    }
    // The account exists; sign in with what was just typed.
    const r = await signIn(email, password);
    setBusy(false);
    if (r.ok) {
      toast.success("Your teacher account is ready.");
      nav("/locks", { replace: true });
    } else {
      toast.success("Your teacher account is ready. Sign in to continue.");
      nav("/signin", { replace: true });
    }
  }

  const readout: ReadoutLine[] = [
    { label: "ROSTER", value: "TEACHERS" },
    { label: "ROLE", value: "FROM ROSTER" },
    busy
      ? { label: "CLAIM", value: "CHECKING" }
      : fault
        ? { label: "CLAIM", value: "FAULT", tone: "fault" }
        : { label: "CLAIM", value: "WAITING" },
  ];

  return (
    <GateFrame
      title="Claim your teacher account"
      lede={<p>Your employee ID is on the teacher roster your admin imported. Type your name as it appears there.</p>}
      readout={readout}
      caption="Your role comes from the roster, not from this form. An admin can disable the account later."
      footer={
        <p>
          Already have an account?{" "}
          <Link to="/signin" className="gate-link">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="mb-4">
          <Label htmlFor="employee-id">Employee ID</Label>
          <Input
            id="employee-id"
            className="num"
            autoComplete="off"
            spellCheck={false}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="full-name">Full name, as on the roster</Label>
          <Input id="full-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="mb-4">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />

        {fault ? (
          <p role="alert" className="gate-fault mb-4 flex gap-2 border border-danger bg-danger-bg p-2.5 font-mono text-xs text-danger">
            <span className="shrink-0 font-semibold">FAULT</span>
            <span>{fault}</span>
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={busy || !ready}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Claim account
            </>
          )}
        </Button>
        {slow ? (
          <p role="status" className="mt-3 text-xs text-ink-muted">
            Still checking. The server may be waking up; this can take up to a minute.
          </p>
        ) : null}
      </form>
    </GateFrame>
  );
}

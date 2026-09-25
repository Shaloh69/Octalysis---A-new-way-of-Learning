import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { GateFrame, type ReadoutLine } from "@/components/GateFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { getIdentity, isStaff, signIn } from "@/lib/session";
import { useApiWake } from "@/lib/useApiWake";
import { useDelayed } from "@/lib/useDelayed";

/**
 * `/signin` -- the console's front door.
 *
 * **This page once did not exist, and its absence made the whole console
 * unreachable in production:** `AppShell` found no session and rendered a
 * dead-end. Rebuilt 25 Sep 2026 against shadcn-admin's split auth block;
 * `design/templates/console/signin/SPEC.md` records what was taken and what was
 * not, and `design/specs/console-gate.spec.ts` holds it to the six-assertion
 * gate at 1440 and 380.
 *
 * What stays boring and correct here, whatever the frame does:
 *
 * - **One failure sentence for every credential cause** (`signInFailureMessage`).
 * - **No client-side authorization.** Signing in establishes who someone is;
 *   the JWT decides what renders, `requireStaff()` decides what the server
 *   answers, and RLS decides what the database returns.
 * - **The failure stays.** It is replaced by the next attempt and by nothing
 *   else -- not a timer, not the first keystroke of the correction.
 */

/*
 * Where a student who came to the wrong door should go. 5183, not 5173: Vite's
 * default port belongs to another project on this machine. A deployment always
 * sets VITE_WEB_URL; this is the local default.
 */
const WEB_URL = import.meta.env.VITE_WEB_URL ?? "http://localhost:5183";

export function SignInPage(): JSX.Element {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);

  // design.md: past ~3s, say so in words rather than spinning in silence.
  const slow = useDelayed(busy, 3_000);
  // Wake the API while the teacher types (lib/api.ts `wakeApi` says why).
  const wake = useApiWake();

  /*
   * Someone already signed in should not be looking at a sign-in form: the
   * ordinary case of a teacher reopening a tab with a live session.
   */
  useEffect(() => {
    void getIdentity().then((id) => {
      if (id && isStaff(id.role)) nav("/locks", { replace: true });
    });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Cleared here, and only here: the next attempt replaces the last fault.
    setFault(null);
    const r = await signIn(email, password);
    if (!r.ok) {
      setBusy(false);
      setFault(r.message);
      return;
    }
    /*
     * Signed in is not the same as staff. A student account that signs in
     * here lands on AppShell's "this is a student account" screen rather than
     * a nav full of pages the server would refuse anyway.
     */
    const id = await getIdentity();
    setBusy(false);
    if (id && isStaff(id.role)) {
      // Raised here, read on /locks: the toaster lives at the app root for this.
      toast.success(`Signed in as ${id.email ?? email.trim()}`);
      nav("/locks", { replace: true });
    } else {
      nav("/", { replace: true });
    }
  }

  const readout: ReadoutLine[] = [
    { label: "ROSTER", value: "MOUNTED" },
    { label: "POLICIES", value: "ARMED" },
    { label: "AUDIT", value: "RECORDING" },
    wake.line,
    busy
      ? { label: "AUTH", value: "CHECKING" }
      : fault
        ? { label: "AUTH", value: "FAULT", tone: "fault" }
        : { label: "AUTH", value: "WAITING" },
    // POST halts loudly on a failure (DESIGN-REFERENCES.md §7.1).
    fault
      ? { label: "CONSOLE", value: "HALTED", tone: "fault" }
      : { label: "CONSOLE", value: "READY", tone: "accent" },
  ];

  return (
    <GateFrame
      title="Sign in"
      lede={<p>CPE 412 · Computer Architecture and Organization. Staff accounts only.</p>}
      readout={readout}
      caption={
        <>
          Past this screen you can read every answer key in the bank, and every change a student
          can see is written to the audit log under your name.
        </>
      }
      footer={
        <>
          <p>No account? Staff accounts are created by an administrator. There is no sign-up here.</p>
          <p>
            <Link to="/forgot-password" className="gate-link">
              Forgot your password?
            </Link>{" "}
            A reset link goes to your account&apos;s email address.
          </p>
          <p>
            A student?{" "}
            <a href={WEB_URL} className="gate-link">
              Go to the student app
            </a>{" "}
            and sign in there with your ID number.
          </p>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
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

        <div className="mb-4">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {/*
             * After its field in the Tab order, never between the two fields.
             * A fixed label with `aria-pressed` carrying the state: changing
             * the label AND the pressed state would say it twice, differently.
             */}
            <button
              type="button"
              aria-label="Show password"
              aria-pressed={reveal}
              aria-controls="password"
              onClick={() => setReveal((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast hover:text-ink"
            >
              {reveal ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/*
         * The fault line, in the vocabulary of this screen: mono, tagged, like a
         * POST failure. Directly above the button that caused it, and announced
         * rather than only seen.
         */}
        {fault ? (
          <p role="alert" className="gate-fault mb-4 flex gap-2 border border-danger bg-danger-bg p-2.5 font-mono text-xs text-danger">
            <span className="shrink-0 font-semibold">FAULT</span>
            <span>{fault}</span>
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
            </>
          )}
        </Button>

        {slow ? (
          <p role="status" className="mt-3 text-xs text-ink-muted">
            Still checking. The sign-in service is slow to answer; this can take up to a minute.
          </p>
        ) : null}
        {wake.notice}
      </form>
    </GateFrame>
  );
}

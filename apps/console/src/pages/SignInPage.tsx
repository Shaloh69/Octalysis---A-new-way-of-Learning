import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BootFrame, type BootLine } from "@/components/BootFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getIdentity, isStaff, signIn } from "@/lib/session";

/**
 * The console sign-in.
 *
 * **This page did not exist, and its absence made the whole console
 * unreachable in production.** `AppShell` read a Supabase session, found none,
 * and rendered a dead-end offering one link to the student app. Locally that
 * was invisible for the wrong reason: the two apps run on different ports,
 * which are different origins, so a session created at :5173 was never
 * readable at :5174 either. Deployed, they are different domains, and it
 * became obvious the first time the console was opened.
 *
 * The theatre lives in `BootFrame`. What lives here stays boring and correct:
 * one failure message for every cause, no client-side authorization, and a form
 * that works from first paint whether or not the sequence has finished.
 */

const LINES: BootLine[] = [
  { label: "ROSTER", value: "MOUNTED" },
  { label: "POLICIES", value: "ARMED" },
  { label: "AUDIT", value: "RECORDING" },
  { label: "AUTH", value: "WAITING" },
];

export function SignInPage(): JSX.Element {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);

  /*
   * Someone already signed in should not be looking at a sign-in form. This
   * also covers the ordinary case of a teacher reopening a tab with a live
   * session.
   */
  useEffect(() => {
    void getIdentity().then((id) => {
      if (id && isStaff(id.role)) nav("/locks", { replace: true });
    });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFault(null);
    const r = await signIn(email, password);
    if (!r.ok) {
      setBusy(false);
      setFault(r.message);
      return;
    }
    /*
     * Signed in is not the same as staff. The role comes from the JWT, and a
     * student account that signs in here must land on the "this is a student
     * account" screen rather than a nav full of pages the server would refuse
     * anyway.
     */
    const id = await getIdentity();
    setBusy(false);
    nav(id && isStaff(id.role) ? "/locks" : "/", { replace: true });
  }

  return (
    <main id="main">
      <BootFrame
        title="Sign in"
        subtitle="CPE 412 — Computer Architecture and Organization"
        lines={LINES}
      >
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            className="mb-4"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/*
           * The fault line, in the vocabulary of this screen: mono, tagged,
           * left-aligned like a POST failure. Still one generic message.
           * `role="alert"` so it is announced rather than only seen.
           */}
          {fault ? (
            <p
              className="mb-4 flex gap-2 border border-danger bg-danger-bg p-2.5 font-mono text-xs text-danger"
              role="alert"
            >
              <span className="shrink-0 font-semibold">FAULT</span>
              <span>{fault}</span>
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-xs text-ink-muted">
          Staff accounts are created by an administrator — there is no sign-up here. Students sign
          in on the student app with their ID number.
        </p>
      </BootFrame>
    </main>
  );
}

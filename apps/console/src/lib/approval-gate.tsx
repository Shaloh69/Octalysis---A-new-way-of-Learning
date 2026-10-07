import { createContext, useContext } from "react";

/**
 * Whether the signed-in teacher may use an Approve, and why not in words.
 * Course Studio, CS1 (docs/COURSE-STUDIO-PLAN.md §3; instructor, 7 Oct 2026,
 * night): an approver is a teacher OF THE SUBJECT and never the author of the
 * version; the admin may approve their own edit, recorded as self-approved.
 *
 * This decides what to RENDER and nothing more (like the route guard): the
 * API refuses the same approval (`services/api/src/approval.ts`) and the
 * database holds it (`db/addendum-studio.sql`). An Approve a teacher may not
 * use is shown disabled with the reason beside it, never hidden, so a
 * teacher can tell why (SPEC.md, Studio). With no provider, outside the
 * Studio, every Approve stays as it was and the server decides.
 */

export interface Approver {
  userId: string;
  role: "teacher" | "admin";
  /** The subjects whose content this reader may approve (the admin: all). */
  approves: readonly string[];
}

export interface Gate {
  allowed: boolean;
  /** Why not, as a sentence, when not allowed. */
  reason: string | null;
  /** The admin approving their own version: allowed, and said so beside the button. */
  selfApproved: boolean;
}

/** Only CPE 412 has chapters until CS2 keys the stages by subject. */
export const CONTENT_SUBJECT = "CPE 412";

const Ctx = createContext<Approver | null>(null);
export const ApproverProvider = Ctx.Provider;

export function gateFor(me: Approver | null, authoredBy: string | null | undefined): Gate {
  if (!me) return { allowed: true, reason: null, selfApproved: false };
  if (!me.approves.includes(CONTENT_SUBJECT)) {
    return { allowed: false, reason: `Only a teacher of ${CONTENT_SUBJECT} or the admin approves its content.`, selfApproved: false };
  }
  const mine = authoredBy != null && authoredBy === me.userId;
  if (mine && me.role !== "admin") {
    return {
      allowed: false,
      reason: `You wrote this version; another teacher of ${CONTENT_SUBJECT} approves it.`,
      selfApproved: false,
    };
  }
  return { allowed: true, reason: null, selfApproved: mine };
}

export function useApprovalGate(authoredBy: string | null | undefined): Gate {
  return gateFor(useContext(Ctx), authoredBy);
}

/** The sentence beside a gated Approve, or the self-approval notice for the admin. */
export function GateNote({ id, gate }: { id: string; gate: Gate }) {
  if (gate.reason) return <p id={id} className="ct-faint" data-gate-note>{gate.reason}</p>;
  if (gate.selfApproved) {
    return (
      <p id={id} className="ct-faint" data-gate-note>
        You wrote this version. As the admin you may approve it; it is recorded as self-approved.
      </p>
    );
  }
  return null;
}

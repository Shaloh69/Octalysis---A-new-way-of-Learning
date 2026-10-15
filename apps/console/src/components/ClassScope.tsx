import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";

/**
 * T2 (9 Oct 2026; docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5): a teacher holds their own classes.
 * Two things every page that shows students needs, said the same way everywhere.
 *
 *   NoClass    a teacher who holds no class sees a clear empty state, never a blank page.
 *   ReadOnly   a class that has ended (to its teacher), or that another teacher holds (to the admin),
 *              can be read and not changed. The write controls are disabled; the routes refuse
 *              them regardless, so this decides what to RENDER and nothing more.
 */

/** Why a class is read-only to this person, in words. */
export function readOnlyWhy(admin: boolean): string {
  return admin
    ? "Another teacher holds this class, so you can read it and not change it."
    : "This class has ended, so you can read it and not change it.";
}

/**
 * `compact` is a small lock beside a name, for a long list where a word on every row is noise (the admin
 * reading another teacher's whole class); the word is still there for a screen reader and on hover.
 */
export function ReadOnly({ admin, compact = false }: { admin: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <span title={readOnlyWhy(admin)} data-read-only="" className="ml-1 inline-flex align-middle text-ink-muted">
        <Lock className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">Read-only. {readOnlyWhy(admin)}</span>
      </span>
    );
  }
  return (
    <Badge tone="neutral" title={readOnlyWhy(admin)} data-read-only="">
      Read-only
    </Badge>
  );
}

/**
 * The empty state of a page about students, for a teacher who holds no class. `what` names what the
 * page would have shown; `action` is the page's own way to get one (the roster's Import).
 */
export function NoClass({ what, action }: { what: string; action?: ReactNode | undefined }) {
  return (
    <div data-no-class="">
      <Empty
        title="You don't hold a class yet"
        hint={`${what} appear here once you hold a class. Import a roster on Students to make your own section, or ask the admin to give you one.`}
        action={
          action ?? (
            <Link to="/students" className="text-sm text-accent underline underline-offset-2">
              Go to Students
            </Link>
          )
        }
      />
    </div>
  );
}

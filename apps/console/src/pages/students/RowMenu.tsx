import { useRef } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RosterRow } from "@/lib/api";
import { readOnlyWhy } from "@/components/ClassScope";

export interface RowActions {
  /** Each is handed the menu button, so the dialog can send focus back to it. */
  move: (s: RosterRow, from: HTMLElement | null) => void;
  status: (s: RosterRow, from: HTMLElement | null) => void;
  /** The admin may deactivate and reactivate anyone (recovery); a teacher only in a class they hold. */
  admin: boolean;
}

/**
 * The `⋯` menu at the end of a row (`template-states.png`). The destructive
 * item is last, after a separator, in danger: two presses from the row, and
 * never on it. SPEC.md §"Deactivate is hard to do by accident".
 */
export function RowMenu({ student, on }: { student: RosterRow; on: RowActions }) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={trigger}
        aria-label={`Actions for ${student.fullName}`}
        className="roster-menu-trigger"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {student.userId ? (
          <DropdownMenuItem asChild>
            <Link to={`/students/${student.userId}`}>Open record</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={student.readOnly} onSelect={() => on.move(student, trigger.current)}>
          Move to section…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {student.deactivated ? (
          <DropdownMenuItem disabled={student.readOnly && !on.admin} onSelect={() => on.status(student, trigger.current)}>
            Reactivate…
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            tone="danger"
            disabled={student.readOnly && !on.admin}
            onSelect={() => on.status(student, trigger.current)}
          >
            Deactivate…
          </DropdownMenuItem>
        )}
        {student.readOnly ? (
          <p className="max-w-[16rem] px-2 py-1.5 text-xs text-ink-muted" data-read-only-note="">
            {readOnlyWhy(on.admin)}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

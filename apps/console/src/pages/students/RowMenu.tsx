import { useRef } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RosterRow } from "@/lib/api";

export interface RowActions {
  /** Each is handed the menu button, so the dialog can send focus back to it. */
  move: (s: RosterRow, from: HTMLElement | null) => void;
  status: (s: RosterRow, from: HTMLElement | null) => void;
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
        <DropdownMenuItem onSelect={() => on.move(student, trigger.current)}>Move to section…</DropdownMenuItem>
        <DropdownMenuSeparator />
        {student.deactivated ? (
          <DropdownMenuItem onSelect={() => on.status(student, trigger.current)}>Reactivate…</DropdownMenuItem>
        ) : (
          <DropdownMenuItem tone="danger" onSelect={() => on.status(student, trigger.current)}>
            Deactivate…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

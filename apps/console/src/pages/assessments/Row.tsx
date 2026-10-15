import { useRef } from "react";
import { MoreHorizontal, AlertTriangle } from "lucide-react";
import type { Assessment } from "@/lib/api";
import { saltState, windowLines, windowState, STATE_TONE } from "@/lib/assessments-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowActions {
  /** Each is handed the control that opened it, so its dialog can send focus back. */
  window: (a: Assessment, from: HTMLElement | null) => void;
  bank: (a: Assessment, from: HTMLElement | null) => void;
  rotate: (a: Assessment, from: HTMLElement | null) => void;
}

export function StatusBadge({ a }: { a: Assessment }) {
  const state = windowState(a);
  return <Badge tone={STATE_TONE[state]}>{state}</Badge>;
}

export function Scope({ a }: { a: Assessment }) {
  return (
    <Badge tone="neutral">
      {a.scope === "stage" ? (
        <>
          stage&nbsp;<span className="num">{a.stageId}</span>
        </>
      ) : (
        "final"
      )}
    </Badge>
  );
}

/** When the salt was set or rotated, never what it is. */
export function Salt({ a }: { a: Assessment }) {
  const s = saltState(a);
  if (!s) {
    return (
      <span className="assess-salt-missing">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        no exam salt: Start will fail
      </span>
    );
  }
  return (
    <span>
      salt {s.verb} <span className="num" data-date="">{s.day}</span>
    </span>
  );
}

export function Window({ a }: { a: Assessment }) {
  const lines = windowLines(a);
  if (lines.length === 0) return <span className="text-xs text-ink-muted">no window</span>;
  return (
    <span className="assess-window">
      {lines.map(([word, when]) => (
        <span key={word}>
          <span className="text-ink-muted">{word}</span> <span className="num" data-date="">{when}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Set window stays on the row: it is the change a teacher makes mid-term. The
 * `⋯` menu holds the bank check and, after a separator, the salt: rare,
 * consequential, two presses away (`SPEC.md`).
 */
export function Actions({ a, on }: { a: Assessment; on: RowActions }) {
  const setWindow = useRef<HTMLButtonElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  // T2: the course's papers are the admin's; a teacher reads them. aria-disabled, not disabled, so focus is kept.
  const why = a.sectionId === null
    ? "This paper is the whole course's, so only the admin changes it. You can read it."
    : "You can read this paper and not change it.";
  return (
    <div className="assess-actions">
      <Button
        ref={setWindow}
        size="sm"
        variant="outline"
        aria-disabled={!a.canEdit || undefined}
        title={a.canEdit ? undefined : why}
        onClick={() => a.canEdit && on.window(a, setWindow.current)}
      >
        Set window
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger ref={more} aria-label={`More for ${a.title}`} className="assess-more">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => on.bank(a, more.current)}>Check the bank…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!a.canEdit} onSelect={() => on.rotate(a, more.current)}>Rotate exam salt…</DropdownMenuItem>
          {a.canEdit ? null : (
            <p className="max-w-[16rem] px-2 py-1.5 text-xs text-ink-muted" data-read-only-note="">{why}</p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

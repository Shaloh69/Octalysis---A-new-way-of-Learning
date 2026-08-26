import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Table primitives. TanStack Table does the logic; these do the pixels.
 * `apps/console/CLAUDE.md`: TanStack Table, Recharts, and no second library.
 *
 * Wrap every wide table in `.table-scroll` (see index.css). A 20-column
 * gradebook must scroll inside its own box and never make the page scroll
 * sideways.
 */
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}
export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-line-strong", className)} {...props} />;
}
export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-line last:border-0 hover:bg-surface-2", className)} {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn("px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted", className)}
      {...props}
    />
  );
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 align-middle text-ink", className)} {...props} />;
}

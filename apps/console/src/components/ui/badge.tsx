import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-ink-muted",
        accent: "border-accent bg-accent-muted text-accent",
        success: "border-success bg-success-bg text-success",
        danger: "border-danger bg-danger-bg text-danger",
        warning: "border-warning bg-warning-bg text-warning",
        info: "border-info bg-info-bg text-info",
        locked: "border-locked bg-locked-bg text-locked",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className, tone, ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

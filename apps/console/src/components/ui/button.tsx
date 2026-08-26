import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-body " +
    "font-medium transition-colors duration-fast ease-out " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    // 44px minimum touch target on the coarse-pointer path. The console gets
    // used on a tablet at the front of a room, not only on a laptop.
    "[@media(pointer:coarse)]:min-h-[44px]",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg hover:bg-accent-hover",
        outline: "border border-line-strong bg-surface-1 text-ink hover:bg-surface-2",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        // `danger` is for destructive STAFF actions (void an attempt, deactivate
        // a student). It is never used to tell a student they were wrong --
        // CLAUDE.md: incorrect answers get a neutral response, never red.
        danger: "bg-danger-bg text-danger border border-danger hover:bg-danger hover:text-surface-0",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
export { buttonVariants };

import * as React from "react";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The row menu. Radix, like `dialog.tsx`, with the source owned here.
 *
 * Added for `/students` (25 Sep 2026), whose rows hold one destructive action:
 * the template (`design/templates/console/students/template-states.png`) keeps
 * Delete behind a `⋯` menu, apart from the row, and so does this.
 *
 * `modal={false}` by default. A modal menu locks pointer events on <body>, and
 * a dialog opened from one of its items can inherit that lock after the menu
 * is gone. Arrow keys, Home/End, Escape and typeahead are Radix's either way.
 */

export function DropdownMenu(props: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root modal={false} {...props} />;
}
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "ease-menu z-dialog min-w-[12rem] rounded-md border border-line-strong bg-surface-1 p-1 shadow-2",
        className,
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { tone?: "danger" }
>(({ className, tone, ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
      "[@media(pointer:coarse)]:min-h-[44px]",
      "data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50",
      tone === "danger" ? "text-danger" : "text-ink",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <MenuPrimitive.Separator className={cn("my-1 h-px bg-line", className)} />;
}

/**
 * Added for the console shell's account menu (28 Sep 2026): a heading inside
 * the menu, and a group of radio items for the theme. Radix gives each item
 * `role=menuitemradio` and `aria-checked`, so the current choice is announced
 * rather than only drawn.
 */
export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-2 py-1.5 text-xs text-ink-muted", className)} {...props} />;
}

export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-2 text-sm text-ink outline-none",
      "[@media(pointer:coarse)]:min-h-[44px]",
      "data-[highlighted]:bg-surface-2",
      className,
    )}
    {...props}
  >
    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
      <MenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-accent" />
      </MenuPrimitive.ItemIndicator>
    </span>
    {children}
  </MenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD, newPasswordState } from "@/lib/password";
import { cn } from "@/lib/utils";

/**
 * "New password" and "Confirm new password", with their two hints.
 *
 * Shared by the forced credential change and `/reset-password`, so both screens
 * ask for the same password in the same words and hold it to the same rule
 * (`lib/password.ts`). The hints are words beside the field, never colour
 * alone, and they appear only once something has been typed.
 */
export function NewPasswordFields({
  password, confirm, onPassword, onConfirm,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
}): JSX.Element {
  const { tooShort, mismatch } = newPasswordState(password, confirm);

  return (
    <>
      <div className="mb-4">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-describedby="new-password-hint"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
        />
        <p id="new-password-hint" className={cn("mt-1 text-xs", tooShort ? "text-danger" : "text-ink-muted")}>
          At least {MIN_PASSWORD} characters.
        </p>
      </div>

      <div className="mb-5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-describedby={mismatch ? "confirm-password-hint" : undefined}
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
        />
        {mismatch ? (
          <p id="confirm-password-hint" className="mt-1 text-xs text-danger">
            These do not match.
          </p>
        ) : null}
      </div>
    </>
  );
}

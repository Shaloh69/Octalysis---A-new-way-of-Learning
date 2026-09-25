/**
 * The rules for a new password, in one place.
 *
 * Two screens set one: the forced credential change (bootstrap accounts) and
 * `/reset-password`. They used to be one inline rule on one screen; a second
 * copy on the second screen is how the two would drift into accepting
 * different passwords.
 */

export const MIN_PASSWORD = 12;

export interface NewPasswordState {
  /** Something typed, and not enough of it. */
  tooShort: boolean;
  /** A confirmation typed, and it differs. */
  mismatch: boolean;
  /** Long enough, and confirmed. */
  ready: boolean;
}

export function newPasswordState(password: string, confirm: string): NewPasswordState {
  return {
    tooShort: password.length > 0 && password.length < MIN_PASSWORD,
    mismatch: confirm.length > 0 && confirm !== password,
    ready: password.length >= MIN_PASSWORD && confirm === password,
  };
}

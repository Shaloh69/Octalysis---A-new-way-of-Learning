import { describe, it, expect } from "vitest";
import { LINK_EXPIRED, passwordUpdateFailureMessage, recoveryLinkState, resetRequestFailureMessage } from "../src/lib/recovery";

/** Students' self-service reset: what the pages decide from the address and from Supabase's errors. */

describe("recoveryLinkState", () => {
  it("a recovery link, in either flow", () => {
    expect(recoveryLinkState("#access_token=x&type=recovery", "")).toEqual({ kind: "recovery" });
    expect(recoveryLinkState("", "?code=abc")).toEqual({ kind: "recovery" });
  });
  it("an expired or used link", () => {
    expect(recoveryLinkState("#error=access_denied&error_code=otp_expired", "")).toEqual({ kind: "expired" });
  });
  it("no link at all", () => {
    expect(recoveryLinkState("", "")).toEqual({ kind: "none" });
    expect(recoveryLinkState("#type=signup", "")).toEqual({ kind: "none" });
  });
});

describe("resetRequestFailureMessage: never an enumeration oracle", () => {
  it("any other 4xx reads as sent", () => {
    expect(resetRequestFailureMessage({ status: 400 })).toBeNull();
    expect(resetRequestFailureMessage({ status: 404, code: "user_not_found" })).toBeNull();
  });
  it("rate limits and a malformed address say so", () => {
    expect(resetRequestFailureMessage({ status: 429 })).toMatch(/Too many/);
    expect(resetRequestFailureMessage({ code: "email_address_invalid" })).toBe("That is not an email address.");
  });
  it("a service that did not answer says so", () => {
    expect(resetRequestFailureMessage({ status: 503 })).toMatch(/did not answer/);
  });
});

describe("passwordUpdateFailureMessage", () => {
  it("a missing or bad session is an expired link", () => {
    expect(passwordUpdateFailureMessage({ name: "AuthSessionMissingError" })).toBe(LINK_EXPIRED);
    expect(passwordUpdateFailureMessage({ status: 401 })).toBe(LINK_EXPIRED);
  });
  it("the same password, and a weak one, say which", () => {
    expect(passwordUpdateFailureMessage({ code: "same_password" })).toMatch(/already your password/);
    expect(passwordUpdateFailureMessage({ code: "weak_password" })).toMatch(/too weak/);
  });
});

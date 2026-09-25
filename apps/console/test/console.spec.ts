import { describe, it, expect } from "vitest";
import { parseRoster, splitCsvLine, nextLockState } from "../src/lib/csv";
import {
  roleFromClaims,
  isStaff,
  decodeJwtPayload,
  mustChangeFromClaims,
  signInFailureMessage,
  CREDENTIALS_REJECTED,
} from "../src/lib/session";

/**
 * The console's pure logic.
 *
 * UI is not tested here — that is the project's convention and it holds. What
 * IS tested is every function where being wrong is silent: a name mangled on
 * import, a role read too generously, a lock cycle that skips a state. None of
 * those throw. They just quietly do the wrong thing to a real student.
 */

describe("roster import — a comma in a name is the normal case", () => {
  it("keeps everything after the FIRST comma as the name", () => {
    // The bug this exists to prevent: "Dela Cruz" registers, "Juan Miguel" is
    // discarded, and the student cannot match themselves to the roster.
    const { rows } = parseRoster("21-1234-567,Dela Cruz, Juan Miguel");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ studentId: "21-1234-567", fullName: "Dela Cruz, Juan Miguel" });
  });

  it("unwraps a spreadsheet's quoted field", () => {
    const { rows } = parseRoster('21-1,"Dela Cruz, Juan"');
    expect(rows[0]!.fullName).toBe("Dela Cruz, Juan");
  });

  it("unwraps doubled quotes inside a quoted field", () => {
    const { rows } = parseRoster('21-1,"Juan ""JM"" Dela Cruz"');
    expect(rows[0]!.fullName).toBe('Juan "JM" Dela Cruz');
  });

  it("recognises a header row instead of assuming line 1 is one", () => {
    // Teachers paste fragments from the middle of a spreadsheet as often as
    // whole files. Dropping line 1 unconditionally loses a real student.
    const withHeader = parseRoster("student_id,full_name\n21-1,Santos, Maria");
    expect(withHeader.rows).toHaveLength(1);
    expect(withHeader.rows[0]!.studentId).toBe("21-1");

    const withoutHeader = parseRoster("21-1,Santos, Maria\n21-2,Reyes, Ana");
    expect(withoutHeader.rows).toHaveLength(2);
    expect(withoutHeader.rows[0]!.studentId).toBe("21-1");
  });

  it("counts unreadable lines rather than dropping them silently", () => {
    const { rows, bad } = parseRoster("21-1,Santos, Maria\nnonsense-with-no-comma\n,\n21-2,Reyes");
    expect(rows).toHaveLength(2);
    expect(bad).toBe(2); // the no-comma line, and the empty id+name line
  });

  it("ignores blank lines and trims whitespace", () => {
    const { rows, bad } = parseRoster("\n  21-1 , Santos, Maria  \n\n");
    expect(bad).toBe(0);
    expect(rows[0]).toEqual({ studentId: "21-1", fullName: "Santos, Maria" });
  });
});

describe("roster import — the format a teacher actually pastes", () => {
  it("accepts an ID and name separated by SPACES", () => {
    // The instructor's own example. A university enrolment list copied out of a
    // PDF or a printed sheet has no commas at all, and requiring one would
    // reject the entire roster while giving no clue why.
    const { rows, bad } = parseRoster("23212905  Shem Joshua M. Dumpor");
    expect(bad).toBe(0);
    expect(rows[0]).toEqual({ studentId: "23212905", fullName: "Shem Joshua M. Dumpor" });
  });

  it("accepts a tab-separated line, which is what a spreadsheet copy gives", () => {
    const { rows } = parseRoster("23212905	Shem Joshua M. Dumpor");
    expect(rows[0]).toEqual({ studentId: "23212905", fullName: "Shem Joshua M. Dumpor" });
  });

  it("accepts a dashed ID format too", () => {
    const { rows } = parseRoster("21-1234-567  Santos, Maria");
    expect(rows[0]).toEqual({ studentId: "21-1234-567", fullName: "Santos, Maria" });
  });

  it("still splits a COMMA line on the first comma only", () => {
    // The two rules must not fight. A comma line has no leading-ID-then-space
    // shape, so it falls through to the comma rule and the name keeps its comma.
    const { rows } = parseRoster("23212905,Dumpor, Shem Joshua M.");
    expect(rows[0]).toEqual({ studentId: "23212905", fullName: "Dumpor, Shem Joshua M." });
  });

  it("does not mangle a line that starts with a NAME rather than an ID", () => {
    // The space rule is safe only because it anchors on a numeric ID. A line
    // beginning with a name must not be split at its first space.
    const { rows, bad } = parseRoster("Shem Joshua M. Dumpor, 23212905");
    expect(bad).toBe(0);
    expect(rows[0]!.studentId).toBe("Shem Joshua M. Dumpor");
  });

  it("reads a whole pasted class list", () => {
    const { rows, bad } = parseRoster(
      [
        "23212905  Shem Joshua M. Dumpor",
        "23212906  Santos, Maria Clara",
        "",
        "23212907\tReyes, Ana",
      ].join("\n"),
    );
    expect(bad).toBe(0);
    expect(rows).toHaveLength(3);
    expect(rows[1]!.fullName).toBe("Santos, Maria Clara");
  });
});

describe("gradebook CSV — reads exactly what the server writes", () => {
  it("round-trips a quoted field containing a comma", () => {
    expect(splitCsvLine('21-1,"Dela Cruz, Juan",100,80')).toEqual([
      "21-1", "Dela Cruz, Juan", "100", "80",
    ]);
  });

  it("round-trips doubled quotes", () => {
    expect(splitCsvLine('21-1,"Juan ""JM"" Cruz",90')).toEqual(["21-1", 'Juan "JM" Cruz', "90"]);
  });

  it("keeps empty trailing fields, so column count survives", () => {
    // A row that loses its last column silently shifts every stage's grade one
    // place left. The filter in GradebookPage relies on the count matching.
    expect(splitCsvLine("21-1,Santos,,")).toEqual(["21-1", "Santos", "", ""]);
  });
});

describe("the lock cycle", () => {
  it("goes auto -> unlocked -> locked -> auto and no further", () => {
    expect(nextLockState(null)).toBe("unlocked");
    expect(nextLockState(undefined)).toBe("unlocked");
    expect(nextLockState("unlocked")).toBe("locked");
    expect(nextLockState("locked")).toBe("auto");
  });

  it("returns to auto, which is a real third state and not just 'off'", () => {
    // auto means the curriculum decides. It is NOT the same as locked: a stage
    // on auto opens by itself once the prerequisite is met.
    expect(nextLockState("locked")).toBe("auto");
    expect(nextLockState("locked")).not.toBe("locked");
  });
});

describe("the role guard mirrors jwt_role(), including its failure mode", () => {
  it("reads app_metadata.role", () => {
    expect(roleFromClaims({ app_metadata: { role: "teacher" } })).toBe("teacher");
    expect(roleFromClaims({ app_metadata: { role: "admin" } })).toBe("admin");
    expect(roleFromClaims({ app_metadata: { role: "student" } })).toBe("student");
  });

  it("maps ANY unknown or malformed claim to least privilege", () => {
    // V-25, mirrored. The dangerous direction here is the opposite of the
    // database's: a malformed claim that reads as staff would render the whole
    // console to a student. Every one of these must be 'student'.
    for (const claims of [
      null,
      {},
      { app_metadata: {} },
      { app_metadata: { role: "" } },
      { app_metadata: { role: "superuser" } },
      { app_metadata: { role: "ADMIN" } },        // case matters
      { app_metadata: { role: 42 } },
      { app_metadata: { role: ["admin"] } },
      { app_metadata: { role: { toString: () => "admin" } } },
      { app_metadata: null },
      { role: "admin" },                          // top-level, not app_metadata
      { user_metadata: { role: "admin" } },       // user-writable, must not count
    ]) {
      expect(roleFromClaims(claims), JSON.stringify(claims)).toBe("student");
    }
  });

  it("NEVER reads a role a student could write themselves", () => {
    // `user_metadata` is client-writable through the Supabase auth API.
    // `app_metadata` is not. Reading the wrong one is a privilege escalation
    // that would look like a one-word typo in review.
    expect(roleFromClaims({ user_metadata: { role: "admin" }, app_metadata: { role: "student" } }))
      .toBe("student");
  });

  it("teacher and admin are equivalent — decision D4", () => {
    expect(isStaff("teacher")).toBe(true);
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("student")).toBe(false);
  });
});

describe("JWT payload decoding", () => {
  it("decodes base64url without choking on - and _", () => {
    const payload = { sub: "abc", app_metadata: { role: "teacher" }, note: "a?b>c" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const token = `header.${encoded}.signature`;
    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it("returns null rather than throwing on anything malformed", () => {
    // This runs during render. A throw here is a white screen for a teacher
    // mid-class, and the correct behaviour is to fall through to "not staff".
    for (const bad of ["", "a", "a.b", "a.!!!.c", "....", "a.eyJib2d1cw.c"]) {
      expect(decodeJwtPayload(bad)).toBeNull();
    }
  });

  it("a malformed token therefore denies, it does not grant", () => {
    const claims = decodeJwtPayload("garbage");
    expect(claims).toBeNull();
    expect(roleFromClaims(claims)).toBe("student");
    expect(isStaff(roleFromClaims(claims))).toBe(false);
  });
});

/**
 * The bootstrap-credentials flag.
 *
 * `bootstrap-admin.mjs` stamps `app_metadata.must_change_credentials` on every
 * account it creates, because the password it prints to a terminal has been seen
 * and is not a secret. The console blocks on a change screen while it is set.
 *
 * Read from `app_metadata` and NOWHERE else. `profiles` carries a `p_update`
 * policy letting a user edit their own row, so a column there could be cleared
 * without the password ever changing; `user_metadata` is writable by the user
 * through the Supabase auth API. Only `app_metadata` is service-role only, which
 * is the same reason `role` lives there.
 */
describe("mustChangeFromClaims", () => {
  it("is true only for an explicit boolean true in app_metadata", () => {
    expect(mustChangeFromClaims({ app_metadata: { must_change_credentials: true } })).toBe(true);
    expect(mustChangeFromClaims({ app_metadata: { must_change_credentials: false } })).toBe(false);
  });

  it("defaults to NOT flagged when the claim is missing or malformed", () => {
    /*
     * Least privilege runs the other way here than it does for `role`. A stuck
     * prompt that cannot be dismissed locks an admin out of their own console,
     * so anything unclear means "not flagged" rather than "flagged".
     */
    for (const claims of [
      null,
      undefined,
      {},
      { app_metadata: {} },
      { app_metadata: { must_change_credentials: "true" } },
      { app_metadata: { must_change_credentials: 1 } },
      "not an object",
    ]) {
      expect(mustChangeFromClaims(claims)).toBe(false);
    }
  });

  it("ignores user_metadata, which the user can write themselves", () => {
    // The mirror image of the role rule, and the reason it is tested: a user who
    // could set this could not GRANT themselves anything, but they could dodge
    // the prompt — and the prompt is the only thing standing between a printed
    // password and a live gradebook.
    expect(mustChangeFromClaims({ user_metadata: { must_change_credentials: true } })).toBe(false);
  });
});

describe("sign-in failures — one sentence for every credential cause, and never for anything else", () => {
  it("prints the SAME sentence for every 4xx, so it cannot tell who exists", () => {
    // Supabase answers 400 for a wrong password AND for an unknown address.
    // Any split between them here would be an enumeration oracle on the app
    // that holds the answer keys.
    for (const status of [400, 401, 403, 404, 422]) {
      expect(signInFailureMessage({ status })).toBe(CREDENTIALS_REJECTED);
    }
  });

  it("does not blame the password when the service never answered", () => {
    // A paused project or a dropped connection used to print "did not match",
    // and a teacher with the right password retyped it forever.
    for (const error of [{}, { status: 0 }, { status: 500 }, { status: 503 }]) {
      const m = signInFailureMessage(error);
      expect(m).not.toBe(CREDENTIALS_REJECTED);
      expect(m).toMatch(/not checked/);
    }
  });

  it("says a rate limit is a rate limit", () => {
    const m = signInFailureMessage({ status: 429 });
    expect(m).not.toBe(CREDENTIALS_REJECTED);
    expect(m).toMatch(/too many/i);
  });
});

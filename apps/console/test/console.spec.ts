import { describe, it, expect } from "vitest";
import { parseRoster, splitCsvLine, nextLockState } from "../src/lib/csv";
import { roleFromClaims, isStaff, decodeJwtPayload } from "../src/lib/session";

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

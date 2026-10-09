/**
 * The /teachers fixture (T1, 7 Oct 2026). The local seed has no teacher
 * roster and its sections have no classes, so the list is served whole from
 * here, with every state the page has: the admin (also a teacher) with a
 * class, an active teacher with two, one not yet claimed, one disabled, a
 * staff account with no employee ID, and a class nobody holds. Fixture names
 * only; nothing here names a real person. Not a spec: the leading underscore
 * keeps Playwright from collecting it.
 */

export const ADMIN_ID = "aaaaaaaa-0000-4000-8000-0000000000ad";

const S2A = "5ec7f1a0-0000-4000-8000-00000000002a";
const S2B = "5ec7f1a0-0000-4000-8000-00000000002b";
const S4A = "5ec7f1a0-0000-4000-8000-00000000004a";
const BOOK9 = "b00c0000-0000-4000-8000-000000000009";
const BOOK10 = "b00c0000-0000-4000-8000-000000000010";

const cls = (id: string, sectionId: string, sectionCode: string, students: number, endedAt: string | null = null) => ({
  id, sectionId, sectionCode, subjectCode: "CPE 412", term: "2026-1", bookId: null,
  bookLabel: "Computer Organization and Architecture: Designing for Performance, 9th ed.", students, endedAt,
});

export const TEACHERS = {
  teachers: [
    {
      key: ADMIN_ID, userId: ADMIN_ID, employeeId: "EMP-0001", fullName: "Fixture Admin", email: "admin@fixture.test",
      role: "admin", status: "active", classes: [cls("c1a00000-0000-4000-8000-000000000001", S4A, "BSCPE-4A", 41)],
      tokensThisMonth: 0, lastSignInAt: "2026-10-07T01:00:00.000Z",
    },
    {
      key: "bbbbbbbb-0000-4000-8000-0000000000b1", userId: "bbbbbbbb-0000-4000-8000-0000000000b1", employeeId: "EMP-0102",
      fullName: "Fixture Teacher Osmeña", email: "osmena@fixture.test", role: "teacher", status: "active",
      classes: [cls("c1a00000-0000-4000-8000-000000000002", S2A, "BSCPE-2A", 38), cls("c1a00000-0000-4000-8000-000000000003", S2B, "BSCPE-2B", 36)],
      tokensThisMonth: 48210, lastSignInAt: "2026-10-06T09:30:00.000Z",
    },
    {
      key: "employee:EMP-0103", userId: null, employeeId: "EMP-0103", fullName: "Fixture Teacher Unclaimed",
      email: "unclaimed@fixture.test", role: "teacher", status: "unclaimed", classes: [], tokensThisMonth: 0, lastSignInAt: null,
    },
    {
      key: "bbbbbbbb-0000-4000-8000-0000000000b4", userId: "bbbbbbbb-0000-4000-8000-0000000000b4", employeeId: "EMP-0104",
      fullName: "Fixture Teacher Disabled", email: null, role: "teacher", status: "disabled", classes: [],
      tokensThisMonth: 0, lastSignInAt: "2026-09-01T00:00:00.000Z",
    },
    {
      key: "bbbbbbbb-0000-4000-8000-0000000000b5", userId: "bbbbbbbb-0000-4000-8000-0000000000b5", employeeId: null,
      fullName: "Fixture Staff Without ID", email: "noid@fixture.test", role: "teacher", status: "active", classes: [],
      tokensThisMonth: 0, lastSignInAt: null,
    },
  ],
  counts: { total: 5, active: 3, unclaimed: 1, disabled: 1 },
  unassigned: [{ ...cls("c1a00000-0000-4000-8000-000000000009", S2B, "BSCPE-2B", 36), term: "2026-2" }],
  sections: [
    { id: S2A, code: "BSCPE-2A", term: "2026-1" },
    { id: S2B, code: "BSCPE-2B", term: "2026-1" },
    { id: S4A, code: "BSCPE-4A", term: "2026-1" },
  ],
  subjects: [{
    code: "CPE 412", title: "Computer Architecture and Organization", books: [
      { id: BOOK9, title: "Computer Organization and Architecture: Designing for Performance", author: "William Stallings", edition: "9th", isDefault: true },
      { id: BOOK10, title: "Computer Organization and Architecture: Designing for Performance", author: "William Stallings", edition: "10th", isDefault: false },
    ],
  }],
};

/** Every outcome the import preview has. */
export const PASTE = [
  "EMP-0201, Fixture New Teacher, new@fixture.test",
  "EMP-0102, Fixture Teacher Renamed",
  "EMP-0202, Fixture Twice",
  "EMP-0202, Fixture Twice Again",
].join("\n");

export const PLAN = {
  dryRun: true,
  summary: { insert: 1, update: 0, unchanged: 0, conflict: 3 },
  plan: [
    { employeeId: "EMP-0201", fullName: "Fixture New Teacher", email: "new@fixture.test", role: "teacher", current: null, action: "insert" },
    { employeeId: "EMP-0102", fullName: "Fixture Teacher Renamed", email: null, role: "teacher", current: { fullName: "Fixture Teacher Osmeña", email: "osmena@fixture.test", role: "teacher", status: "claimed" }, action: "conflict", why: "claimed" },
    { employeeId: "EMP-0202", fullName: "Fixture Twice", email: null, role: "teacher", current: null, action: "conflict", why: "duplicate" },
    { employeeId: "EMP-0202", fullName: "Fixture Twice Again", email: null, role: "teacher", current: null, action: "conflict", why: "duplicate" },
  ],
};

/**
 * Every teacher's face (PROFILES, 9 Oct 2026): a generated planet each, and a
 * real picture on Osmeña's with `removable` true, as the API says it to the
 * admin. The picture is a small inline SVG so no storage is needed. Fixture
 * names only; the key (`removable`) is the server's answer, never the page's.
 */
const FACE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='#456'/><circle cx='32' cy='26' r='12' fill='#cba'/><rect x='12' y='42' width='40' height='22' rx='10' fill='#cba'/></svg>",
  );
TEACHERS.teachers.forEach((t, i) =>
  Object.assign(t, {
    avatar: { url: i === 1 ? FACE : null, hue: (40 + i * 70) % 360, variant: i % 4, removable: i === 1 },
  }),
);

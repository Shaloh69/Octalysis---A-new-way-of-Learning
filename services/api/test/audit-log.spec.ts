import { describe as group, it, expect } from "vitest";
import { describe, toAuditCsv } from "../src/audit/log.js";

/**
 * `/audit`'s sentences, one per action, for the actions `console.spec.ts`
 * does not write through a route. The page and the CSV both print these, so a
 * wrong one is wrong in the evidence a teacher hands a dean.
 */

const row = (over: Record<string, unknown>) =>
  ({
    id: "1", action: "", target_type: null, target_id: null, payload: {}, at: new Date(0),
    actor_id: null, actor_name: null, subject_user_id: null, subject_name: null, subject_student_id: null,
    item_slug: null, assessment_title: null, block_stage: null, block_ordinal: null,
    submission_title: null, stage_title: null, section_code: null,
    ...over,
  }) as Parameters<typeof describe>[0];

const say = (over: Record<string, unknown>) => {
  const r = row(over);
  return describe(r, (r.payload ?? {}) as Record<string, unknown>);
};

group("describe: one sentence per audited action", () => {
  it("locks say what, for whom, and whether a schedule did it", () => {
    expect(say({ action: "lock.set", target_id: "05", payload: { scope: "section", state: "locked" }, section_code: "BSCPE - 4" }))
      .toBe("Closed stage 05 for section BSCPE - 4");
    expect(say({ action: "lock.set", target_id: "05", payload: { scope: "global", state: "auto" } }))
      .toBe("Returned stage 05 to its prerequisites for everyone");
    expect(say({ action: "lock.set", target_id: "05", payload: { scope: "global", state: "unlocked", unlockAt: "2026-10-01T00:00:00Z" } }))
      .toBe("Opened stage 05 for everyone, on a schedule");
  });

  it("marks carry the student, the work and the score", () => {
    expect(say({ action: "submission.grade", subject_name: "Ana Reyes", submission_title: "Lab 3", payload: { score: 3, maxScore: 4 } }))
      .toBe("Marked Lab 3 for Ana Reyes: 3 of 4");
    expect(say({ action: "submission.return", subject_name: "Ana Reyes", submission_title: "Lab 3", payload: { reason: "x" } }))
      .toBe("Returned Lab 3 to Ana Reyes for revision");
  });

  it("items name their slug, and a self-approval says so", () => {
    expect(say({ action: "item.status", item_slug: "M-04-cache-1", payload: { from: "review", to: "live", selfApproved: true } }))
      .toBe("Moved item M-04-cache-1 from review to live, approving their own item");
    expect(say({ action: "item.create", payload: { slug: "M-04-cache-2", via: "import" } }))
      .toBe("Created item M-04-cache-2 by import");
    expect(say({ action: "item.status", payload: { from: "draft", to: "review" } }))
      .toBe("Moved an item from draft to review");
  });

  it("roster, accounts, assessments and feedback", () => {
    expect(say({ action: "roster.deactivate", subject_name: "Ana Reyes" })).toBe("Deactivated Ana Reyes");
    expect(say({ action: "roster.import", target_id: "BSCPE - 4", payload: { inserted: ["1", "2"], updated: ["3"] } }))
      .toBe("Imported the roster for BSCPE - 4: 2 added, 1 updated");
    expect(say({ action: "auth.register", target_id: "21-0003" })).toBe("Claimed student ID 21-0003");
    expect(say({ action: "assessment.salt_rotate", assessment_title: "Prelim Examination" }))
      .toBe("Rotated the exam salt of Prelim Examination");
    expect(say({ action: "feedback.triage", payload: { status: "wont_fix" } })).toBe("Marked a feedback report won't fix");
    expect(say({ action: "summary.send_back", target_id: "03", payload: { wasLive: false } }))
      .toBe("Sent back the summary for stage 03");
  });

  it("an action it has never heard of still says something true", () => {
    expect(say({ action: "thing.happened", target_type: "stage", target_id: "02" })).toBe("thing.happened on stage 02");
  });
});

group("the CSV never becomes a formula", () => {
  it("prefixes a cell a spreadsheet would execute, and quotes what needs quoting", () => {
    const csv = toAuditCsv([
      {
        id: "1", at: "2026-09-28T00:00:00.000Z", action: "lock.set", family: "locks", what: "Opened stage 05 for everyone",
        actor: null, subject: null, target: { type: "stage", id: "05", label: "Stage 05" },
        reason: "@SUM(A1:A9), then +1", payload: {},
      },
    ]);
    const line = csv.split("\n")[1]!;
    expect(line).toContain(`"'@SUM(A1:A9), then +1"`);
    expect(line).toContain("System (scheduled)");
  });
});

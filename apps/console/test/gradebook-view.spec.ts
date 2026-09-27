import { describe, it, expect } from "vitest";
import {
  checkText, countedWords, coveredWords, exportedWords, matches, pctText, stageRange,
} from "../src/lib/gradebook-view";

describe("checkText: a stage check in a cell", () => {
  it("not sat is words, never 0", () => {
    expect(checkText(null)).toBe("not sat");
  });
  it("a real 0% is 0", () => {
    expect(checkText(0)).toBe("0");
  });
  it("a score is a whole percentage", () => {
    expect(checkText(63.6)).toBe("64");
  });
});

describe("pctText: a component or a final", () => {
  it("nothing to count is a dash, not 0", () => {
    expect(pctText(null)).toBe("–");
  });
  it("one decimal, as the CSV writes it", () => {
    expect(pctText(34)).toBe("34.0");
    expect(pctText(86.25)).toBe("86.3");
  });
});

describe("stageRange", () => {
  it("a run reads as a range", () => {
    expect(stageRange(["01", "02", "03", "04", "05", "06", "07"])).toBe("01–07");
  });
  it("gaps are listed", () => {
    expect(stageRange(["01", "02", "05"])).toBe("01–02, 05");
  });
  it("one stage, and none", () => {
    expect(stageRange(["04"])).toBe("04");
    expect(stageRange([])).toBe("");
  });
});

describe("countedWords: what a component is made of so far", () => {
  const c = (key: "project" | "quizzes" | "exams" | "labs" | "participation", n: number) => ({
    key, covered: n > 0, counted: Array.from({ length: n }, (_, i) => ({ id: String(i), title: "" })),
  });
  it("names the parts, with the right plural", () => {
    expect(countedWords(c("quizzes", 7))).toBe("7 stage checks");
    expect(countedWords(c("quizzes", 1))).toBe("1 stage check");
    expect(countedWords(c("exams", 1))).toBe("1 exam");
    expect(countedWords(c("labs", 3))).toBe("3 labs");
    expect(countedWords(c("project", 1))).toBe("1 project");
    expect(countedWords(c("participation", 2))).toBe("2 entries");
  });
  it("a component with no marks says so", () => {
    expect(countedWords(c("project", 0))).toBe("no marks yet");
  });
});

describe("coveredWords", () => {
  const comp = (label: string, covered: boolean) => ({ label, covered });
  it("names the components that count", () => {
    expect(coveredWords([comp("Quizzes", true), comp("Project", false), comp("Laboratory exercises", true)]))
      .toBe("Quizzes and Laboratory exercises have marks");
    expect(coveredWords([comp("Quizzes", true)])).toBe("Quizzes has marks");
    expect(coveredWords([comp("A", true), comp("B", true), comp("C", true)])).toBe("A, B and C have marks");
  });
  it("says so when nothing is marked", () => {
    expect(coveredWords([comp("Quizzes", false)])).toBe("nothing marked yet");
  });
});

describe("matches: the filter", () => {
  const s = { fullName: "Juan Miguel Dela Cruz", studentId: "232129001" };
  it("by any part of the name, ignoring case", () => {
    expect(matches(s, "dela cruz")).toBe(true);
    expect(matches(s, "  JUAN ")).toBe(true);
  });
  it("by student ID", () => {
    expect(matches(s, "2321290")).toBe(true);
  });
  it("an empty query matches everyone; a stranger nobody", () => {
    expect(matches(s, "")).toBe(true);
    expect(matches(s, "Reyes")).toBe(false);
  });
});

describe("exportedWords: the export's toast says what was in the file", () => {
  it("students and coverage", () => {
    expect(exportedWords(21, 40)).toBe("21 students, 40% of the grade covered");
    expect(exportedWords(1, 0)).toBe("1 student, nothing marked yet");
  });
});

import { describe, expect, it } from "vitest";
import { assessmentDate } from "./assessment-date";

describe("assessment calendar dates", () => {
  it("switches Singapore thresholds at midnight Singapore time", () => {
    const before = new Date("2026-12-31T15:59:59Z");
    const after = new Date("2026-12-31T16:00:00Z");

    expect(assessmentDate(before, "Asia/Singapore")).toBe("2026-12-31");
    expect(assessmentDate(after, "Asia/Singapore")).toBe("2027-01-01");
    expect(assessmentDate(after)).toBe("2026-12-31");
  });
});

import { describe, expect, it } from "vitest";
import { evaluatePolicy, type Condition, type Policy, type RuleSource } from "./policy";

const verifiedSource: RuleSource = {
  url: "https://example.test/policy",
  applicableWhen: { en: "Test applicants", zh: "测试申请人" },
  effectiveFrom: "2026-02-01",
  lastVerifiedAt: "2026-02-02",
  reviewStatus: "verified",
};

const jobOffer: Condition = {
  id: "job-offer",
  input: "jobOffer",
  operator: "eq",
  expected: true,
  label: { en: "Job offer", zh: "工作邀请" },
  nextStep: { en: "Check offer requirements", zh: "查看工作邀请要求" },
  source: verifiedSource,
};

const onshore: Condition = {
  ...jobOffer,
  id: "onshore",
  input: "answer:onshore",
};

const policy: Policy = {
  id: "test-policy",
  version: "2026-02-02.1",
  stage: "application",
  conditions: [jobOffer, onshore],
};

const asOf = "2026-02-03";

describe("evaluatePolicy", () => {
  it("returns traceable checks and preserves the evaluation stage and policy version", () => {
    const application = evaluatePolicy(policy, { jobOffer: true, answers: { onshore: true } }, asOf);
    const invitation = evaluatePolicy(
      { ...policy, stage: "invitation" },
      { jobOffer: true, answers: { onshore: true } },
      asOf,
    );

    expect(application).toEqual({
      status: "conditions-met",
      stage: "application",
      version: policy.version,
      checks: [
        { condition: jobOffer, status: "pass" },
        { condition: onshore, status: "pass" },
      ],
      coverageIssue: null,
    });
    expect(invitation.stage).toBe("invitation");
  });

  it("keeps known gaps visible when a different input is missing", () => {
    const result = evaluatePolicy(policy, { jobOffer: false }, asOf);

    expect(result.status).toBe("conditions-not-met");
    expect(result.checks.map(({ status }) => status)).toEqual(["fail", "unknown"]);
  });

  it("keeps missing or incompatible input unknown without coercion", () => {
    for (const input of [undefined, "   ", "true", 1, Number.NaN]) {
      const result = evaluatePolicy(policy, { jobOffer: true, answers: { onshore: input } }, asOf);

      expect(result.status).toBe("profile-incomplete");
      expect(result.checks.map(({ status }) => status)).toEqual(["pass", "unknown"]);
    }
  });

  it("checks categorical membership and inclusive numeric bounds", () => {
    const points: Policy = {
      ...policy,
      conditions: [
        { ...jobOffer, id: "age", input: "age", operator: "lte", expected: 30 },
        { ...jobOffer, id: "budget", input: "budgetUsd", operator: "gte", expected: 1000 },
        { ...jobOffer, id: "goal", input: "goal", operator: "in", expected: ["study", "work"] },
      ],
    };

    const meets = evaluatePolicy(points, { age: 30, budgetUsd: 1000, goal: "study" }, asOf);
    const gaps = evaluatePolicy(points, { age: 31, budgetUsd: 999, goal: "travel" }, asOf);

    expect(meets.checks.map(({ status }) => status)).toEqual(["pass", "pass", "pass"]);
    expect(gaps.checks.map(({ status }) => status)).toEqual(["fail", "fail", "fail"]);
  });

  it("distinguishes absent coverage from a profile with missing inputs", () => {
    expect(evaluatePolicy(undefined, {}, asOf)).toEqual({
      status: "rules-not-covered",
      stage: null,
      version: null,
      checks: [],
      coverageIssue: "missing-policy",
    });
    expect(evaluatePolicy({ ...policy, conditions: [] }, {}, asOf).coverageIssue).toBe(
      "unusable-version",
    );
    expect(evaluatePolicy(policy, {}, asOf).status).toBe("profile-incomplete");
  });

  it.each<Partial<RuleSource>>([
    { reviewStatus: "pending" },
    { reviewStatus: "retired" },
    { url: "http://example.test/policy" },
    { url: "https://user:password@example.test/policy" },
    { lastVerifiedAt: null },
    { lastVerifiedAt: "2026-02-04" },
    { lastVerifiedAt: "2026-02-30" },
    { effectiveFrom: "2026-02-04" },
    { effectiveUntil: "2026-02-03" },
  ])("does not use a version containing an unusable source (%o)", (source) => {
    const candidate = {
      ...policy,
      conditions: [jobOffer, { ...onshore, source: { ...verifiedSource, ...source } }],
    };
    const result = evaluatePolicy(candidate, { jobOffer: true, answers: { onshore: true } }, asOf);

    expect(result.status).toBe("rules-not-covered");
    expect(result.coverageIssue).toBe("unusable-version");
    expect(result.checks).toEqual([]);
  });

  it("uses a rule with unknown effective date only on or after verification", () => {
    const candidate = {
      ...policy,
      conditions: [{ ...jobOffer, source: { ...verifiedSource, effectiveFrom: null } }],
    };
    const profile = { jobOffer: true };

    expect(evaluatePolicy(candidate, profile, "2026-02-01").status).toBe("rules-not-covered");
    expect(evaluatePolicy(candidate, profile, "2026-02-02").status).toBe("conditions-met");
  });

  it("rejects non-calendar or non-canonical evaluation dates", () => {
    expect(evaluatePolicy(policy, {}, "2026-02-30").coverageIssue).toBe("invalid-as-of");
    expect(evaluatePolicy(policy, {}, "2026-2-2").coverageIssue).toBe("invalid-as-of");
  });
});

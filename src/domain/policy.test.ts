import { describe, expect, it } from "vitest";
import {
  evaluatePathway,
  evaluatePolicy,
  type Condition,
  type Policy,
  type RuleExpression,
  type RuleSource,
} from "./policy";

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

const leaf = (condition: Condition): RuleExpression => ({ kind: "condition", conditionId: condition.id });
const summary = { id: "requirements", label: jobOffer.label, nextStep: jobOffer.nextStep };

describe("compound policy expressions", () => {
  it("evaluates nested AND and OR and distinguishes alternatives from mandatory checks", () => {
    const language: Condition = { ...jobOffer, id: "language", input: "language", expected: "B1" };
    const compound: Policy = {
      ...policy,
      conditions: [jobOffer, onshore, language],
      expression: {
        kind: "all",
        children: [
          leaf(onshore),
          { kind: "any", children: [leaf(jobOffer), leaf(language)], summary },
        ],
      },
    };
    const profile = { answers: { onshore: true }, jobOffer: false };
    const pass = evaluatePolicy(compound, { ...profile, language: "B1" }, asOf);

    expect(pass.status).toBe("conditions-met");
    expect(pass.checks.map(({ status, role }) => [status, role])).toEqual([
      ["pass", "required"],
      ["fail", "alternative"],
      ["pass", "alternative"],
    ]);
    expect(pass.groups).toEqual([{ ...summary, status: "pass", role: "required" }]);
    expect(evaluatePolicy(compound, { ...profile, language: "A1" }, asOf).status).toBe("conditions-not-met");
    expect(evaluatePolicy(compound, profile, asOf).status).toBe("profile-incomplete");
  });

  it("does not evaluate requirements outside their confirmed scope", () => {
    const candidate: Policy = {
      ...policy,
      expression: { kind: "when", test: leaf(onshore), requirement: leaf(jobOffer) },
    };
    const irrelevant = evaluatePolicy(candidate, { jobOffer: false, answers: { onshore: false } }, asOf);
    const unconfirmed = evaluatePolicy(candidate, { jobOffer: false }, asOf);
    const applicable = evaluatePolicy(candidate, { jobOffer: false, answers: { onshore: true } }, asOf);

    expect(irrelevant.status).toBe("conditions-not-applicable");
    expect(irrelevant.checks.map(({ condition, role }) => [condition.id, role])).toEqual([
      ["onshore", "applicability"],
    ]);
    expect(unconfirmed.status).toBe("profile-incomplete");
    expect(unconfirmed.checks.map(({ condition }) => condition.id)).toEqual(["onshore"]);
    expect(applicable.status).toBe("conditions-not-met");
    expect(applicable.checks.map(({ condition }) => condition.id)).toEqual(["onshore", "job-offer"]);
  });

  it("applies exceptions only when confirmed and preserves other required checks", () => {
    const funds: Condition = { ...jobOffer, id: "funds", input: "budgetUsd", operator: "gte", expected: 1000 };
    const candidate: Policy = {
      ...policy,
      conditions: [jobOffer, onshore, funds],
      expression: {
        kind: "all",
        children: [leaf(onshore), { kind: "unless", test: leaf(jobOffer), requirement: leaf(funds) }],
      },
    };
    const onshoreProfile = { answers: { onshore: true }, budgetUsd: 0 };
    const exempt = evaluatePolicy(candidate, { ...onshoreProfile, jobOffer: true }, asOf);

    expect(exempt.status).toBe("conditions-met");
    expect(exempt.checks.map(({ condition, role }) => [condition.id, role])).toEqual([
      ["onshore", "required"],
      ["job-offer", "exception"],
    ]);
    expect(evaluatePolicy(candidate, { ...onshoreProfile, jobOffer: false }, asOf).status)
      .toBe("conditions-not-met");
    expect(evaluatePolicy(candidate, onshoreProfile, asOf).status).toBe("profile-incomplete");
    expect(evaluatePolicy(candidate, { jobOffer: true, answers: { onshore: false } }, asOf).status)
      .toBe("conditions-not-met");
  });

  it("resolves mutually exclusive answers without treating a failed alternative as a gap", () => {
    const offshore: Condition = { ...onshore, id: "offshore", expected: false };
    const candidate: Policy = {
      ...policy,
      conditions: [onshore, offshore],
      expression: { kind: "any", children: [leaf(onshore), leaf(offshore)] },
    };
    const east = evaluatePolicy(candidate, { answers: { onshore: true } }, asOf);
    const west = evaluatePolicy(candidate, { answers: { onshore: false } }, asOf);
    expect(east.status).toBe("conditions-met");
    expect(east.checks.map(({ status }) => status)).toEqual(["pass", "fail"]);
    expect(west.status).toBe("conditions-met");
    expect(west.checks.map(({ status }) => status)).toEqual(["fail", "pass"]);
    expect(evaluatePolicy(candidate, {}, asOf).status).toBe("profile-incomplete");
  });

  it("keeps conditional and directory coverage separate from goal relevance and full eligibility", () => {
    const aligned = evaluatePathway(policy, { goal: "job-search", jobOffer: true, answers: { onshore: true } },
      asOf, ["job-search"]);
    const directory = evaluatePathway(undefined, { goal: "job-search" }, asOf, ["job-search"]);
    const unrelated = evaluatePathway(policy, { goal: "study" }, asOf, ["job-search"]);

    expect(aligned).toMatchObject({
      relevance: "aligned", coverage: "checked-conditions",
      outcome: { status: "conditions-met" }, fullEligibility: "unverified",
    });
    expect(directory).toMatchObject({
      relevance: "aligned", coverage: "directory-only",
      outcome: { status: "rules-not-covered" }, fullEligibility: "unverified",
    });
    expect(unrelated).toMatchObject({ relevance: "different-goal", fullEligibility: "unverified" });
    expect(evaluatePathway(policy, { goal: " " }, asOf, ["job-search"]).relevance).toBe("goal-unknown");
  });

  it("fails closed for malformed or unverified expression definitions", () => {
    const unknown: RuleExpression = { kind: "condition", conditionId: "missing" };
    const unusable: RuleExpression[] = [
      { kind: "all", children: [] },
      { kind: "any", children: [leaf(jobOffer), unknown] },
      { kind: "unless", test: leaf(jobOffer), requirement: unknown },
      {
        ...summary, kind: "points", minimum: 1,
        source: { ...verifiedSource, reviewStatus: "pending" },
        categories: [{ id: "one", alternatives: [{ when: leaf(jobOffer), points: 1 }] }],
      },
      {
        ...summary, kind: "points", minimum: 1, source: verifiedSource,
        categories: [{ id: "one", alternatives: [{ when: leaf(jobOffer), points: { minimum: 2, maximum: 1 } }] }],
      },
    ];
    for (const expression of unusable) {
      expect(evaluatePolicy({ ...policy, expression }, { jobOffer: true }, asOf).coverageIssue)
        .toBe("unusable-version");
    }
  });
});

describe("points policies", () => {
  const senior: Condition = { ...jobOffer, id: "senior", input: "experienceYears", operator: "gte", expected: 5 };
  const experienced: Condition = { ...senior, id: "experienced", expected: 2 };
  const language: Condition = { ...jobOffer, id: "language", input: "language", expected: "B2" };
  const boundary: Condition = { ...jobOffer, id: "age-boundary", input: "age", expected: 35 };
  const pointsPolicy: Policy = {
    ...policy,
    conditions: [senior, experienced, language, boundary],
    expression: {
      ...summary, kind: "points", minimum: 5, source: verifiedSource,
      categories: [
        { id: "experience", alternatives: [{ when: leaf(senior), points: 3 }, { when: leaf(experienced), points: 2 }] },
        { id: "language", alternatives: [{ when: leaf(language), points: 2 }] },
        { id: "age", alternatives: [{ when: leaf(boundary), points: { minimum: 1, maximum: 2 } }] },
      ],
    },
  };

  it("awards the highest confirmed tier once even if multiple tiers match", () => {
    const scored = evaluatePolicy(pointsPolicy, { age: 41, experienceYears: 5, language: "B1" }, asOf);

    expect(scored.status).toBe("conditions-not-met");
    expect(scored.scores).toMatchObject([{ earned: 3, possible: 3, minimum: 5, role: "required" }]);
    expect(scored.checks.slice(0, 2).map(({ status, role }) => [status, role])).toEqual([
      ["pass", "points"],
      ["pass", "points"],
    ]);
  });

  it("uses uncertainty bounds rather than counting missing answers or resolving a policy range arbitrarily", () => {
    const unconfirmed = evaluatePolicy(pointsPolicy, { age: 35, experienceYears: 5 }, asOf);
    const passed = evaluatePolicy(pointsPolicy, { age: 35, experienceYears: 5, language: "B2" }, asOf);
    const failed = evaluatePolicy(pointsPolicy, { age: 41, experienceYears: 0 }, asOf);

    expect(unconfirmed.status).toBe("profile-incomplete");
    expect(unconfirmed.scores).toMatchObject([{ earned: 4, possible: 7, status: "unknown" }]);
    expect(passed.status).toBe("conditions-met");
    expect(passed.scores).toMatchObject([{ earned: 6, possible: 7, status: "pass" }]);
    expect(failed.status).toBe("conditions-not-met");
    expect(failed.scores).toMatchObject([{ earned: 0, possible: 2, status: "fail" }]);
  });
});

describe("policy date boundaries", () => {
  it("includes the effective date and excludes the expiry date", () => {
    const condition: Condition = {
      ...jobOffer,
      source: {
        ...verifiedSource, lastVerifiedAt: "2026-02-01T21:34:56Z",
        effectiveFrom: "2026-02-02", effectiveUntil: "2026-02-04",
      },
    };
    const candidate: Policy = { ...policy, conditions: [condition], expression: leaf(condition) };
    const profile = { jobOffer: true };

    expect(evaluatePolicy(candidate, profile, "2026-02-01").status).toBe("rules-not-covered");
    expect(evaluatePolicy(candidate, profile, "2026-02-02").status).toBe("conditions-met");
    expect(evaluatePolicy(candidate, profile, "2026-02-03").status).toBe("conditions-met");
    expect(evaluatePolicy(candidate, profile, "2026-02-04").status).toBe("rules-not-covered");
  });

  it("uses valid UTC evidence timestamps and rejects ambiguous dates and offsets", () => {
    const evaluateAt = (lastVerifiedAt: string, date: string) => evaluatePolicy({
      ...policy,
      conditions: [{ ...jobOffer, source: { ...verifiedSource, lastVerifiedAt } }],
    }, { jobOffer: true }, date);

    expect(evaluateAt("2026-02-03T23:59:59.123Z", "2026-02-02").status).toBe("rules-not-covered");
    expect(evaluateAt("2026-02-03T23:59:59.123Z", "2026-02-03").status).toBe("conditions-met");
    expect(evaluateAt("2026-02-03T12:00:00+08:00", asOf).status).toBe("rules-not-covered");
    expect(evaluateAt("2026-02-03T24:00:00Z", asOf).status).toBe("rules-not-covered");
    expect(evaluateAt("2026-02-30T12:00:00Z", "2026-03-03").status).toBe("rules-not-covered");
  });
});

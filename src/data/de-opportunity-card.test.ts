import { describe, expect, it } from "vitest";
import { evaluatePathway, evaluatePolicy, type Profile } from "../domain/policy";
import { deOpportunityCardPointsPolicy as policy } from "./de-opportunity-card";
import { prepareMatchingProfile } from "./matching-profile";

const asOf = "2026-11-28";
const answers = {
  outsideEuEfta: true,
  deApplyingFromAbroad: true,
  deQualificationBasis: "academic",
  dePartialRecognition: false,
  deGermanLevel: "B1",
  deEnglishLevel: "none",
  deRelevantYearsLast5: 2,
  deRelevantYearsLast7: 2,
  deShortageQualification: false,
  dePriorStay: false,
  deJointPartner: false,
  deFormalCommitment: false,
  deBlockedEurMonthly: 1_091,
};

function profile(overrides: Partial<Profile> = {}): Profile {
  return prepareMatchingProfile({
    age: 34,
    goal: "job-search",
    jobOffer: false,
    ...overrides,
    answers: { ...answers, ...overrides.answers },
  });
}

function evaluate(overrides?: Partial<Profile>, date = asOf) {
  return evaluatePolicy(policy, profile(overrides), date);
}

function group(outcome: ReturnType<typeof evaluate>, id: string) {
  return outcome.groups?.find((entry) => entry.id === id)?.status;
}

describe("initial German Opportunity Card points mechanism, applying from abroad", () => {
  it("meets six checked points with B1 German, two years of related work and age under 35", () => {
    const result = evaluatePathway(policy, profile(), asOf, ["job-search"]);
    expect(result).toMatchObject({
      relevance: "aligned",
      coverage: "checked-conditions",
      fullEligibility: "unverified",
      outcome: { status: "conditions-met", scores: [{ earned: 6, possible: 6, minimum: 6, status: "pass" }] },
    });
  });

  it.each([
    { age: 35, earned: 5, possible: 6, status: "unknown" },
    { age: 36, earned: 5, possible: 5, status: "fail" },
    { age: 39, earned: 5, possible: 5, status: "fail" },
    { age: 40, earned: 4, possible: 5, status: "fail" },
    { age: 41, earned: 4, possible: 4, status: "fail" },
  ])("keeps the age-$age statutory scoring boundary bounded", ({ age, earned, possible, status }) => {
    expect(evaluate({ age }).scores).toMatchObject([{ earned, possible, status }]);
  });

  it("leaves a potential sixth point at age 40 unresolved", () => {
    const outcome = evaluate({ age: 40, answers: { deRelevantYearsLast5: 3, deRelevantYearsLast7: 5 } });
    expect(outcome.status).toBe("profile-incomplete");
    expect(outcome.scores).toMatchObject([{ earned: 5, possible: 6, status: "unknown" }]);
  });

  it("counts the highest German and related-work tiers, plus qualifying English separately", () => {
    const outcome = evaluate({ age: 41, answers: {
      deGermanLevel: "B2", deEnglishLevel: "C1", deRelevantYearsLast5: 3, deRelevantYearsLast7: 5,
    } });
    expect(outcome.scores).toMatchObject([{ earned: 7, possible: 7, status: "pass" }]);
  });

  it("uses documented English B2 as a language alternative without awarding a point for it", () => {
    const outcome = evaluate({ answers: { deGermanLevel: "none", deEnglishLevel: "B2", deShortageQualification: true } });
    expect(group(outcome, "entry-language")).toBe("pass");
    expect(outcome.scores).toMatchObject([{ earned: 5, possible: 5, status: "fail" }]);
  });

  it("credits native English only when evidence acceptance is confirmed", () => {
    const overrides = { deGermanLevel: "none", deShortageQualification: true };
    const accepted = evaluate({ answers: { ...overrides, deEnglishLevel: "native-accepted" } });
    expect(group(accepted, "entry-language")).toBe("pass");
    expect(accepted.scores).toMatchObject([{ earned: 6, possible: 6 }]);
    const unconfirmed = evaluate({ answers: { ...overrides, deEnglishLevel: undefined } });
    expect(group(unconfirmed, "entry-language")).toBe("unknown");
  });

  it("keeps the minimum-language proof unknown when the other language is below its threshold", () => {
    const outcome = evaluate({ answers: { deGermanLevel: "none", deEnglishLevel: undefined } });
    expect(group(outcome, "entry-language")).toBe("unknown");
  });

  it("applies the official recognition exception without skipping language or funds", () => {
    const outcome = evaluate({ age: 41, answers: {
      deQualificationBasis: "none", dePartialRecognition: true, deRelevantYearsLast5: 0, deRelevantYearsLast7: 0,
    } });
    expect(group(outcome, "qualification")).toBe("pass");
    expect(outcome.scores).toMatchObject([{ earned: 6, possible: 6, status: "pass" }]);
    expect(outcome.status).toBe("conditions-met");
    expect(evaluate({ answers: { deQualificationBasis: "none", dePartialRecognition: true, deGermanLevel: "none" } }).status)
      .toBe("conditions-not-met");
  });

  it("accepts established ordinary qualification while the exception evidence is unanswered", () => {
    expect(group(evaluate({ answers: { dePartialRecognition: undefined } }), "qualification")).toBe("pass");
  });

  it("distinguishes a one-cent shortfall, an unconfirmed offer, and documented contract income", () => {
    expect(group(evaluate({ answers: { deBlockedEurMonthly: 1_090.99 } }), "funding")).toBe("fail");
    expect(group(evaluate({ jobOffer: true, answers: { deBlockedEurMonthly: 1_090.99 } }), "funding")).toBe("unknown");

    const contract = {
      deGermanPartTimeContract: true,
      deContractHoursWeekly: 20,
      deContractNetEurMonthly: 790.99,
      deBlockedEurMonthly: 300.01,
    };
    const outcome = evaluate({ jobOffer: true, answers: contract });
    expect(group(outcome, "funding")).toBe("pass");
    expect(outcome.scores).toMatchObject([{ earned: 6, possible: 6 }]);
    expect(group(evaluate({ jobOffer: true, answers: { ...contract, deContractHoursWeekly: 20.1 } }), "funding")).toBe("fail");
    expect(group(evaluate({ jobOffer: false, answers: contract }), "funding")).toBe("unknown");
  });

  it("accepts formal commitment independently of amounts and employment", () => {
    expect(group(evaluate({
      answers: { deFormalCommitment: true, deBlockedEurMonthly: undefined },
    }), "funding")).toBe("pass");
  });

  it("does not treat inconsistent five- and seven-year experience as a supported score", () => {
    const outcome = evaluate({ answers: { deRelevantYearsLast5: 5, deRelevantYearsLast7: 4 } });
    expect(outcome.scores).toMatchObject([{ earned: 4, possible: 7, status: "unknown" }]);
  });

  it("does not award a check for known out-of-scope applications or unresolved citizenship", () => {
    expect(evaluate({ answers: { deApplyingFromAbroad: false } })).toMatchObject({
      status: "conditions-not-applicable", scores: [],
    });
    expect(evaluate({ answers: { outsideEuEfta: undefined } })).toMatchObject({
      status: "profile-incomplete", scores: [],
    });
  });

  it("uses the final day of the 2026 evidence window and closes it at the exclusive end", () => {
    expect(evaluate(undefined, "2026-12-31").status).toBe("conditions-met");
    expect(evaluate(undefined, "2027-01-01")).toMatchObject({
      status: "rules-not-covered", coverageIssue: "unusable-version",
    });
  });

  it("records primary evidence, effective date evidence and verification time for every condition", () => {
    for (const { source } of policy.conditions) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(new URL(source.effectiveDateUrl!).protocol).toBe("https:");
      expect(source.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.lastVerifiedAt).toMatch(/^2026-11-(23|28)T/);
      expect(source.applicableWhen).toEqual(expect.objectContaining({ zh: expect.any(String), en: expect.any(String) }));
      expect(source.evidence).toEqual(expect.objectContaining({ zh: expect.any(String), en: expect.any(String) }));
    }
  });
});

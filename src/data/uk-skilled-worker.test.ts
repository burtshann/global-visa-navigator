import { describe, expect, it } from "vitest";
import { evaluatePathway, evaluatePolicy, type Profile } from "../domain/policy";
import { ukSkilledWorkerPolicy as policy } from "./uk-skilled-worker";

const asOf = "2026-11-23";
const completeAnswers = {
  ukSkilledWorkerInitial: true,
  ukSkilledAge: 18,
  ukSkilledJobCos: true,
  ukSkilledSponsorRated: true,
  ukSkilledEnglishBasis: "selt-b2",
};

function evaluate(answers: Profile["answers"] = completeAnswers) {
  return evaluatePolicy(policy, { answers }, asOf);
}

describe("first-time UK Skilled Worker principal application check", () => {
  it("passes the four checked conditions, leaving full eligibility unverified", () => {
    expect(evaluatePathway(policy, { answers: completeAnswers, goal: "skilled-work" }, asOf, ["skilled-work"])).toMatchObject({
      relevance: "aligned",
      coverage: "checked-conditions",
      fullEligibility: "unverified",
      outcome: { stage: "application", status: "conditions-met" },
    });
  });

  it("rejects age 17 on the application date", () => {
    const outcome = evaluate({ ...completeAnswers, ukSkilledAge: 17 });
    expect(outcome.status).toBe("conditions-not-met");
    expect(outcome.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "uk-sw-age", expected: 18 }), status: "fail",
    }));
  });

  it("does not substitute a generic offer for a job-specific Certificate of Sponsorship", () => {
    const outcome = evaluatePolicy(policy, {
      jobOffer: true,
      answers: { ...completeAnswers, ukSkilledJobCos: false },
    }, asOf);
    expect(outcome.status).toBe("conditions-not-met");
    expect(outcome.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "uk-sw-job-cos" }), status: "fail",
    }));
  });

  it("requires both the CoS and the authorised A-rated sponsor", () => {
    expect(evaluate({ ...completeAnswers, ukSkilledSponsorRated: false }).status).toBe("conditions-not-met");
    expect(evaluate({ ...completeAnswers, ukSkilledSponsorRated: undefined }).status).toBe("profile-incomplete");
  });

  it("accepts other confirmed English evidence and distinguishes missing proof from an unanswered field", () => {
    expect(evaluate({ ...completeAnswers, ukSkilledEnglishBasis: "other-verified-evidence" }).status).toBe("conditions-met");
    expect(evaluate({ ...completeAnswers, ukSkilledEnglishBasis: "none" }).status).toBe("conditions-not-met");
    expect(evaluate({ ...completeAnswers, ukSkilledEnglishBasis: undefined }).status).toBe("profile-incomplete");
  });

  it("keeps extensions, dependants and other out-of-scope cases outside the check", () => {
    const outcome = evaluate({ ukSkilledWorkerInitial: false });
    expect(outcome.status).toBe("conditions-not-applicable");
    expect(outcome.checks.map(({ condition }) => condition.id)).toEqual(["uk-sw-first-application"]);
  });

  it("requires scope confirmation before evaluating evidence", () => {
    const outcome = evaluate({ ...completeAnswers, ukSkilledWorkerInitial: undefined });
    expect(outcome.status).toBe("profile-incomplete");
    expect(outcome.checks.map(({ condition }) => condition.id)).toEqual(["uk-sw-first-application"]);
  });

  it("records the effective dates for the original conditions and the current first-time English requirement", () => {
    for (const condition of policy.conditions.filter(({ id }) => ["uk-sw-age", "uk-sw-job-cos", "uk-sw-sponsor"].includes(id))) {
      expect(condition.source).toMatchObject({ effectiveFrom: "2020-12-01", effectiveDateUrl: expect.stringContaining("hc-813") });
    }
    expect(policy.conditions.find(({ id }) => id === "uk-sw-english")?.source).toMatchObject({
      effectiveFrom: "2026-01-08", effectiveDateUrl: expect.stringContaining("hc-1333"),
    });
  });
});

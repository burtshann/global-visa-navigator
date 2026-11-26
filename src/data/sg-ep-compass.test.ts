import { describe, expect, it } from "vitest";
import { evaluatePathway, evaluatePolicy, type Profile } from "../domain/policy";
import { prepareMatchingProfile } from "./matching-profile";
import { sgEpCompassPolicy } from "./sg-ep-compass";

const asOf = "2026-11-26";
const noExemption: Profile["answers"] = {
  sgEpInitialApplication: true,
  sgEpFixedMonthlySalarySgd: 10_000,
  sgEpCompassOverseasIct: false,
  sgEpCompassShortRole: false,
};
const zeroPoints: Profile["answers"] = {
  sgEpCompassC1: "0", sgEpCompassC2: "0", sgEpCompassC3: "0",
  sgEpCompassC4: "0", sgEpCompassC5: "0", sgEpCompassC6: "0",
};

function evaluate(answers: Profile["answers"]) {
  return evaluatePolicy(sgEpCompassPolicy, prepareMatchingProfile({
    answers: { ...noExemption, ...answers },
  }), asOf);
}

describe("Employment Pass COMPASS", () => {
  it("requires 40 points and never adds two tiers from the same category", () => {
    const answers = { ...zeroPoints, sgEpCompassC1: "20", sgEpCompassC2: "10" };
    expect(evaluate(answers)).toMatchObject({
      status: "conditions-not-met",
      scores: [{ minimum: 40, earned: 30, possible: 30, status: "fail" }],
    });
    expect(evaluate({ ...answers, sgEpCompassC6: "10" })).toMatchObject({
      status: "conditions-met",
      scores: [{ minimum: 40, earned: 40, possible: 40, status: "pass" }],
    });
  });

  it("counts only the selected C3, C4 and C5 awards", () => {
    expect(evaluate({ ...zeroPoints, sgEpCompassC3: "10", sgEpCompassC4: "10", sgEpCompassC5: "20" })).toMatchObject({
      status: "conditions-met", scores: [{ earned: 40, possible: 40 }],
    });
  });

  it.each([undefined, "15", "20"])("keeps an unconfirmed or impossible C6 award (%s) unknown", (award) => {
    expect(evaluate({
      ...zeroPoints, sgEpCompassC1: "20", sgEpCompassC2: "10", sgEpCompassC6: award,
    })).toMatchObject({ status: "profile-incomplete", scores: [{ earned: 30, possible: 40, status: "unknown" }] });
  });

  it("shows that missing employer award data can still change the outcome", () => {
    expect(evaluate({
      ...zeroPoints, sgEpCompassC1: "10", sgEpCompassC2: "10",
      sgEpCompassC3: undefined, sgEpCompassC4: undefined,
    })).toMatchObject({ status: "profile-incomplete", scores: [{ earned: 20, possible: 60 }] });
    expect(evaluate({ ...zeroPoints, sgEpCompassOverseasIct: undefined })).toMatchObject({
      status: "profile-incomplete", scores: [{ status: "fail" }],
    });
  });

  it.each([
    { sgEpFixedMonthlySalarySgd: 22_500 },
    { sgEpCompassOverseasIct: true },
    { sgEpCompassShortRole: true },
  ])("accepts a confirmed exemption independently of points (%o)", (answers) => {
    expect(evaluate({ ...zeroPoints, ...answers })).toMatchObject({ status: "conditions-met" });
  });

  it("keeps a salary one cent below the exemption and unknown salary distinct", () => {
    expect(evaluate({ ...zeroPoints, sgEpFixedMonthlySalarySgd: 22_499.99 }).status).toBe("conditions-not-met");
    expect(evaluate({ ...zeroPoints, sgEpFixedMonthlySalarySgd: undefined }).status).toBe("profile-incomplete");
  });

  it("applies the renewal expiry cutoff and waits for an unspecified application type or expiry", () => {
    const answers = { ...zeroPoints, sgEpCompassShortRole: true };
    expect(evaluate({ ...answers, sgEpInitialApplication: false, sgEpRenewalExpiryDate: "2024-08-31" }).status).toBe("conditions-not-applicable");
    expect(evaluate({ ...answers, sgEpInitialApplication: false, sgEpRenewalExpiryDate: "2024-09-01" }).status).toBe("conditions-met");
    expect(evaluate({ ...answers, sgEpInitialApplication: false }).status).toBe("profile-incomplete");
    expect(evaluate({ ...answers, sgEpInitialApplication: undefined }).status).toBe("profile-incomplete");
  });

  it("can establish the 40-point minimum independently of an unknown bonus and full eligibility", () => {
    const profile = prepareMatchingProfile({
      goal: "skilled-work",
      answers: { ...noExemption, ...zeroPoints, sgEpCompassC1: "20", sgEpCompassC2: "20", sgEpCompassC6: undefined },
    });
    expect(evaluatePathway(sgEpCompassPolicy, profile, asOf, ["skilled-work"])).toMatchObject({
      outcome: {
        status: "conditions-met",
        scores: [{ earned: 40, possible: 50 }],
        checks: expect.arrayContaining([expect.objectContaining({
          condition: expect.objectContaining({ input: "answer:sgEpCompassC6" }), status: "unknown",
        })]),
      },
      fullEligibility: "unverified",
    });
  });
});

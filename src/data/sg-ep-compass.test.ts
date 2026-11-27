import { describe, expect, it } from "vitest";
import { evaluatePathway, evaluatePolicy, type Profile } from "../domain/policy";
import { prepareMatchingProfile } from "./matching-profile";
import { sgEpCompassPolicy } from "./sg-ep-compass";

const asOf = "2026-11-27";
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
  }, asOf), asOf);
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

  it.each(["2024-09-01", "2026-11-25", asOf, "2027-11-26"])("does not score a renewal outside its current filing window (%s)", (expiry) => {
    expect(evaluate({
      ...zeroPoints, sgEpCompassShortRole: true, sgEpInitialApplication: false, sgEpRenewalOrdinary: true, sgEpRenewalExpiryDate: expiry,
    })).toMatchObject({ status: "conditions-not-applicable", scores: [] });
  });

  it("checks a renewal in its filing window and leaves an unknown type or expiry unresolved", () => {
    const answers = { ...zeroPoints, sgEpCompassShortRole: true, sgEpRenewalOrdinary: true };
    expect(evaluate({ ...answers, sgEpInitialApplication: false, sgEpRenewalExpiryDate: "2026-11-28" }).status).toBe("conditions-met");
    expect(evaluate({ ...answers, sgEpInitialApplication: false }).status).toBe("profile-incomplete");
    expect(evaluate({ ...answers, sgEpInitialApplication: undefined }).status).toBe("profile-incomplete");
  });

  it.each([
    [true, "conditions-met"],
    [false, "conditions-not-applicable"],
    [undefined, "profile-incomplete"],
  ])("requires ordinary pass confirmation before checking a 124-day renewal or exemption (%s)", (ordinary, status) => {
    const result = evaluate({
      ...zeroPoints,
      sgEpInitialApplication: false,
      sgEpRenewalOrdinary: ordinary,
      sgEpRenewalExpiryDate: "2027-03-31",
      sgEpFixedMonthlySalarySgd: 22_500,
    });
    expect(result.status).toBe(status);
    expect(result.checks.some(({ condition }) => condition.id === "sg-ep-renewal-window-opened")).toBe(ordinary === true);
    expect(result.scores).toHaveLength(ordinary === true ? 1 : 0);
  });

  it.each([false, undefined])("reports the deadline exclusion for sponsorship or an unknown type (%s)", (ordinary) => {
    const result = evaluate({
      sgEpInitialApplication: false,
      sgEpRenewalOrdinary: ordinary,
      sgEpRenewalExpiryDate: asOf,
      sgEpFixedMonthlySalarySgd: 22_500,
    });
    expect(result).toMatchObject({ status: "conditions-not-applicable", scores: [] });
    expect(result.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "sg-ep-renewal-before-deadline" }), status: "fail",
    }));
  });

  it("records separate MOM dates for new applications and existing passes", () => {
    const sourceFor = (id: string) => sgEpCompassPolicy.conditions.find((condition) => condition.id === id)?.source;
    expect(sourceFor("sg-ep-compass-new")?.effectiveFrom).toBe("2023-09-01");
    expect(sourceFor("sg-ep-compass-renewal")).toMatchObject({
      effectiveFrom: "2024-09-01",
      effectiveDateNote: { en: "Passes expiring from 1 September 2024" },
    });
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

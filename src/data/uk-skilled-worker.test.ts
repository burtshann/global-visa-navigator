import { describe, expect, it } from "vitest";
import { evaluatePathway, evaluatePolicy, type Profile } from "../domain/policy";
import { prepareMatchingProfile } from "./matching-profile";
import { ukSkilledWorkerPolicy as policy } from "./uk-skilled-worker";

const asOf = "2026-11-27";
const completeAnswers = {
  ukSkilledWorkerInitial: true,
  ukSkilledApplyingFromAbroad: false,
  ukSkilledAge: 18,
  ukSkilledJobCos: true,
  ukSkilledCosIssueInWindow: true,
  ukSkilledCosStartInWindow: true,
  ukSkilledCosUsable: true,
  ukSkilledAtasBasis: "not-required",
  ukSkilledStandardOption: true,
  ukSkilledSocCode: "2134",
  ukSkilledWeeklyHours: 37.5,
  ukSkilledAnnualPayGbp: 54_700,
  ukSkilledPayConfirmed: true,
  ukSkilledSponsorRated: true,
  ukSkilledEnglishBasis: "selt-b2",
};

function evaluate(answers: Profile["answers"] = completeAnswers) {
  return evaluatePolicy(policy, prepareMatchingProfile({ answers }), asOf);
}

describe("first-time UK Skilled Worker principal application check", () => {
  it("passes the checked conditions, leaving full eligibility unverified", () => {
    expect(evaluatePathway(policy, prepareMatchingProfile({ answers: completeAnswers, goal: "skilled-work" }), asOf, ["skilled-work"])).toMatchObject({
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

  it("fails the entry clearance requirement when the main applicant uses Afghan nationality", () => {
    const outcome = evaluate({
      ...completeAnswers, ukSkilledApplyingFromAbroad: true, ukSkilledUsingAfghanNationality: true,
    });
    expect(outcome.status).toBe("conditions-not-met");
    expect(outcome.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "uk-sw-entry-nationality" }), status: "fail",
    }));
  });

  it("does not apply the restriction in the UK or when using another nationality from abroad", () => {
    expect(evaluate({ ...completeAnswers, ukSkilledUsingAfghanNationality: true }).status).toBe("conditions-met");
    expect(evaluate({
      ...completeAnswers, ukSkilledApplyingFromAbroad: true, ukSkilledUsingAfghanNationality: false,
    }).status).toBe("conditions-met");
  });

  it("keeps the outcome incomplete for an unknown application location or an unknown nationality abroad", () => {
    expect(evaluate({ ...completeAnswers, ukSkilledApplyingFromAbroad: undefined }).status).toBe("profile-incomplete");
    const outcome = evaluate({ ...completeAnswers, ukSkilledApplyingFromAbroad: true });
    expect(outcome.status).toBe("profile-incomplete");
    expect(outcome.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "uk-sw-entry-nationality" }), status: "unknown",
    }));
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

describe("Option A and CoS evidence", () => {
  it.each(["ukSkilledCosIssueInWindow", "ukSkilledCosStartInWindow", "ukSkilledCosUsable"])(
    "distinguishes an unconfirmed CoS condition from a documented gap (%s)",
    (input) => {
      expect(evaluate({ ...completeAnswers, [input]: undefined }).status).toBe("profile-incomplete");
      expect(evaluate({ ...completeAnswers, [input]: false }).status).toBe("conditions-not-met");
    },
  );

  it("requires ATAS evidence only when it applies and does not infer an exemption", () => {
    expect(evaluate({ ...completeAnswers, ukSkilledAtasBasis: undefined }).status).toBe("profile-incomplete");
    expect(evaluate({ ...completeAnswers, ukSkilledAtasBasis: "required-missing" }).status).toBe("conditions-not-met");
    expect(evaluate({ ...completeAnswers, ukSkilledAtasBasis: "valid" }).status).toBe("conditions-met");
  });

  it.each([
    [{ ukSkilledSocCode: undefined }, "profile-incomplete"],
    [{ ukSkilledSocCode: "213" }, "profile-incomplete"],
    [{ ukSkilledSocCode: "6135" }, "conditions-not-applicable"],
    [{ ukSkilledStandardOption: undefined }, "profile-incomplete"],
    [{ ukSkilledStandardOption: false }, "conditions-not-applicable"],
  ])("separates uncertain inputs from cases outside standard Table 1 coverage (%j)", (answers, status) => {
    expect(evaluate({ ...completeAnswers, ...answers })).toMatchObject({ status, thresholds: [] });
  });

  it("requires confirmed sponsor pay and hours before issuing a salary finding", () => {
    for (const answers of [
      { ukSkilledPayConfirmed: false },
      { ukSkilledPayConfirmed: undefined },
      { ukSkilledAnnualPayGbp: undefined },
      { ukSkilledWeeklyHours: 0 },
      { ukSkilledWeeklyHours: 169 },
      { ukSkilledWeeklyHours: 37.501 },
    ]) {
      expect(evaluate({ ...completeAnswers, ...answers })).toMatchObject({
        status: "profile-incomplete",
        thresholds: [{ status: "unknown" }],
      });
    }
  });

  it.each([
    ["2134", 37.5, 54_699.99, "fail"],
    ["2134", 37.5, 54_700, "pass"],
    ["2134", 40, 58_346.66, "fail"],
    ["2134", 40, 58_346.67, "pass"],
  ])("checks the full Table 1 going rate at %s, %d hours, £%d", (code, hours, pay, status) => {
    expect(evaluate({
      ...completeAnswers, ukSkilledSocCode: code, ukSkilledWeeklyHours: hours, ukSkilledAnnualPayGbp: pay,
    }).thresholds).toMatchObject([{ status, minimum: 54_700 }]);
  });

  it("keeps the annual threshold absolute for part-time jobs", () => {
    const answers = { ...completeAnswers, ukSkilledWeeklyHours: 20, ukSkilledAnnualPayGbp: 41_700 };
    expect(evaluate(answers).status).toBe("conditions-met");
    expect(evaluate({ ...answers, ukSkilledAnnualPayGbp: 41_699.99 }).status).toBe("conditions-not-met");
  });

  it("caps the annual comparison at 48 weekly hours while using all hours for the going rate", () => {
    const profile = prepareMatchingProfile({
      answers: { ...completeAnswers, ukSkilledSocCode: "2142", ukSkilledWeeklyHours: 60, ukSkilledAnnualPayGbp: 46_800 },
    });
    expect(profile.answers?.ukSkilledCappedAnnualPayGbp).toBe(37_440);
    expect(evaluatePolicy(policy, profile, asOf)).toMatchObject({
      status: "conditions-not-met", thresholds: [{ minimum: 33_400, status: "fail" }],
    });
  });

  it("applies the £17.13 hourly floor independently of the displayed annual rates", () => {
    const answers = { ...completeAnswers, ukSkilledSocCode: "2142", ukSkilledWeeklyHours: 48 };
    const below = evaluate({ ...answers, ukSkilledAnnualPayGbp: 42_756.47 });
    expect(below.thresholds).toMatchObject([{ status: "pass" }]);
    expect(below.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "uk-sw-standard-hourly-floor" }), status: "fail",
    }));
    expect(evaluate({ ...answers, ukSkilledAnnualPayGbp: 42_756.48 }).status).toBe("conditions-met");
  });

  it("records the current salary edition and CoS issue window provenance", () => {
    const source = (id: string) => policy.conditions.find((condition) => condition.id === id)?.source;
    expect(source("uk-sw-standard-general-salary")).toMatchObject({
      effectiveFrom: "2025-07-22", effectiveDateUrl: expect.stringContaining("hc-997"), reviewStatus: "verified",
    });
    expect(source("uk-sw-cos-issue-window")).toMatchObject({
      effectiveFrom: "2025-04-09", effectiveDateUrl: expect.stringContaining("hc-733"),
    });
  });
});

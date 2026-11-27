import { describe, expect, it } from "vitest";
import { evaluatePolicy, policyInputs, type Profile } from "../domain/policy";
import { snapshotDigest } from "../server/policy-snapshots";
import { prepareMatchingProfile } from "./matching-profile";
import { sgEmploymentPassPolicies } from "./sg-employment-pass";

const [current, future, renewal] = sgEmploymentPassPolicies;
const currentAsOf = "2026-12-31";
const futureAsOf = "2027-01-01";
const defaultAnswers: Profile["answers"] = {
  sgEpInitialApplication: true,
  sgEpSingaporeJobOffer: true,
  sgEpAge: 30,
  sgEpFinancialSector: false,
  sgEpFixedMonthlySalarySgd: 7_223,
};

function profile(overrides: Profile["answers"] = {}): Profile {
  return { answers: { ...defaultAnswers, ...overrides } };
}

describe("Singapore Employment Pass Stage 1 salary", () => {
  it.each([
    { policy: current, date: currentAsOf, age: 22, financial: false, minimum: 5_600 },
    { policy: current, date: currentAsOf, age: 23, financial: true, minimum: 6_200 },
    { policy: current, date: currentAsOf, age: 24, financial: false, minimum: 5_832 },
    { policy: current, date: currentAsOf, age: 30, financial: false, minimum: 7_223 },
    { policy: current, date: currentAsOf, age: 30, financial: true, minimum: 7_982 },
    { policy: current, date: currentAsOf, age: 44, financial: true, minimum: 11_545 },
    { policy: current, date: currentAsOf, age: 45, financial: false, minimum: 10_700 },
    { policy: current, date: currentAsOf, age: 53, financial: true, minimum: 11_800 },
    { policy: future, date: futureAsOf, age: 23, financial: false, minimum: 6_000 },
    { policy: future, date: futureAsOf, age: 23, financial: true, minimum: 6_600 },
    { policy: future, date: futureAsOf, age: 24, financial: true, minimum: 6_877 },
    { policy: future, date: futureAsOf, age: 30, financial: false, minimum: 7_750 },
    { policy: future, date: futureAsOf, age: 30, financial: true, minimum: 8_541 },
    { policy: future, date: futureAsOf, age: 44, financial: false, minimum: 11_250 },
    { policy: future, date: futureAsOf, age: 45, financial: true, minimum: 12_700 },
    { policy: future, date: futureAsOf, age: 53, financial: false, minimum: 11_500 },
  ])("checks the published row on $date at age $age (financial: $financial)", ({ policy, date, age, financial, minimum }) => {
    const answers = { sgEpAge: age, sgEpFinancialSector: financial };
    expect(evaluatePolicy(policy, profile({ ...answers, sgEpFixedMonthlySalarySgd: minimum }), date)).toMatchObject({
      status: "conditions-met",
      thresholds: [{ status: "pass", minimum }],
    });
    expect(evaluatePolicy(policy, profile({ ...answers, sgEpFixedMonthlySalarySgd: minimum - 0.01 }), date)).toMatchObject({
      status: "conditions-not-met",
      thresholds: [{ status: "fail", minimum }],
    });
  });

  it("stops the old schedule and starts the new schedule on the Singapore filing date", () => {
    expect(evaluatePolicy(current, profile(), currentAsOf).status).toBe("conditions-met");
    expect(evaluatePolicy(future, profile(), currentAsOf).status).toBe("rules-not-covered");
    expect(evaluatePolicy(current, profile(), futureAsOf).status).toBe("rules-not-covered");
    expect(evaluatePolicy(future, profile(), futureAsOf).status).toBe("conditions-not-met");
  });

  it.each([
    { answer: { sgEpAge: undefined }, minimum: null },
    { answer: { sgEpAge: 30.5 }, minimum: null },
    { answer: { sgEpAge: -1 }, minimum: null },
    { answer: { sgEpAge: 121 }, minimum: null },
    { answer: { sgEpFinancialSector: undefined }, minimum: null },
    { answer: { sgEpFinancialSector: "false" }, minimum: null },
    { answer: { sgEpFixedMonthlySalarySgd: undefined }, minimum: 7_223 },
    { answer: { sgEpFixedMonthlySalarySgd: -1 }, minimum: 7_223 },
    { answer: { sgEpFixedMonthlySalarySgd: Infinity }, minimum: 7_223 },
  ])("returns unknown without deciding an unconfirmed input ($answer)", ({ answer, minimum }) => {
    expect(evaluatePolicy(current, profile(answer), currentAsOf)).toMatchObject({
      status: "profile-incomplete",
      thresholds: [{ status: "unknown", minimum }],
    });
  });

  it("checks only ordinary first applications and requires a Singapore offer", () => {
    expect(evaluatePolicy(current, profile({ sgEpInitialApplication: false }), currentAsOf)).toMatchObject({
      status: "conditions-not-applicable",
      thresholds: [],
    });
    expect(evaluatePolicy(current, profile({ sgEpSingaporeJobOffer: false }), currentAsOf).status).toBe("conditions-not-met");
    expect(evaluatePolicy(current, profile({ sgEpSingaporeJobOffer: undefined }), currentAsOf).status).toBe("profile-incomplete");
  });

  it("declares selector inputs and keeps every threshold amount in the reviewed snapshot", () => {
    expect(new Set(policyInputs(current))).toEqual(new Set([
      "answer:sgEpInitialApplication", "answer:sgEpSingaporeJobOffer", "answer:sgEpAge",
      "answer:sgEpFinancialSector", "answer:sgEpFixedMonthlySalarySgd",
    ]));
    const expression = current.expression;
    if (expression?.kind !== "when" || expression.requirement.kind !== "all") throw new Error("Expected a scoped salary table");
    const table = expression.requirement.children.find((child) => child.kind === "threshold-table");
    if (!table) throw new Error("Missing salary table");
    const [otherSectors, financialServices] = table.categories;
    const modifiedTable = {
      ...table,
      categories: [{ ...otherSectors, minimums: [0, ...otherSectors.minimums.slice(1)] }, financialServices],
    };
    const modifiedPolicy = {
      ...current,
      expression: {
        ...expression,
        requirement: {
          ...expression.requirement,
          children: expression.requirement.children.map((child) => child === table ? modifiedTable : child),
        },
      },
    };
    expect(snapshotDigest(modifiedPolicy)).not.toBe(snapshotDigest(current));
    expect(evaluatePolicy({ ...current, expression: { ...table, categories: [] } }, profile(), currentAsOf).status).toBe("rules-not-covered");
  });
});

describe("Singapore Employment Pass renewal salary", () => {
  function evaluateRenewal(answers: Profile["answers"], asOf = "2027-12-01") {
    return evaluatePolicy(renewal, prepareMatchingProfile(profile({
      sgEpInitialApplication: false,
      sgEpRenewalSameEmployerRole: true,
      ...answers,
    }), asOf), asOf);
  }

  it.each([
    ["2027-12-15", 23, false, 5_600],
    ["2027-12-31", 30, false, 7_223],
    ["2028-01-01", 30, false, 7_750],
    ["2027-12-31", 30, true, 7_982],
    ["2028-01-01", 30, true, 8_541],
    ["2028-02-29", 45, true, 12_700],
  ])("uses the published table for expiry %s, age %d, financial sector %s", (expiry, age, financial, minimum) => {
    const answers = { sgEpRenewalExpiryDate: expiry, sgEpAge: age, sgEpFinancialSector: financial };
    expect(evaluateRenewal({ ...answers, sgEpFixedMonthlySalarySgd: minimum })).toMatchObject({
      status: "conditions-met",
      thresholds: [{ minimum, status: "pass" }],
    });
    expect(evaluateRenewal({ ...answers, sgEpFixedMonthlySalarySgd: minimum - 0.01 })).toMatchObject({
      status: "conditions-not-met",
      thresholds: [{ minimum, status: "fail" }],
    });
  });

  it("keeps the same salary cutoff before and after the new-application switch", () => {
    const answers = { sgEpRenewalExpiryDate: "2027-06-27" };
    for (const asOf of ["2026-12-31", "2027-01-01"]) {
      expect(evaluateRenewal(answers, asOf)).toMatchObject({
        status: "conditions-met", thresholds: [{ minimum: 7_223 }],
      });
    }
  });

  it.each([undefined, "2028-02-30", "2028-2-01", 20280101])("leaves a missing or invalid expiry (%s) unresolved", (expiry) => {
    expect(evaluateRenewal({ sgEpRenewalExpiryDate: expiry })).toMatchObject({
      status: "profile-incomplete", thresholds: [],
    });
  });

  it("does not apply the renewal schedule to first applications", () => {
    expect(evaluateRenewal({ sgEpInitialApplication: true })).toMatchObject({
      status: "conditions-not-applicable", thresholds: [],
    });
  });

  it.each(["2025-12-31", "2026-10-01", "2026-11-27"])("rejects renewals where the pass expiry %s is today or in the past", (expiry) => {
    const result = evaluateRenewal({ sgEpRenewalExpiryDate: expiry, sgEpFixedMonthlySalarySgd: 22_500 }, "2026-11-27");
    expect(result).toMatchObject({ status: "conditions-not-met", thresholds: [] });
    expect(result.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "sg-ep-renewal-before-deadline" }), status: "fail",
    }));
  });

  it.each([
    ["2026-11-28", "conditions-met"],
    ["2027-05-26", "conditions-met"],
    ["2027-05-27", "conditions-not-met"],
  ])("uses the 180-day filing window for a pass expiring on %s", (expiry, status) => {
    expect(evaluateRenewal({ sgEpRenewalExpiryDate: expiry }, "2026-11-27").status).toBe(status);
  });

  it("distinguishes missing employer answers from a confirmed employer or salary gap", () => {
    const answers = { sgEpRenewalExpiryDate: "2027-12-31" };
    for (const overrides of [
      { sgEpRenewalSameEmployerRole: undefined },
      { sgEpFinancialSector: undefined },
      { sgEpFixedMonthlySalarySgd: 7_223.001 },
    ]) {
      expect(evaluateRenewal({ ...answers, ...overrides }).status).toBe("profile-incomplete");
    }
    expect(evaluateRenewal({ ...answers, sgEpRenewalSameEmployerRole: false }).status).toBe("conditions-not-met");
  });
});

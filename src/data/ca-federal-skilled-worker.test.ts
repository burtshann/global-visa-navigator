import { describe, expect, it } from "vitest";
import { evaluatePathway, evaluatePolicy, type Profile } from "../domain/policy";
import { caFederalSkilledWorkerPolicy, caFswAdaptability, caFswPartnerAdaptability } from "./ca-federal-skilled-worker";
import { prepareMatchingProfile } from "./matching-profile";

const date = "2026-11-28";
const atThreshold = {
  ...Object.fromEntries(caFswAdaptability.map(({ id }) => [id, false])),
  caFswOutsideQuebec: true,
  caFswAge: 30,
  caFswEducation: "three-plus",
  caFswFirstTest: true,
  caFswReading: 8,
  caFswWriting: 8,
  caFswListening: 8,
  caFswSpeaking: 7,
  caFswSecondLanguage: false,
  caFswPrimaryWork: true,
  caFswWorkYears: 6,
  caFswOffer: "none",
  caFswPartnerStatus: "no-partner",
  caFswFamilySize: 1,
  caFswFundsDocumentable: true,
  caFswFundsCad: 15_263,
};

function profile(changes: Profile["answers"] = {}) {
  return prepareMatchingProfile({
    goal: "skilled-migration", answers: { ...atThreshold, ...changes },
  });
}

function check(changes?: Profile["answers"], asOf = date) {
  return evaluatePolicy(caFederalSkilledWorkerPolicy, profile(changes), asOf);
}

describe("Canadian Federal Skilled Worker pre-pool checks", () => {
  it("meets the checked conditions at 67 without evaluating an invitation or full eligibility", () => {
    const result = evaluatePathway(caFederalSkilledWorkerPolicy, profile(), date, ["skilled-migration"]);
    expect(result.relevance).toBe("aligned");
    expect(result.fullEligibility).toBe("unverified");
    expect(result.outcome).toMatchObject({
      status: "conditions-met",
      scores: [{ minimum: 67, earned: 67, possible: 67, status: "pass" }],
    });
  });

  it("fails at 66 only when outstanding factors cannot reach 67", () => {
    expect(check({ caFswListening: 7 })).toMatchObject({
      status: "conditions-not-met",
      scores: [{ earned: 66, possible: 66, status: "fail" }],
    });
    expect(check({ caFswListening: 7, caFswSecondLanguage: undefined })).toMatchObject({
      status: "profile-incomplete",
      scores: [{ earned: 66, possible: 70, status: "unknown" }],
    });
    expect(check({ caFswOffer: "policy-pending" })).toMatchObject({
      status: "conditions-met",
      scores: [{ earned: 67, possible: 82, status: "pass" }],
    });
  });

  it("requires level 7 separately in all four skills, even with enough selection points", () => {
    expect(check({ caFswSpeaking: 6, caFswEducation: "doctoral", caFswSecondLanguage: true })).toMatchObject({
      status: "conditions-not-met", scores: [{ status: "pass" }],
    });
    expect(check({ caFswSpeaking: undefined, caFswEducation: "doctoral", caFswSecondLanguage: true })).toMatchObject({
      status: "profile-incomplete", scores: [{ status: "pass" }],
    });
    expect(check({ caFswFirstTest: false }).status).toBe("conditions-not-met");
  });

  it("distinguishes a known education or primary work gap from missing or conflicting evidence", () => {
    expect(check({ caFswEducation: "none" }).status).toBe("conditions-not-met");
    expect(check({ caFswEducation: "unrecognised-input" }).status).toBe("profile-incomplete");
    expect(check({ caFswPrimaryWork: false }).status).toBe("conditions-not-met");
    expect(check({ caFswPrimaryWork: true, caFswWorkYears: 0 }).status).toBe("profile-incomplete");
    expect(check({ caFswOutsideQuebec: false }).status).toBe("conditions-not-met");
  });

  it.each([[17, 55], [18, 67], [35, 67], [36, 66], [46, 56], [47, 55]])(
    "scores age %s according to the selection grid",
    (age, points) => {
      expect(check({ caFswAge: age }).scores?.[0]).toMatchObject({ earned: points, possible: points });
    },
  );

  it("caps the grid at 100 even when more than two adaptability facts are met", () => {
    const result = check({
      ...Object.fromEntries(caFswAdaptability.map(({ id }) => [id, true])),
      caFswEducation: "doctoral", caFswReading: 9, caFswWriting: 9, caFswListening: 9, caFswSpeaking: 9,
      caFswSecondLanguage: true, caFswOffer: "ordinary-exempt", caFswPartnerStatus: "eligible-accompanying",
    });
    expect(result.scores?.[0]).toMatchObject({ earned: 100, possible: 100 });
    expect(check({ caFswCanadianStudy: true, caFswCanadianRelative: true }).scores?.[0]).toMatchObject({ earned: 77, possible: 77 });
  });

  it.each([[1, 15_263], [7, 40_392], [8, 44_504], [9, 48_616]])(
    "checks family size %s at its CAD threshold",
    (familySize, minimum) => {
      expect(check({ caFswFamilySize: familySize, caFswFundsCad: minimum })).toMatchObject({
        status: "conditions-met", thresholds: [{ minimum, status: "pass" }],
      });
      expect(check({ caFswFamilySize: familySize, caFswFundsCad: minimum - 0.01 })).toMatchObject({
        status: "conditions-not-met", thresholds: [{ minimum, status: "fail" }],
      });
    },
  );

  it("allows the ordinary funds exemption and leaves an unverified exception unresolved", () => {
    const noFunds = { caFswFundsDocumentable: false, caFswFundsCad: 0 };
    expect(check({ ...noFunds, caFswOffer: "ordinary-exempt" }).status).toBe("conditions-met");
    expect(check({ ...noFunds, caFswOffer: "ordinary-points" }).status).toBe("conditions-not-met");
    expect(check({ ...noFunds, caFswOffer: "policy-pending" }).status).toBe("profile-incomplete");
  });

  it.each(caFswPartnerAdaptability.map(({ id }) => id))(
    "requires a consistent family count and valid partner status when %s is claimed",
    (id) => {
      const evidence = { caFswReading: 7, caFswWorkYears: 2, [id]: true };
      const eligible = { ...evidence, caFswPartnerStatus: "eligible-accompanying" };
      expect(check(eligible)).toMatchObject({
        status: "profile-incomplete", scores: [{ earned: 67, possible: 67 }],
        thresholds: [{ minimum: null, status: "unknown" }],
      });
      expect(check({ ...eligible, caFswFamilySize: 2, caFswFundsCad: 19_000.99 })).toMatchObject({
        status: "conditions-not-met", thresholds: [{ minimum: 19_001, status: "fail" }],
      });
      expect(check({ ...eligible, caFswFamilySize: 2, caFswFundsCad: 19_001 })).toMatchObject({
        status: "conditions-met", scores: [{ earned: 67, possible: 67 }],
        thresholds: [{ minimum: 19_001, status: "pass" }],
      });

      const ineligible = { ...evidence, caFswPartnerStatus: "other-partner" };
      expect(check(ineligible).thresholds?.[0]).toMatchObject({ minimum: null, status: "unknown" });
      expect(check({ ...ineligible, caFswFamilySize: 2, caFswFundsCad: 19_001 })).toMatchObject({
        status: "conditions-not-met", scores: [{ earned: 62, possible: 62 }],
        thresholds: [{ minimum: 19_001, status: "pass" }],
      });

      const unknown = { ...evidence, caFswPartnerStatus: undefined };
      expect(check(unknown).thresholds?.[0]).toMatchObject({ minimum: null, status: "unknown" });
      expect(check({ ...unknown, caFswFamilySize: 2, caFswFundsCad: 19_001 })).toMatchObject({
        status: "profile-incomplete", scores: [{ earned: 62, possible: 67 }],
        thresholds: [{ minimum: 19_001, status: "pass" }],
      });
      expect(check({ ...eligible, caFswOffer: "ordinary-exempt" })).toMatchObject({
        status: "conditions-met", thresholds: [{ minimum: null, status: "unknown" }],
      });
    },
  );

  it("includes a known partner in the funds check regardless of claimed adaptability points", () => {
    for (const caFswPartnerStatus of ["eligible-accompanying", "other-partner"]) {
      const withPartner = check({ caFswPartnerStatus });
      expect(withPartner).toMatchObject({
        status: "profile-incomplete", thresholds: [{ minimum: null, status: "unknown" }],
      });
    }
    expect(check({ caFswPartnerLanguage: true }).thresholds?.[0]).toMatchObject({ minimum: null, status: "unknown" });
  });

  const educationAndLanguage = {
    caFswEducation: "doctoral", caFswReading: 9, caFswWriting: 9, caFswListening: 9, caFswSpeaking: 9,
  };
  it("credits a confirmed primary work year without fixing the upper bound of a blank total", () => {
    expect(check({ ...educationAndLanguage, caFswWorkYears: undefined })).toMatchObject({
      status: "conditions-met", scores: [{ earned: 70, possible: 76 }],
    });
    expect(check({ ...educationAndLanguage, caFswWorkYears: 0 })).toMatchObject({
      status: "profile-incomplete", scores: [{ earned: 61, possible: 76 }],
    });
    expect(check({ ...educationAndLanguage, caFswPrimaryWork: false, caFswWorkYears: undefined })).toMatchObject({
      status: "conditions-not-met", scores: [{ earned: 61, possible: 76 }],
    });
  });

  it.each([[1, 70], [2, 72], [4, 74], [6, 76]])(
    "scores a confirmed total of %s qualifying years without double-counting the primary year",
    (caFswWorkYears, points) => {
      expect(check({ ...educationAndLanguage, caFswWorkYears }).scores?.[0]).toMatchObject({
        earned: points, possible: points,
      });
    },
  );

  it("withholds checks before the snapshot’s evidence verification date", () => {
    expect(check({}, "2026-11-27").status).toBe("rules-not-covered");
    expect(check({}, "2026-11-28").status).toBe("conditions-met");
  });
});

import { describe, expect, it } from "vitest";
import { evaluatePolicy, type Profile } from "../domain/policy";
import { routes } from "./catalog";
import { deOpportunityCardPointsPolicy } from "./de-opportunity-card";
import { deOpportunityCardScopedPolicies } from "./de-opportunity-card-scope";
import { prepareMatchingProfile } from "./matching-profile";
import { deOpportunityCardPolicy } from "./policies";

const [domestic, repeat, followUp] = deOpportunityCardScopedPolicies;
const completeFollowUp = {
  deCardCase: "follow-up", deFollowUpDuringSearch: true, deFollowUpQualifiedJob: true,
  deFollowUpAgencyConsent: true, deFollowUpNoOtherTitle: true,
};
const date = "2026-11-28";
const profile = (answers: Profile["answers"]) => prepareMatchingProfile({
  answers: { outsideEuEfta: true, deLivelihoodEvidence: true, ...answers },
});

describe("German Opportunity Card application scopes", () => {
  it("checks the domestic residence title and leaves it unknown if unconfirmed", () => {
    const answers = { deCardCase: "first-in-germany" };
    expect(evaluatePolicy(domestic, profile(answers), date).status).toBe("profile-incomplete");
    expect(evaluatePolicy(domestic, profile({ ...answers, deSection3Or4Title: false }), date).status).toBe("conditions-not-met");
    const confirmed = profile({ ...answers, deSection3Or4Title: true, deRecognizedQualification: true });
    expect(evaluatePolicy(domestic, confirmed, date).status).toBe("conditions-met");
    expect(evaluatePolicy(deOpportunityCardPolicy, confirmed, date).status).toBe("conditions-not-applicable");
    expect(evaluatePolicy(deOpportunityCardPointsPolicy, confirmed, date).status).toBe("conditions-not-applicable");
  });

  it("requires the repeat waiting period and any applicable in-country title", () => {
    const answers = { deCardCase: "repeat", deRepeatWaitConfirmed: true };
    expect(evaluatePolicy(repeat, profile(answers), date).status).toBe("profile-incomplete");
    expect(evaluatePolicy(repeat, profile({ ...answers, deRepeatInGermany: false }), date).status).toBe("conditions-met");
    expect(evaluatePolicy(repeat, profile({ ...answers, deRepeatWaitConfirmed: false, deRepeatInGermany: false }), date).status)
      .toBe("conditions-not-met");
    expect(evaluatePolicy(repeat, profile({ ...answers, deRepeatInGermany: true }), date).status).toBe("profile-incomplete");
    expect(evaluatePolicy(repeat, profile({ ...answers, deRepeatInGermany: true, deSection3Or4Title: false }), date).status)
      .toBe("conditions-not-met");
    expect(evaluatePolicy(repeat, profile({ ...answers, deRepeatInGermany: true, deSection3Or4Title: true }), date).status)
      .toBe("conditions-met");
  });

  it.each(["deFollowUpDuringSearch", "deFollowUpQualifiedJob", "deFollowUpAgencyConsent", "deFollowUpNoOtherTitle", "deLivelihoodEvidence"])(
    "requires %s for a first follow-up card",
    (key) => {
      expect(evaluatePolicy(followUp, profile(completeFollowUp), date).status).toBe("conditions-met");
      expect(evaluatePolicy(followUp, profile({ ...completeFollowUp, [key]: false }), date).status).toBe("conditions-not-met");
      expect(evaluatePolicy(followUp, profile({ ...completeFollowUp, [key]: undefined }), date).status).toBe("profile-incomplete");
    },
  );

  it("rejects a further extension under section 20a(5) independently of job facts", () => {
    const result = evaluatePolicy(followUp, profile({ deCardCase: "further-extension" }), date);
    expect(result.status).toBe("conditions-not-met");
    expect(result.checks).toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ id: "de-first-extension-only" }), status: "fail", role: "required",
    }));
  });

  it("keeps the 2026 amount out of later assessments and still checks the statutory scopes", () => {
    const germany = routes.find(({ id }) => id === "de-opportunity-card")!;
    expect(germany.policyTimeZone).toBe("Europe/Berlin");
    for (const year of ["2027", "2028"]) {
      const yearStart = `${year}-01-01`;
      expect(evaluatePolicy(deOpportunityCardPointsPolicy, profile({ deCardCase: "first-abroad" }), yearStart).coverageIssue)
        .toBe("unusable-version");
      const directFunds = profile({ deCardCase: "first-in-germany", deSection3Or4Title: true,
        deLivelihoodEvidence: undefined, deBlockedEurMonthly: 5000 });
      expect(evaluatePolicy(domestic, directFunds, yearStart).status).toBe("profile-incomplete");
      expect(evaluatePolicy(followUp, profile(completeFollowUp), yearStart).status).toBe("conditions-met");
    }
  });
});

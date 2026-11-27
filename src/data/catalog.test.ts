import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../domain/policy";
import { categoryLabels, countries, routes } from "./catalog";

const verifiedDate = "2026-11-27";

describe("published visa catalog", () => {
  it("covers all nine destinations and all five categories with official links", () => {
    expect(countries.map(({ id }) => id)).toEqual(["US", "CA", "GB", "DE", "AU", "NZ", "JP", "KR", "SG"]);
    expect(new Set(routes.map(({ id }) => id)).size).toBe(routes.length);
    expect(new Set(routes.map(({ countryId }) => countryId))).toEqual(new Set(countries.map(({ id }) => id)));
    expect(new Set(routes.map(({ category }) => category))).toEqual(new Set(Object.keys(categoryLabels)));

    for (const entry of [...countries, ...routes]) {
      expect(new URL(entry.officialUrl).protocol).toBe("https:");
      expect(entry.name.en.trim()).not.toBe("");
      expect(entry.name.zh.trim()).not.toBe("");
    }
  });

  it("publishes only source-verified, scoped application checks", () => {
    const current = routes.flatMap((route) => [route.policy, ...(route.policies ?? [])].flatMap((policy) => {
      if (!policy || evaluatePolicy(policy, {}, verifiedDate).status === "rules-not-covered") return [];
      expect(policy.scope ?? route.scope).toBeDefined();
      expect(policy.stage).toBe("application");
      expect(evaluatePolicy(policy, {}, verifiedDate).status).toBe("profile-incomplete");
      return policy.id;
    }));
    expect(current).toEqual([
      "uk-graduate", "de-opportunity-card-skilled-worker", "de-opportunity-card-points",
      "uk-skilled-worker-initial", "sg-ep-stage-1-2025", "sg-ep-stage-1-renewal", "sg-ep-stage-2-compass",
    ]);

    const singapore = routes.find(({ id }) => id === "sg-employment-pass");
    for (const date of ["2026-12-31", "2027-01-01"]) {
      const usable = singapore?.policies?.filter((policy) => evaluatePolicy(policy, {}, date).coverageIssue === null);
      expect(usable?.map(({ id }) => id)).toEqual([
        date === "2026-12-31" ? "sg-ep-stage-1-2025" : "sg-ep-stage-1-2027",
        "sg-ep-stage-1-renewal", "sg-ep-stage-2-compass",
      ]);
    }

    const directoryOnly = routes.find(({ id }) => id === "ca-express-entry");
    expect(evaluatePolicy(directoryOnly?.policy, {}, verifiedDate).status).toBe("rules-not-covered");
  });

  it("connects the UK and German questionnaire answers to their own conditions", () => {
    const profile = {
      answers: {
        inUk: true,
        ukCompletionReported: true,
        outsideEuEfta: true,
        deRecognizedQualification: false,
        deLivelihoodEvidence: true,
      },
    };
    const uk = evaluatePolicy(routes.find(({ id }) => id === "uk-graduate")?.policy, profile, verifiedDate);
    const de = evaluatePolicy(routes.find(({ id }) => id === "de-opportunity-card")?.policy, profile, verifiedDate);

    expect(uk.status).toBe("conditions-met");
    expect(de.status).toBe("conditions-not-met");
    expect(de.checks.filter(({ status }) => status === "fail").map(({ condition }) => condition.id)).toEqual([
      "de-oc-recognized-qualification",
    ]);
  });
});

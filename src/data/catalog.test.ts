import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../domain/policy";
import { categoryLabels, countries, routes } from "./catalog";

const verifiedDate = "2026-11-23";

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
    const withPolicies = routes.filter(({ policy }) => policy);
    expect(withPolicies.map(({ id }) => id)).toEqual(["uk-graduate", "de-opportunity-card"]);

    for (const route of withPolicies) {
      expect(route.scope).toBeDefined();
      expect(route.policy?.stage).toBe("application");
      expect(evaluatePolicy(route.policy, {}, verifiedDate).status).toBe("profile-incomplete");
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

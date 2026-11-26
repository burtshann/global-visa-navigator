import { assessmentDate } from "../data/assessment-date";
import { routes, type Route } from "../data/catalog";
import { evaluatePolicy, type Policy } from "../domain/policy";
import { loadPublishedRoutes } from "./published-policies";

export type Assessment = {
  availability: "available" | "unavailable";
  asOf: string;
  localDates: Readonly<Record<string, string>>;
  policies: Readonly<Partial<Record<string, Pick<Route, "policy" | "policies">>>>;
};

export async function loadAssessment(): Promise<Assessment> {
  const publication = await loadPublishedRoutes(routes);
  const now = new Date();
  const asOf = assessmentDate(now);
  const localDates: Record<string, string> = {};
  const policies: Record<string, Pick<Route, "policy" | "policies">> = {};

  for (const route of publication.routes) {
    const localDate = route.policyTimeZone ? assessmentDate(now, route.policyTimeZone) : asOf;
    if (route.policyTimeZone) localDates[route.id] = localDate;
    const isUsable = (policy: Policy) => evaluatePolicy(policy, {}, localDate).coverageIssue === null;
    const policy = route.policy && isUsable(route.policy) ? route.policy : undefined;
    const variants = route.policies?.filter(isUsable);
    if (policy || variants?.length) policies[route.id] = { policy, policies: variants };
  }

  return { availability: publication.availability, asOf, localDates, policies };
}

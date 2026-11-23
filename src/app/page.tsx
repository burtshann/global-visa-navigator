import { connection } from "next/server";
import { VisaNavigator } from "../components/visa-navigator";
import { assessmentDate } from "../data/assessment-date";
import { routes } from "../data/catalog";
import { evaluatePolicy, type Policy } from "../domain/policy";
import { loadPublishedRoutes } from "../server/published-policies";

export default async function Home() {
  await connection();
  const now = new Date();
  const asOf = assessmentDate(now);
  const publishedRoutes = await loadPublishedRoutes(routes);
  const localDates = Object.fromEntries(publishedRoutes.flatMap(({ id, policyTimeZone }) =>
    policyTimeZone ? [[id, assessmentDate(now, policyTimeZone)]] : [],
  ));
  const currentRoutes = publishedRoutes.map((route) => {
    const isUsable = (policy: Policy) => evaluatePolicy(policy, {}, localDates[route.id] ?? asOf).coverageIssue === null;
    return {
      ...route,
      policy: route.policy && isUsable(route.policy) ? route.policy : undefined,
      policies: route.policies?.filter(isUsable),
    };
  });
  return <VisaNavigator routes={currentRoutes} asOf={asOf} localDates={localDates} />;
}

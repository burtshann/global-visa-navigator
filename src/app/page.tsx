import { connection } from "next/server";
import { VisaNavigator } from "../components/visa-navigator";
import { routes } from "../data/catalog";
import { evaluatePolicy, type Policy } from "../domain/policy";
import { loadPublishedRoutes } from "../server/published-policies";

export default async function Home() {
  await connection();
  const asOf = new Date().toISOString().slice(0, 10);
  const publishedRoutes = await loadPublishedRoutes(routes);
  const isUsable = (policy: Policy) => evaluatePolicy(policy, {}, asOf).coverageIssue === null;
  const currentRoutes = publishedRoutes.map((route) => ({
    ...route,
    policy: route.policy && isUsable(route.policy) ? route.policy : undefined,
    policies: route.policies?.filter(isUsable),
  }));
  return <VisaNavigator routes={currentRoutes} asOf={asOf} />;
}

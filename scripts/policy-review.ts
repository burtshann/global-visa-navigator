import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { isPolicyDatabaseUrl } from "../src/server/policy-database";
import { changePolicyPublication, listPolicyPublications, stagePolicy } from "../src/server/policy-publications";
import { routePolicies } from "../src/server/policy-snapshots";

const usage = `Usage:
  npm run policy:review -- list
  npm run policy:review -- stage <route-id> <policy-id> <reference>
  npm run policy:review -- approve <route-id> <policy-id> <version> <reference>
  npm run policy:review -- withdraw <route-id> <policy-id> <version> <reference>`;

function gitRevision() {
  const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const revision = git(["rev-parse", "HEAD"]);
  const dirty = git(["status", "--porcelain", "--untracked-files=all", "--", "src/data", "src/domain"]);
  if (dirty) throw new Error("Commit policy data and domain changes before staging a policy snapshot.");
  return revision;
}

async function stage(pool: Pool, routeId: string, policyId: string, reference: string) {
  const revision = gitRevision();
  const { countries, routes } = await import("../src/data/catalog");
  if (gitRevision() !== revision) throw new Error("The Git revision changed while loading the policy snapshot.");
  const route = routes.find((item) => item.id === routeId);
  if (!route) throw new Error("Unknown route.");
  const country = countries.find((item) => item.id === route.countryId);
  const policies = routePolicies(route).filter((item) => item.id === policyId);
  if (!country || policies.length !== 1) throw new Error("Expected exactly one policy in the route's Git snapshot.");
  return stagePolicy(pool, country, route, policies[0], revision, reference);
}

async function main() {
  const [action, ...args] = process.argv.slice(2).map((argument) => argument.trim());
  const actions = { list: 0, stage: 3, approve: 4, withdraw: 4 };
  if (!Object.hasOwn(actions, action) || args.length !== actions[action as keyof typeof actions] || args.some((arg) => !arg)) {
    throw new Error(usage);
  }
  const connectionString = process.env.POLICY_EDITOR_DATABASE_URL;
  if (!connectionString || !isPolicyDatabaseUrl(connectionString)) {
    throw new Error("Set POLICY_EDITOR_DATABASE_URL to a named stager or reviewer PostgreSQL login. Remote connections require sslmode=verify-full.");
  }

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  try {
    if (action === "list") {
      console.log(JSON.stringify(await listPolicyPublications(pool), null, 2));
    } else if (action === "stage") {
      const [routeId, policyId, reference] = args;
      console.log(JSON.stringify(await stage(pool, routeId, policyId, reference), null, 2));
    } else if (action === "approve" || action === "withdraw") {
      const [routeId, policyId, version, reference] = args;
      console.log(JSON.stringify(await changePolicyPublication(pool, action, routeId, policyId, version, reference), null, 2));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Policy review command failed.");
  process.exitCode = 1;
});

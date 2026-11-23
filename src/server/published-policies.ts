import { Pool } from "pg";
import type { Route } from "../data/catalog";
import type { Policy } from "../domain/policy";
import { snapshotDigest } from "./policy-snapshots";

type PublishedPolicy = {
  route_id: string;
  policy_key: string;
  stage: string;
  version: string;
  snapshot_sha256: string;
  rule_snapshot: unknown;
};

type PolicyEnvironment = {
  DATABASE_URL?: string;
  NODE_ENV?: string;
  POLICY_SOURCE?: string;
};

const approvedSnapshots = `
  SELECT route_id, policy_key, stage, version, snapshot_sha256, rule_snapshot
  FROM policy_version
  WHERE review_status = 'approved' AND rule_snapshot IS NOT NULL
`;

function key(routeId: string, policyId: string, stage: string, version: string): string {
  return JSON.stringify([routeId, policyId, stage, version]);
}

export function resolvePublishedRoutes(
  routes: readonly Route[],
  published: readonly PublishedPolicy[],
): readonly Route[] {
  const approved = new Map(
    published.map((row) => [key(row.route_id, row.policy_key, row.stage, row.version), row]),
  );

  return routes.map((route) => {
    const isApproved = (policy: Policy) => {
      const row = approved.get(key(route.id, policy.id, policy.stage, policy.version));
      return row !== undefined
        && row.snapshot_sha256 === snapshotDigest(policy)
        && row.snapshot_sha256 === snapshotDigest(row.rule_snapshot);
    };

    return {
      ...route,
      policy: route.policy && isApproved(route.policy) ? route.policy : undefined,
      policies: route.policies?.filter(isApproved),
    };
  });
}

let database: { url: string; pool: Pool } | undefined;

function publicationPool(url: string): Pool {
  if (database?.url === url) return database.pool;

  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 3_000,
    query_timeout: 3_000,
  });
  pool.on("error", () => console.error("Policy database idle connection failed."));
  database = { url, pool };
  return pool;
}

/** Use PostgreSQL for publication decisions and the identical deployed Git snapshot for evaluation. */
export async function loadPublishedRoutes(
  routes: readonly Route[],
  environment: PolicyEnvironment = process.env,
): Promise<readonly Route[]> {
  if (environment.DATABASE_URL) {
    try {
      const { rows } = await publicationPool(environment.DATABASE_URL).query<PublishedPolicy>(approvedSnapshots);
      return resolvePublishedRoutes(routes, rows);
    } catch {
      console.error("Approved policy snapshots could not be loaded. Showing directory only.");
      return resolvePublishedRoutes(routes, []);
    }
  }

  if (
    environment.POLICY_SOURCE === "snapshot"
    || environment.NODE_ENV === "development"
    || environment.NODE_ENV === "test"
  ) {
    return routes;
  }

  return resolvePublishedRoutes(routes, []);
}

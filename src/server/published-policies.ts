import { Pool } from "pg";
import type { Route } from "../data/catalog";
import type { Policy } from "../domain/policy";
import { isPolicyDatabaseUrl } from "./policy-database";
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
  POLICY_DATABASE_URL?: string;
  NODE_ENV?: string;
};

type PublishedRoutes = {
  availability: "available" | "unavailable";
  routes: readonly Route[];
};

const approvedSnapshots = `
  SELECT route_id, policy_key, stage, version, snapshot_sha256, rule_snapshot
  FROM public.gvn_approved_policy_snapshot
  WHERE pg_has_role(SESSION_USER, 'gvn_policy_reader', 'USAGE')
    AND NOT pg_has_role(SESSION_USER, 'gvn_policy_stager', 'MEMBER')
    AND NOT pg_has_role(SESSION_USER, 'gvn_policy_reviewer', 'MEMBER')
    AND NOT EXISTS (
      SELECT FROM unnest(ARRAY[
        'public.country', 'public.visa_route', 'public.official_source', 'public.policy_version',
        'public.policy_condition', 'public.policy_publication_event', 'public.source_observation', 'public.source_review',
        'public.gvn_policy_review_queue'
      ]) AS private_table(name)
      WHERE has_table_privilege(SESSION_USER, name, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
         OR has_any_column_privilege(SESSION_USER, name, 'SELECT, INSERT, UPDATE, REFERENCES')
    )
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

export async function readPublishedRoutes(routes: readonly Route[], pool: Pool): Promise<readonly Route[]> {
  const { rows } = await pool.query<PublishedPolicy>(approvedSnapshots);
  return resolvePublishedRoutes(routes, rows);
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
): Promise<PublishedRoutes> {
  if (environment.POLICY_DATABASE_URL) {
    if (!isPolicyDatabaseUrl(environment.POLICY_DATABASE_URL)) {
      console.error("Policy database URL must use a named reader login and verified TLS for remote connections. Showing directory only.");
      return { availability: "unavailable", routes: resolvePublishedRoutes(routes, []) };
    }
    try {
      const published = await readPublishedRoutes(routes, publicationPool(environment.POLICY_DATABASE_URL));
      return { availability: "available", routes: published };
    } catch {
      console.error("Approved policy snapshots could not be loaded. Showing directory only.");
      return { availability: "unavailable", routes: resolvePublishedRoutes(routes, []) };
    }
  }

  if (environment.NODE_ENV === "development" || environment.NODE_ENV === "test") {
    return { availability: "available", routes };
  }

  return { availability: "available", routes: resolvePublishedRoutes(routes, []) };
}

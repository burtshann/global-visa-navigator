import type { Pool } from "pg";
import type { Country, Route } from "../data/catalog";
import type { Policy, PolicyStage } from "../domain/policy";
import { snapshotDigest } from "./policy-snapshots";

type PublicationRow = {
  id: string;
  route_id: string;
  policy_key: string;
  version: string;
  stage: PolicyStage;
  review_status: "pending" | "approved" | "withdrawn" | "retired";
  git_revision: string | null;
  snapshot_sha256: string;
  staged_by: string | null;
};
type StagedPublication = PublicationRow & { rule_snapshot: unknown };

const columns = "id, route_id, policy_key, version, stage, review_status, git_revision, snapshot_sha256, staged_by";

export async function stagePolicy(
  pool: Pool,
  country: Country,
  route: Route,
  policy: Policy,
  gitRevision: string,
  reference: string,
): Promise<PublicationRow> {
  const { rows } = await pool.query<PublicationRow>(
    `SELECT ${columns} FROM public.gvn_stage_policy($1::jsonb, $2::jsonb, $3::jsonb, $4, $5, $6)`,
    [JSON.stringify(country), JSON.stringify(route), JSON.stringify(policy), gitRevision, snapshotDigest(policy), reference],
  );
  return rows[0];
}

export async function changePolicyPublication(
  pool: Pool,
  action: "approve" | "withdraw",
  routeId: string,
  policyId: string,
  version: string,
  reference: string,
): Promise<PublicationRow> {
  const { rows } = await pool.query<StagedPublication>(
    `SELECT ${columns}, rule_snapshot FROM public.gvn_policy_review_queue
     WHERE route_id = $1 AND policy_key = $2 AND version = $3`,
    [routeId, policyId, version],
  );
  if (rows.length !== 1) throw new Error("Expected exactly one staged snapshot for this route, policy and version.");
  const target = rows[0];
  if (action === "approve" && snapshotDigest(target.rule_snapshot) !== target.snapshot_sha256) {
    throw new Error("The stored snapshot does not match its staged digest.");
  }

  const updated = await pool.query<PublicationRow>(
    `SELECT ${columns} FROM public.gvn_review_policy($1, $2, $3, $4)`,
    [action, target.id, target.snapshot_sha256, reference],
  );
  return updated.rows[0];
}

export async function listPolicyPublications(pool: Pool): Promise<readonly PublicationRow[]> {
  const { rows } = await pool.query<PublicationRow>(
    `SELECT ${columns} FROM public.gvn_policy_review_queue ORDER BY route_id, policy_key, created_at, id`,
  );
  return rows;
}

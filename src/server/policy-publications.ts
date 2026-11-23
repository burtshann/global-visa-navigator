import type { Pool, PoolClient } from "pg";
import type { Country, Route } from "../data/catalog";
import type { Condition, Policy, PolicyStage } from "../domain/policy";
import { snapshotDigest } from "./policy-snapshots";

type PublicationState = "pending" | "approved" | "withdrawn" | "retired";
type Reviewer = { name: string; reference: string };
type PublicationRow = {
  id: string;
  route_id: string;
  policy_key: string;
  version: string;
  stage: PolicyStage;
  review_status: PublicationState;
  git_revision: string | null;
  snapshot_sha256: string | null;
};
type StagedPublication = PublicationRow & { rule_snapshot: unknown };

const publicationColumns = "id, route_id, policy_key, version, stage, review_status, git_revision, snapshot_sha256";

async function transaction<Result>(
  pool: Pool,
  mutate: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    const result = await mutate(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

async function updateDirectory(client: PoolClient, country: Country, route: Route) {
  await client.query(
    `INSERT INTO country (id, name_en, name_zh, official_url) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET name_en = EXCLUDED.name_en, name_zh = EXCLUDED.name_zh, official_url = EXCLUDED.official_url`,
    [country.id, country.name.en, country.name.zh, country.officialUrl],
  );
  // The route row is also the lock shared by stage, approve and withdraw.
  await client.query(
    `INSERT INTO visa_route
       (id, country_id, category, name_en, name_zh, description_en, description_zh, official_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE
     SET country_id = EXCLUDED.country_id, category = EXCLUDED.category,
         name_en = EXCLUDED.name_en, name_zh = EXCLUDED.name_zh,
         description_en = EXCLUDED.description_en, description_zh = EXCLUDED.description_zh,
         official_url = EXCLUDED.official_url`,
    [route.id, route.countryId, route.category, route.name.en, route.name.zh,
      route.description.en, route.description.zh, route.officialUrl],
  );
}

async function insertCondition(
  client: PoolClient,
  countryId: string,
  publicationId: string,
  condition: Condition,
  position: number,
) {
  const { source } = condition;
  const publisher = new URL(source.url).hostname;
  await client.query(
    `INSERT INTO official_source (id, country_id, url, publisher, title)
     VALUES ($1, $2, $3, $4, $3)
     ON CONFLICT (url) DO NOTHING`,
    [`url-${snapshotDigest(source.url)}`, countryId, source.url, publisher],
  );
  const verifiedAt = source.lastVerifiedAt?.length === 10
    ? `${source.lastVerifiedAt}T00:00:00Z`
    : source.lastVerifiedAt;
  await client.query(
    `INSERT INTO policy_condition
       (policy_version_id, condition_key, position, input_key, operator, expected_value,
        label_en, label_zh, next_step_en, next_step_zh, source_id, applicable_when_en,
        applicable_when_zh, effective_from, effective_until, last_verified_at, review_status)
     VALUES
       ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10,
        (SELECT id FROM official_source WHERE url = $11), $12, $13, $14, $15, $16, $17)`,
    [
      publicationId, condition.id, position, condition.input, condition.operator,
      JSON.stringify(condition.expected), condition.label.en, condition.label.zh,
      condition.nextStep.en, condition.nextStep.zh, source.url, source.applicableWhen.en,
      source.applicableWhen.zh, source.effectiveFrom, source.effectiveUntil ?? null,
      verifiedAt, source.reviewStatus,
    ],
  );
}

async function recordEvent(
  client: PoolClient,
  publicationId: string,
  from: "pending" | "approved" | null,
  to: "pending" | "approved" | "withdrawn",
  reviewer: Reviewer,
) {
  await client.query(
    `INSERT INTO policy_publication_event
       (policy_version_id, from_status, to_status, reviewer, review_reference)
     VALUES ($1, $2, $3, $4, $5)`,
    [publicationId, from, to, reviewer.name, reviewer.reference],
  );
}

export async function stagePolicy(
  pool: Pool,
  country: Country,
  route: Route,
  policy: Policy,
  gitRevision: string,
  reviewer: Reviewer,
): Promise<PublicationRow> {
  return transaction(pool, async (client) => {
    await updateDirectory(client, country, route);
    const lookup = [route.id, policy.id, policy.version, policy.stage];
    const snapshotHash = snapshotDigest(policy);
    const scope = policy.scope ?? route.scope ?? route.description;
    const { rows } = await client.query<PublicationRow>(
      `INSERT INTO policy_version
         (route_id, policy_key, version, stage, scope_en, scope_zh, git_revision, snapshot_sha256, rule_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (route_id, policy_key, stage, version) DO NOTHING
       RETURNING ${publicationColumns}`,
      [...lookup, scope.en, scope.zh, gitRevision, snapshotHash, JSON.stringify(policy)],
    );
    const inserted = rows[0];
    if (inserted) {
      for (const [index, condition] of policy.conditions.entries()) {
        await insertCondition(client, country.id, inserted.id, condition, index + 1);
      }
      await recordEvent(client, inserted.id, null, "pending", reviewer);
      return inserted;
    }

    const { rows: existingRows } = await client.query<PublicationRow>(
      `SELECT ${publicationColumns} FROM policy_version
       WHERE route_id = $1 AND policy_key = $2 AND version = $3 AND stage = $4`,
      lookup,
    );
    const existing = existingRows[0];
    if (existing?.snapshot_sha256 !== snapshotHash) {
      throw new Error("This policy version already exists with another snapshot. Assign a new version.");
    }
    return existing;
  });
}

export async function changePolicyPublication(
  pool: Pool,
  action: "approve" | "withdraw",
  routeId: string,
  policyId: string,
  version: string,
  reviewer: Reviewer,
): Promise<PublicationRow> {
  return transaction(pool, async (client) => {
    await client.query("SELECT id FROM visa_route WHERE id = $1 FOR UPDATE", [routeId]);
    const lookup = [routeId, policyId, version];
    const { rows } = await client.query<StagedPublication>(
      `SELECT ${publicationColumns}, rule_snapshot FROM policy_version
       WHERE route_id = $1 AND policy_key = $2 AND version = $3 AND rule_snapshot IS NOT NULL`,
      lookup,
    );
    if (rows.length !== 1) throw new Error("Expected exactly one staged snapshot for this route, policy and version.");
    const { rule_snapshot, ...target } = rows[0];

    if (action === "withdraw") {
      if (target.review_status === "withdrawn") return target;
      if (target.review_status !== "pending" && target.review_status !== "approved") {
        throw new Error("Only a pending or approved policy can be withdrawn.");
      }
      await client.query("UPDATE policy_version SET review_status = 'withdrawn' WHERE id = $1", [target.id]);
      await recordEvent(client, target.id, target.review_status, "withdrawn", reviewer);
      return { ...target, review_status: "withdrawn" };
    }

    if (snapshotDigest(rule_snapshot) !== target.snapshot_sha256) {
      throw new Error("The stored snapshot does not match its staged digest.");
    }
    if (target.review_status === "approved") return target;
    if (target.review_status !== "pending") throw new Error("Only a pending policy can be approved.");

    const superseded = await client.query<{ id: string }>(
      `UPDATE policy_version SET review_status = 'withdrawn'
       WHERE route_id = $1 AND policy_key = $2 AND stage = $3 AND review_status = 'approved'
       RETURNING id`,
      [routeId, policyId, target.stage],
    );
    for (const { id } of superseded.rows) {
      await recordEvent(client, id, "approved", "withdrawn", reviewer);
    }
    await client.query(
      `UPDATE policy_version SET review_status = 'approved', reviewed_at = CURRENT_TIMESTAMP,
         reviewed_by = $2, review_reference = $3 WHERE id = $1`,
      [target.id, reviewer.name, reviewer.reference],
    );
    await recordEvent(client, target.id, "pending", "approved", reviewer);
    return { ...target, review_status: "approved" };
  });
}

export async function listPolicyPublications(pool: Pool): Promise<readonly PublicationRow[]> {
  const { rows } = await pool.query<PublicationRow>(
    `SELECT ${publicationColumns} FROM policy_version
     WHERE rule_snapshot IS NOT NULL ORDER BY route_id, policy_key, created_at, id`,
  );
  return rows;
}

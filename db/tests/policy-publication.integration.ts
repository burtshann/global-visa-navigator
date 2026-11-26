import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { countries, routes, type Route } from "../../src/data/catalog";
import { changePolicyPublication, stagePolicy } from "../../src/server/policy-publications";
import { routePolicies, snapshotDigest } from "../../src/server/policy-snapshots";
import { readPublishedRoutes } from "../../src/server/published-policies";

const policies = routes.flatMap((route) => routePolicies(route).map((policy) => ({ route, policy })));
const legacyVersions = new Map([
  ["uk-graduate", "2026-11-23.1"],
  ["de-opportunity-card-skilled-worker", "2026-11-23.2"],
  ["de-opportunity-card-points", "2026-11-23.2"],
]);
const legacyRevision = "825644be9c7e0ea84377de2b4882c282438e2319";
const testRevision = "a".repeat(40);
const testReference = "isolated publication integration test";
const runId = randomBytes(6).toString("hex");
const actorPassword = randomBytes(24).toString("hex");
const actors = {
  reader: "gvn_test_reader_" + runId,
  stager: "gvn_test_stager_" + runId,
  reviewer: "gvn_test_reviewer_" + runId,
};

async function runSql(pool: Pool, path: string) {
  await pool.query(await readFile(path, "utf8")).catch((cause: unknown) => {
    throw new Error("Failed to run " + path, { cause });
  });
}

function countryOf(route: Route) {
  const country = countries.find(({ id }) => id === route.countryId);
  assert.ok(country);
  return country;
}

function visibleVersions(catalog: readonly Route[]) {
  return catalog.flatMap((route) => routePolicies(route).map(({ id, version }) => id + "@" + version)).sort();
}

async function seedM2Approvals(pool: Pool) {
  let seeded = 0;
  for (const { route, policy } of policies) {
    const version = legacyVersions.get(policy.id);
    if (!version) continue;
    const country = countryOf(route);
    const snapshot = { ...policy, version };
    const scope = policy.scope ?? route.scope ?? route.description;
    await pool.query(
      "INSERT INTO country VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
      [country.id, country.name.en, country.name.zh, country.officialUrl],
    );
    await pool.query(
      "INSERT INTO visa_route VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING",
      [route.id, country.id, route.category, route.name.en, route.name.zh, route.description.en, route.description.zh, route.officialUrl],
    );
    const { rows: [row] } = await pool.query<{ id: string }>(
      "INSERT INTO policy_version (route_id, policy_key, version, stage, scope_en, scope_zh, git_revision, snapshot_sha256, rule_snapshot) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
      [route.id, policy.id, version, policy.stage, scope.en, scope.zh, legacyRevision, snapshotDigest(snapshot), JSON.stringify(snapshot)],
    );
    await pool.query(
      "UPDATE policy_version SET review_status = 'approved', reviewed_at = CURRENT_TIMESTAMP, " +
      "reviewed_by = 'm2-reviewer', review_reference = $2 WHERE id = $1",
      [row.id, testReference],
    );
    await pool.query(
      "INSERT INTO policy_publication_event (policy_version_id, from_status, to_status, reviewer, review_reference) VALUES " +
      "($1, NULL, 'pending', 'm2-stager', $2), ($1, 'pending', 'approved', 'm2-reviewer', $2)",
      [row.id, testReference],
    );
    seeded += 1;
  }
  assert.equal(seeded, legacyVersions.size);
  const { rows } = await pool.query<{ version: string }>("SELECT version FROM policy_version WHERE review_status = 'approved'");
  assert.equal(rows.length, legacyVersions.size);
}

async function exercisePublication(reader: Pool, stager: Pool, reviewer: Pool, upgraded: boolean) {
  const published = async () => visibleVersions(await readPublishedRoutes(routes, reader));
  assert.deepEqual(await published(), [], "Fresh/legacy approvals must not be visible before independent review");

  for (const { route, policy } of policies) {
    const country = countryOf(route);
    const legacyVersion = legacyVersions.get(policy.id);
    if (upgraded && legacyVersion) {
      assert.notEqual(policy.version, legacyVersion);
      await assert.rejects(
        stagePolicy(stager, country, route, { ...policy, version: legacyVersion }, testRevision, testReference),
        /Assign a new version/,
      );
    }
    assert.equal((await stagePolicy(stager, country, route, policy, testRevision, testReference)).review_status, "pending");
  }
  assert.deepEqual(await published(), [], "Pending works must not be visible");

  for (const { route, policy } of policies) {
    const approved = await changePolicyPublication(reviewer, "approve", route.id, policy.id, policy.version, testReference);
    assert.equal(approved.review_status, "approved");
  }
  assert.deepEqual(await published(), visibleVersions(routes), "Production reader must see the exact approved Git snapshots");

  for (const { route, policy } of policies) {
    const withdrawn = await changePolicyPublication(reviewer, "withdraw", route.id, policy.id, policy.version, testReference);
    assert.equal(withdrawn.review_status, "withdrawn");
  }
  assert.deepEqual(await published(), [], "Withdrawal must remove approved snapshots without reviving legacy versions");
}

async function runScenario(admin: Pool, server: URL, upgraded: boolean) {
  const scenario = upgraded ? "upgrade" : "fresh";
  const database = "gvn_test_" + scenario + "_" + runId;
  await admin.query("CREATE DATABASE " + database);
  const url = new URL(server);
  url.pathname = "/" + database;
  const owner = new Pool({ connectionString: url.href });
  const actorPool = (actor: string) => {
    const login = new URL(url);
    login.username = actor;
    login.password = actorPassword;
    return new Pool({ connectionString: login.href });
  };
  const reader = actorPool(actors.reader);
  const stager = actorPool(actors.stager);
  const reviewer = actorPool(actors.reviewer);
  try {
    await runSql(owner, "db/migrations/001_policy.sql");
    await runSql(owner, "db/migrations/002_policy_publication.sql");
    if (upgraded) await seedM2Approvals(owner);
    await runSql(owner, "db/migrations/003_policy_permissions.sql");
    if (!upgraded) {
      for (const file of ["001_policy_smoke.sql", "002_policy_publication_smoke.sql", "003_policy_permissions_smoke.sql"]) {
        await runSql(owner, "db/tests/" + file);
        console.log("Passed DB smoke test " + file);
      }
      await admin.query(Object.entries(actors).map(([group, role]) =>
        "CREATE ROLE " + role + " LOGIN PASSWORD '" + actorPassword + "' IN ROLE gvn_policy_" + group,
      ).join("; "));
    }
    await exercisePublication(reader, stager, reviewer, upgraded);
    console.log("Passed PostgreSQL " + scenario + " publication: separate staging, approval, production read and withdrawal.");
  } finally {
    await Promise.all([owner.end(), reader.end(), stager.end(), reviewer.end()]);
    await admin.query("DROP DATABASE " + database);
  }
}

async function main() {
  const server = new URL(process.env.POLICY_TEST_ADMIN_URL ?? "");
  assert.ok(["postgres:", "postgresql:"].includes(server.protocol) &&
    ["127.0.0.1", "localhost", "[::1]"].includes(server.hostname) && server.pathname === "/postgres",
  "Set POLICY_TEST_ADMIN_URL to the postgres database of a disposable local PostgreSQL server.");
  const admin = new Pool({ connectionString: server.href, connectionTimeoutMillis: 5_000 });
  try {
    await runScenario(admin, server, false);
    await runScenario(admin, server, true);
  } finally {
    try {
      await admin.query("DROP ROLE IF EXISTS " + Object.values(actors).join(", "));
    } finally {
      await admin.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

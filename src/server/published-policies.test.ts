import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import type { Route } from "../data/catalog";
import type { Policy } from "../domain/policy";
import { snapshotDigest } from "./policy-snapshots";
import { loadPublishedRoutes, resolvePublishedRoutes } from "./published-policies";

const copy = { en: "Fixture", zh: "测试" };
const policy = {
  id: "fixture-policy",
  version: "1",
  stage: "application",
  conditions: [],
} satisfies Policy;
const additional = { ...policy, id: "fixture-alternative" };
const route = {
  id: "fixture-route",
  countryId: "DE",
  name: copy,
  description: copy,
  category: "job-search",
  officialUrl: "https://example.test",
  policy,
  policies: [additional],
} satisfies Route;

function approvedRow(snapshot: Policy) {
  return {
    route_id: route.id,
    policy_key: snapshot.id,
    version: snapshot.version,
    stage: snapshot.stage,
    rule_snapshot: snapshot,
    snapshot_sha256: snapshotDigest(snapshot),
  };
}

describe("policy publication", () => {
  it("preserves the information directory while exposing only the approved track", () => {
    const [visible] = resolvePublishedRoutes([route], [approvedRow(additional)]);
    expect(visible.name).toBe(route.name);
    expect(visible.policy).toBeUndefined();
    expect(visible.policies).toEqual([additional]);
  });

  it("withholds a status row from another stage or version", () => {
    const [visible] = resolvePublishedRoutes([route], [
      { ...approvedRow(policy), stage: "approval" },
      { ...approvedRow(additional), version: "other" },
    ]);
    expect(visible.policy).toBeUndefined();
    expect(visible.policies).toEqual([]);
  });

  it("withholds approvals if the stored payload or deployed Git snapshot changed", () => {
    const [visible] = resolvePublishedRoutes([route], [
      { ...approvedRow(policy), rule_snapshot: { ...policy, name: copy } },
      approvedRow({ ...additional, scope: copy }),
    ]);
    expect(visible.policy).toBeUndefined();
    expect(visible.policies).toEqual([]);
  });

  it("covers point thresholds and expression contents with the snapshot digest", () => {
    const scored = {
      ...policy,
      expression: {
        kind: "points",
        id: "fixture-score",
        label: copy,
        nextStep: copy,
        minimum: 6,
        source: {
          url: route.officialUrl, applicableWhen: copy,
          effectiveFrom: null, lastVerifiedAt: null, reviewStatus: "pending",
        },
        categories: [],
      },
    } satisfies Policy;
    const altered = { ...scored, expression: { ...scored.expression, minimum: 5 } };
    const bundle = { ...route, policy: scored };
    expect(resolvePublishedRoutes([bundle], [approvedRow(scored)])[0].policy).toBe(scored);
    expect(resolvePublishedRoutes([bundle], [{ ...approvedRow(scored), rule_snapshot: altered }])[0].policy).toBeUndefined();
  });

  it("hashes JSON objects independently of key order and preserves array order", () => {
    expect(snapshotDigest({ a: 1, b: [2, 3], c: undefined })).toBe(snapshotDigest({ b: [2, 3], a: 1 }));
    expect(snapshotDigest({ b: [2, 3] })).not.toBe(snapshotDigest({ b: [3, 2] }));
  });

  it("defaults to information-only without a production database", async () => {
    const [visible] = await loadPublishedRoutes([route], { NODE_ENV: "production" });
    expect(visible.policy).toBeUndefined();
    expect(visible.policies).toEqual([]);
  });

  it("withholds Git policies when the configured approval store is unavailable", async () => {
    const query = vi.spyOn(Pool.prototype, "query").mockRejectedValueOnce(new Error("fixture database details"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const [visible] = await loadPublishedRoutes([route], {
        DATABASE_URL: "postgres://fixture.example.test/policies",
        NODE_ENV: "development",
        POLICY_SOURCE: "snapshot",
      });
      expect(query).toHaveBeenCalledOnce();
      expect(visible.policy).toBeUndefined();
      expect(visible.policies).toEqual([]);
      expect(log).toHaveBeenCalledWith("Approved policy snapshots could not be loaded. Showing directory only.");
    } finally {
      query.mockRestore();
      log.mockRestore();
    }
  });

  it.each([
    { NODE_ENV: "development" },
    { NODE_ENV: "test" },
    { NODE_ENV: "production", POLICY_SOURCE: "snapshot" },
  ])("allows local or explicit snapshot preview (%o)", async (env) => {
    expect(await loadPublishedRoutes([route], env)).toEqual([route]);
  });
});

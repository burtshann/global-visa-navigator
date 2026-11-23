import { createHash } from "node:crypto";
import type { Route } from "../data/catalog";
import type { Policy } from "../domain/policy";

export function routePolicies(route: Route): readonly Policy[] {
  return [...(route.policy ? [route.policy] : []), ...(route.policies ?? [])];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${Array.from(value, canonicalJson).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const fields = Object.keys(object)
      .sort()
      .filter((key) => object[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`);
    return `{${fields.join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

export function snapshotDigest(snapshot: unknown): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

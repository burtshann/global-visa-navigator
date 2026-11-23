import { describe, expect, it } from "vitest";
import { isPolicyDatabaseUrl } from "./policy-database";

describe("policy database connection settings", () => {
  it.each([
    "postgres://reader@127.0.0.1:6543/preview",
    "postgresql://reader@[::1]/preview",
    "postgres://reader@postgres.example.test/policies?sslmode=verify-full",
  ])("accepts scoped loopback or verified TLS connection %s", (value) => {
    expect(isPolicyDatabaseUrl(value)).toBe(true);
  });

  it.each([
    "postgres://reader@postgres.example.test/policies",
    "postgres://reader@postgres.example.test/policies?sslmode=require",
    "postgres://reader@postgres.example.test/policies?sslmode=verify-full&sslmode=disable",
    "postgres://reader@127.0.0.1/preview?host=postgres.example.test",
    "postgres://reader@127.0.0.1/preview?hostaddr=192.0.2.42",
    "postgres://127.0.0.1/preview",
    "postgres://reader@127.0.0.1/",
    "https://reader@127.0.0.1/preview",
  ])("rejects insecure or ambiguous connection %s", (value) => {
    expect(isPolicyDatabaseUrl(value)).toBe(false);
  });
});

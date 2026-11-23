import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer, request } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPreviewGateway } from "./private-preview.mjs";

const password = randomBytes(32).toString("base64url");
const valid = `Basic ${Buffer.from(`preview:${password}`).toString("base64")}`;

async function bind(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

describe("private preview gateway", () => {
  let upstream;
  let upstreamPort;
  let gateway;
  let gatewayPort;
  let upstreamRequests;

  beforeEach(async () => {
    upstreamRequests = [];
    upstream = createServer((incoming, response) => {
      upstreamRequests.push({ url: incoming.url, headers: incoming.headers });
      if (incoming.url === "/next") {
        response.writeHead(302, { Location: `http://127.0.0.1:${upstreamPort}/result` }).end();
        return;
      }
      if (incoming.url === "/outside") {
        response.writeHead(302, { Location: "https://example.com/#outside" }).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=86400",
        "Cloudflare-CDN-Cache-Control": "public, max-age=86400",
        "Set-Cookie": "sample=upstream-cookie",
        Vary: "RSC",
      }).end(`Preview asset at ${incoming.url}`);
    });
    upstreamPort = await bind(upstream);
    ({ server: gateway } = createPreviewGateway({
      PRIVATE_PREVIEW_PASSWORD: password,
      PRIVATE_PREVIEW_ORIGIN_PORT: `${upstreamPort}`,
    }));
    gatewayPort = await bind(gateway);
  });

  afterEach(async () => Promise.all([close(gateway), close(upstream)]));

  function get(path, headers = {}) {
    return fetch(`http://127.0.0.1:${gatewayPort}${path}`, { headers, redirect: "manual" });
  }

  it("refuses startup for missing or malformed configuration", () => {
    expect(() => createPreviewGateway({})).toThrow(/password/);
    expect(() => createPreviewGateway({ PRIVATE_PREVIEW_PASSWORD: "weak" })).toThrow(/password/);
    expect(() => createPreviewGateway({ PRIVATE_PREVIEW_PASSWORD: password, PRIVATE_PREVIEW_PORT: "70000" })).toThrow(/port/);
    expect(() => createPreviewGateway({ PRIVATE_PREVIEW_PASSWORD: password, PRIVATE_PREVIEW_PORT: "3000" })).toThrow(/differ/);
  });

  it("challenges unauthorized HTML, assets, and unknown routes without contacting the application", async () => {
    for (const path of ["/", "/_next/static/test.js", "/favicon.ico", "/missing"]) {
      const response = await get(path);
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toMatch(/^Basic /);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).not.toContain("Preview asset");
    }
    const wrong = await get("/", { authorization: "Basic d3Jvbmc6d3Jvbmc=" });
    expect(wrong.status).toBe(401);
    expect(upstreamRequests).toEqual([]);
  });

  it("serves authenticated content while stripping credentials, cookies, cache and trust headers", async () => {
    const response = await get("/_next/static/app.js", {
      authorization: valid,
      "proxy-authorization": "hidden",
      cookie: "browser-secret=1",
      forwarded: "for=example;proto=https;host=example.com",
      "x-forwarded-host": "example.com",
      "x-forwarded-for": "198.51.100.2",
      "cf-access-jwt-assertion": "inbound-token",
      "if-none-match": "older-asset-id",
      rsc: "1",
      "next-router-prefetch": "1",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Preview asset at /_next/static/app.js");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("vary")).toBe("RSC, Authorization");
    const forwarded = upstreamRequests[0].headers;
    expect(forwarded).toMatchObject({ host: `127.0.0.1:${upstreamPort}`, rsc: "1", "next-router-prefetch": "1" });
    for (const name of ["authorization", "proxy-authorization", "cookie", "forwarded", "x-forwarded-host", "x-forwarded-for", "cf-access-jwt-assertion", "if-none-match"]) {
      expect(forwarded[name]).toBeUndefined();
    }
  });

  it("rejects duplicate authentication and requests that attempt proxy tunneling", async () => {
    const malformed = await get("/", { authorization: `${valid}, ${valid}` });
    expect(malformed.status).toBe(401);
    const injection = await new Promise((resolve, reject) => {
      const outgoing = request({ hostname: "127.0.0.1", port: gatewayPort, path: "http://example.com/", headers: { authorization: valid } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      outgoing.on("error", reject).end();
    });
    expect(injection).toBe(400);
    expect(upstreamRequests).toEqual([]);
  });

  it("blocks app writes, off-origin redirects, and offers no fallback when the app is down", async () => {
    const post = await fetch(`http://127.0.0.1:${gatewayPort}/apply`, { method: "POST", headers: { authorization: valid }, body: "profile" });
    expect(post.status).toBe(405);
    expect(upstreamRequests).toEqual([]);
    expect((await get("/next", { authorization: valid })).headers.get("location")).toBe("/result");
    const redirect = await get("/outside", { authorization: valid });
    expect(redirect.status).toBe(502);
    expect(redirect.headers.get("location")).toBeNull();
    await close(upstream);
    const stopped = await get("/", { authorization: valid });
    expect(stopped.status).toBe(502);
    expect(await stopped.text()).toBe("Preview unavailable.\n");
    expect((await get("/")).status).toBe(401);
  });
});

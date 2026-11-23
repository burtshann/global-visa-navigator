import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, request } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const loopback = "127.0.0.1";
const requestHeaders = [
  "accept", "accept-encoding", "accept-language", "range", "user-agent", "rsc",
  "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url",
];
const hopHeaders = [
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "proxy-connection",
  "te", "trailer", "transfer-encoding", "upgrade",
];
const responseHeaders = ["content-type", "content-encoding", "content-length", "content-language", "content-range", "accept-ranges", "vary"];
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function parsePort(value, fallback) {
  const port = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid private preview port.");
  return port;
}

function credentialDigest(credentials) {
  return createHash("sha256").update(credentials).digest();
}

function nominatedHeaders(headers) {
  return new Set([...(headers.connection ?? "").toLowerCase().split(",").map((name) => name.trim()), ...hopHeaders]);
}

function selectHeaders(headers, allowed) {
  const blocked = nominatedHeaders(headers);
  return Object.fromEntries(allowed.filter((name) => headers[name] !== undefined && !blocked.has(name))
    .map((name) => [name, headers[name]]));
}

function text(response, status, message, headers = {}) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...privateHeaders, ...headers });
  response.end(message);
}

function safeRequestPath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

function localRedirect(location, origin, path) {
  if (!location) return undefined;
  const url = new URL(location, `${origin}${path}`);
  const redirectPath = `${url.pathname}${url.search}${url.hash}`;
  if (url.origin !== origin || !safeRequestPath(redirectPath) || url.username || url.password) throw new Error("Unsupported redirect.");
  return redirectPath;
}

export function createPreviewGateway(environment = process.env) {
  const port = parsePort(environment.PRIVATE_PREVIEW_PORT, 3100);
  const originPort = parsePort(environment.PRIVATE_PREVIEW_ORIGIN_PORT, 3000);
  const username = environment.PRIVATE_PREVIEW_USERNAME ?? "preview";
  const password = environment.PRIVATE_PREVIEW_PASSWORD ?? "";
  if (!/^[\w.-]{1,64}$/.test(username) || !/^[A-Za-z0-9_-]{32,128}$/.test(password)) {
    throw new Error("Configure a private preview username and a random Base64URL password of at least 32 characters.");
  }
  if (port === originPort) throw new Error("The gateway and app ports must differ.");
  const expected = credentialDigest(Buffer.from(`${username}:${password}`).toString("base64"));
  const origin = `http://${loopback}:${originPort}`;

  const handle = (incoming, outgoing) => {
    const authorization = incoming.headersDistinct.authorization;
    const encoded = authorization?.length === 1 && /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization[0]);
    if (!encoded || !timingSafeEqual(expected, credentialDigest(encoded[1]))) {
      text(outgoing, 401, "Private preview. Sign in to continue.\n", {
        "WWW-Authenticate": 'Basic realm="Global Visa Navigator Private Preview", charset="UTF-8"',
      });
      return;
    }

    if (incoming.headers.expect) {
      text(outgoing, 417, "Invalid preview request.\n");
      return;
    }
    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      text(outgoing, 405, "Method not available in this preview.\n", { Allow: "GET, HEAD" });
      return;
    }
    if (!safeRequestPath(incoming.url) || incoming.headers["transfer-encoding"] ||
        (incoming.headers["content-length"] !== undefined && incoming.headers["content-length"] !== "0")) {
      text(outgoing, 400, "Invalid preview request.\n");
      return;
    }

    const upstream = request(origin, {
      method: incoming.method,
      path: incoming.url,
      headers: selectHeaders(incoming.headers, requestHeaders),
    }, (response) => {
      const headers = selectHeaders(response.headers, responseHeaders);
      try {
        const location = localRedirect(response.headers.location, origin, incoming.url);
        if (location) headers.location = location;
      } catch {
        response.destroy();
        text(outgoing, 502, "Preview unavailable.\n");
        return;
      }
      const vary = headers.vary ? `${headers.vary}, Authorization` : "Authorization";
      outgoing.writeHead(response.statusCode ?? 502, { ...headers, ...privateHeaders, vary });
      response.on("error", () => outgoing.destroy());
      response.pipe(outgoing);
    });
    upstream.setTimeout(15_000, () => upstream.destroy());
    upstream.on("error", () => {
      if (outgoing.headersSent) outgoing.destroy();
      else text(outgoing, 502, "Preview unavailable.\n");
    });
    outgoing.on("close", () => upstream.destroy());
    upstream.end();
  };

  const server = createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, handle);
  server.on("upgrade", (_request, socket) => socket.destroy());
  server.on("connect", (_request, socket) => socket.destroy());
  server.on("checkContinue", handle);
  server.on("checkExpectation", handle);
  server.maxHeadersCount = 50;
  return { server, listen: () => server.listen(port, loopback) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { server, listen } = createPreviewGateway();
    server.on("error", () => {
      console.error("Private preview gateway could not listen on loopback.");
      process.exitCode = 1;
    });
    server.on("listening", () => console.log(`Private preview gateway listening on ${loopback}:${server.address().port}.`));
    listen();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

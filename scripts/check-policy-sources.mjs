import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const baselineFile = new URL("../db/policy-sources.baseline.json", import.meta.url);
const digestPattern = /^[0-9a-f]{64}$/;

const germanStatute = {
  encoding: "iso-8859-1",
  content: /<div\b[^>]*\bclass=["']jnhtml["'][^>]*>([\s\S]+?)<div\b[^>]*\bid=["']fusszeile["']/i,
};

const normalizers = {
  "govuk-graduate-article-v1": {
    encoding: "utf-8",
    content: /<article\b[^>]*\baria-labelledby=["']section-title["'][^>]*>([\s\S]+?)<\/article\s*>/i,
    required: /\bGR\s+1\.2\b/,
  },
  "de-section-20a-v1": { ...germanStatute, required: /\bChancenkarte\b/ },
  "de-section-20b-v1": { ...germanStatute, required: /\bPunkte\b[\s\S]*\bChancenkarte\b/ },
  "de-opportunity-card-annex-v1": { ...germanStatute, required: /§\s*20b[\s\S]*\bMindestpunktzahl\b/ },
  "de-section-18g-v1": { ...germanStatute, required: /\bBlaue Karte EU\b/ },
  "de-skopje-opportunity-card-v1": {
    encoding: "utf-8",
    content: /<div\b[^>]*\bclass=["']c-rte--default["'][^>]*>([\s\S]+?)<a\b[^>]*\bclass=["']c-cta--backto\b/i,
    required: /\bChancenkarte\b/i,
  },
};

const entities = {
  amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: " ",
  auml: "ä", Auml: "Ä", ouml: "ö", Ouml: "Ö", uuml: "ü", Uuml: "Ü", szlig: "ß",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", sect: "§",
};

export function hashPolicyContent(bytes, normalizerId) {
  const normalizer = normalizers[normalizerId];
  const html = new TextDecoder(normalizer.encoding).decode(bytes);
  const section = normalizer.content.exec(html)?.[1] ?? "";
  const text = section
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(?:[^'">]|'[^']*'|"[^"]*")*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name) => {
      if (!name.startsWith("#")) return Object.hasOwn(entities, name) ? entities[name] : entity;
      const codePoint = Number(name.replace(/^#x/i, "0x").replace(/^#/, ""));
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizer.required.test(text)) {
    throw new Error("Expected policy text was absent. Check for a challenge page or a layout change.");
  }

  return createHash("sha256").update(text).digest("hex");
}

function validateSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("The baseline must contain at least one source.");
  }

  const ids = new Set();
  const urls = new Set();
  for (const { id, url, normalizer, sha256, capturedAt } of sources) {
    const parsedUrl = new URL(url);
    if (
      typeof id !== "string" || !id || ids.has(id) || urls.has(parsedUrl.href) ||
      parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password ||
      parsedUrl.search || parsedUrl.hash || !Object.hasOwn(normalizers, normalizer) ||
      !digestPattern.test(sha256) || !Number.isFinite(Date.parse(capturedAt))
    ) {
      throw new Error(`Invalid baseline record for ${id}.`);
    }
    ids.add(id);
    urls.add(parsedUrl.href);
  }
}

async function readHtml(response) {
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/html") || !response.body) {
    throw new Error("Source did not return an HTML document.");
  }

  const chunks = [];
  let byteLength = 0;
  for await (const chunk of response.body) {
    byteLength += chunk.length;
    if (byteLength > 2_000_000) throw new Error("Source response exceeded 2 MB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function comparePolicySources(sources, request = fetch) {
  validateSources(sources);

  return Promise.all(sources.map(async ({ id, url, normalizer, sha256 }) => {
    const baseline = { id, url, normalizer, baselineSha256: sha256 };
    try {
      const response = await request(url, {
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { accept: "text/html" },
      });
      const observedSha256 = hashPolicyContent(await readHtml(response), normalizer);
      return {
        ...baseline,
        observedAt: new Date().toISOString(),
        observedSha256,
        status: observedSha256 === sha256 ? "unchanged" : "changed",
      };
    } catch (error) {
      const cause = error.cause?.code;
      return {
        ...baseline,
        observedAt: new Date().toISOString(),
        status: "error",
        error: cause ? `${error.message} (${cause})` : error.message,
      };
    }
  }));
}

if (typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const { sources } = JSON.parse(await readFile(baselineFile, "utf-8"));
    const observations = await comparePolicySources(sources);
    console.log(JSON.stringify({ observations }, null, 2));
    if (observations.some(({ status }) => status === "error")) process.exitCode = 2;
    else if (observations.some(({ status }) => status === "changed")) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

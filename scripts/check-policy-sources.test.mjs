import { describe, expect, it, vi } from "vitest";
import { comparePolicySources, hashPolicyContent } from "./check-policy-sources.mjs";

const normalizer = "govuk-graduate-article-v1";
const original = '<article aria-labelledby="section-title"><p>GR 1.2. Original wording.</p></article>';
const hash = (html) => hashPolicyContent(Buffer.from(html), normalizer);
const source = {
  id: "test-source",
  url: "https://www.gov.uk/example",
  normalizer,
  sha256: hash(original),
  capturedAt: "2026-11-23T09:27:19Z",
};

function htmlResponse(document) {
  return new Response(document, { headers: { "content-type": "text/html" } });
}

describe("policy source change detection", () => {
  it("ignores site chrome, added markup, scripts, and whitespace outside wording", async () => {
    const withLayoutChange = `
      <nav>New label</nav>
      <article aria-labelledby="section-title"><p><strong>GR 1.2.</strong>
      Original&nbsp;wording.</p><script>timestamp = Date.now();</script></article>`;
    const [observation] = await comparePolicySources([source], async () => htmlResponse(withLayoutChange));

    expect(observation.status).toBe("unchanged");
    expect(observation.observedSha256).toBe(source.sha256);
  });

  it("reports altered wording with a new digest and leaves the baseline intact", async () => {
    const altered = original.replace("Original", "Revised");
    const [observation] = await comparePolicySources([source], async () => htmlResponse(altered));

    expect(observation.status).toBe("changed");
    expect(observation.observedSha256).toBe(hash(altered));
    expect(source.sha256).toBe(hash(original));
  });

  it("treats a challenge served as HTTP 200 as a failed observation", async () => {
    const [observation] = await comparePolicySources([source], async () => htmlResponse("<p>Verify browser</p>"));

    expect(observation.status).toBe("error");
    expect(observation).not.toHaveProperty("observedSha256");
  });

  it("reports HTTP errors for human follow-up", async () => {
    const [observation] = await comparePolicySources([source], async () => new Response(null, { status: 403 }));

    expect(observation.status).toBe("error");
    expect(observation.error).toContain("403");
  });

  it("rejects a malformed baseline before sending any request", async () => {
    const request = vi.fn();

    await expect(comparePolicySources([{ ...source, sha256: "invalid" }], request)).rejects.toThrow("Invalid baseline");
    expect(request).not.toHaveBeenCalled();
  });

  it("extracts §20a from the German statute with its documented legacy encoding", () => {
    const wrap = (text) => Buffer.from(`<div class="jnhtml"><p>Chancenkarte ${text}</p><div id="fusszeile">`, "latin1");
    expect(hashPolicyContent(wrap("für"), "de-section-20a-v1")).toBe(
      hashPolicyContent(wrap("f&uuml;r"), "de-section-20a-v1"),
    );
  });
});

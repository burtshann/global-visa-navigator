import { expect, test, type Page } from "@playwright/test";
import { rm, writeFile } from "node:fs/promises";

async function openEnglish(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

async function checkProfile(page: Page) {
  await page.getByRole("button", { name: "Check published rules" }).click();
  const results = page.getByRole("region", { name: "Your pathway checks" });
  await expect(results).toBeVisible();
  return results;
}

const serverClock = ".next/e2e-assessment-clock";

function sgEpAnswers(page: Page) {
  return (name: string) => page.locator(`#question-sg-employment-pass-${name}`);
}

async function enterCompassForty(page: Page) {
  const answer = sgEpAnswers(page);
  await answer("sgEpCompassOverseasIct").selectOption("no");
  await answer("sgEpCompassShortRole").selectOption("no");
  for (const [index, points] of ["0", "20", "10", "10", "0", "0"].entries()) {
    await answer(`sgEpCompassC${index + 1}`).selectOption(points);
  }
}

test("keeps a directory-only pathway out of the personal results for the same goal", async ({ page }) => {
  await openEnglish(page);
  await page.getByLabel("Main goal").selectOption("post-study");

  const results = await checkProfile(page);
  const graduate = results.locator('[data-route-id="uk-graduate"]');
  await expect(graduate.getByRole("heading", { name: "Graduate visa", exact: true })).toBeVisible();
  await expect(graduate.getByText("Matches your goal", { exact: true })).toBeVisible();
  await expect(graduate.getByText("More information needed", { exact: true })).toBeVisible();
  await expect(results.locator('[data-route-id="de-opportunity-card"]')).toHaveCount(0);
  await expect(results.getByRole("heading", { name: "Post-graduation work permit" })).toHaveCount(0);

  const directory = page.getByRole("region", { name: "Find a visa pathway" });
  const permit = directory.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Post-graduation work permit" }) });
  await expect(permit.getByText("Directory listing", { exact: true })).toBeVisible();
  await expect(permit.getByRole("link", { name: "Official requirements" })).toHaveAttribute("href", /^https:\/\/www\.canada\.ca\//);
});

test("reports a gap and an unknown, then limits the meaning of meeting the checked conditions", async ({ page }) => {
  await openEnglish(page);
  await page.getByLabel("Main goal").selectOption("post-study");
  const location = page.getByLabel("Are you currently in the UK?");
  const completion = page.getByLabel("Has your education provider told the Home Office that you successfully completed your course?");
  await location.selectOption("no");

  const results = await checkProfile(page);
  const graduate = results.locator('[data-route-id="uk-graduate"]');
  await expect(graduate.getByText("Gaps in checked requirements", { exact: true })).toBeVisible();
  await expect(graduate.getByText("Information still needed", { exact: true })).toBeVisible();
  await expect(graduate.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();
  await expect(graduate.getByText(/check the in-country application requirement/i)).toBeVisible();

  await location.selectOption("yes");
  await completion.selectOption("yes");
  await checkProfile(page);
  await expect(graduate.getByText("All checked conditions met", { exact: true })).toBeVisible();
  await expect(graduate.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();
});

test("calculates Opportunity Card points from entered profile evidence", async ({ page }) => {
  await openEnglish(page);
  await page.getByLabel("Main goal").selectOption("job-search");
  const age = page.getByLabel("Age on your application date", { exact: true });
  await age.fill("30");

  const question = (answer: string) => page.locator(`#question-de-opportunity-card-${answer}`);
  await question("outsideEuEfta").selectOption("yes");
  await question("deApplyingFromAbroad").selectOption("yes");
  await question("deQualificationBasis").selectOption("academic");
  await question("deGermanLevel").selectOption("B1");
  await question("deEnglishLevel").selectOption("none");
  await question("deRelevantYearsLast5").fill("2");
  await question("deRelevantYearsLast7").fill("2");
  await question("deBlockedEurMonthly").fill("1091");
  await page.locator("#profile-offer").selectOption("no");
  for (const answer of ["deFormalCommitment", "dePartialRecognition", "deShortageQualification", "dePriorStay", "deJointPartner"]) {
    await question(answer).selectOption("no");
  }

  const results = await checkProfile(page);
  const opportunityCard = results.locator('[data-route-id="de-opportunity-card"]');
  const points = opportunityCard.locator('[data-policy-id="de-opportunity-card-points"]');
  const score = points.locator(".points-breakdown > div").filter({ hasText: "Confirmed from your answers" }).locator("dd");
  await expect(score).toHaveText("6");
  await expect(points.getByText("All checked conditions met", { exact: true })).toBeVisible();
  await expect(opportunityCard.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();

  await age.fill("36");
  await checkProfile(page);
  await expect(score).toHaveText("5");
  await expect(points.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();
  await expect(opportunityCard.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();

  await age.fill("30");
  await question("deBlockedEurMonthly").fill("1090");
  await checkProfile(page);
  await expect(score).toHaveText("6");
  await expect(points.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();

  await page.locator("#profile-offer").selectOption("yes");
  await checkProfile(page);
  await expect(points.getByText("More information needed", { exact: true })).toBeVisible();

  await question("deGermanPartTimeContract").selectOption("yes");
  await question("deContractHoursWeekly").fill("20");
  await question("deContractNetEurMonthly").fill("500");
  await question("deBlockedEurMonthly").fill("591");
  await checkProfile(page);
  await expect(points.getByText("All checked conditions met", { exact: true })).toBeVisible();
  await expect(opportunityCard.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();
});

test("does not transmit profile inputs or retain them after reloading", async ({ page }) => {
  const marker = "759134.83";
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.url()} ${request.postData() ?? ""}`));

  await openEnglish(page);
  await page.getByLabel("Main goal").selectOption("job-search");
  const monthlyFunds = page.locator("#question-de-opportunity-card-deBlockedEurMonthly");
  await monthlyFunds.fill(marker);
  await checkProfile(page);
  expect(await page.evaluate(() => JSON.stringify([window.localStorage, window.sessionStorage]))).not.toContain(marker);

  await page.reload();
  await page.getByLabel("主要目标").selectOption("job-search");
  await expect(monthlyFunds).toHaveValue("");
  await expect(page.getByRole("region", { name: "你的路径核对结果" })).toHaveCount(0);
  expect(requests.some((request) => request.includes(marker))).toBe(false);
});

test("checks Skilled Worker evidence and keeps full UK eligibility pending", async ({ page }) => {
  await openEnglish(page);
  await page.getByLabel("Main goal").selectOption("skilled-work");
  const answer = (name: string) => page.locator(`#question-uk-skilled-worker-${name}`);
  await answer("ukSkilledWorkerInitial").selectOption("yes");
  await answer("ukSkilledApplyingFromAbroad").selectOption("yes");
  await answer("ukSkilledAge").fill("18");
  await answer("ukSkilledJobCos").selectOption("no");
  await answer("ukSkilledSponsorRated").selectOption("yes");

  const results = await checkProfile(page);
  const skilledWorker = results.locator('[data-route-id="uk-skilled-worker"]');
  await expect(skilledWorker.getByText("Gaps in checked requirements", { exact: true })).toBeVisible();
  await expect(skilledWorker.getByText("Information still needed", { exact: true })).toBeVisible();
  await answer("ukSkilledJobCos").selectOption("yes");
  await answer("ukSkilledEnglishBasis").selectOption("other-verified-evidence");
  await checkProfile(page);
  await expect(skilledWorker.getByText("More information needed", { exact: true })).toBeVisible();

  await answer("ukSkilledUsingAfghanNationality").selectOption("yes");
  await checkProfile(page);
  await expect(skilledWorker.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();
  await expect(skilledWorker.getByText(/using Afghan nationality are refused/)).toBeVisible();

  await answer("ukSkilledUsingAfghanNationality").selectOption("no");
  await checkProfile(page);
  await expect(skilledWorker.getByText("All checked conditions met", { exact: true })).toBeVisible();

  await answer("ukSkilledApplyingFromAbroad").selectOption("no");
  await answer("ukSkilledUsingAfghanNationality").selectOption("");
  await checkProfile(page);
  await expect(skilledWorker.getByText("All checked conditions met", { exact: true })).toBeVisible();
  await expect(skilledWorker.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();
});

test("refreshes the Singapore rule after local midnight without reloading or sending answers", async ({ page }) => {
  try {
    await writeFile(serverClock, "2026-12-31T15:59:00Z");
    await openEnglish(page);
    await page.getByLabel("Main goal").selectOption("skilled-work");
    const answer = (name: string) => page.locator("#question-sg-employment-pass-" + name);
    await answer("sgEpInitialApplication").selectOption("yes");
    await answer("sgEpSingaporeJobOffer").selectOption("yes");
    await answer("sgEpAge").fill("30");
    await answer("sgEpFinancialSector").selectOption("no");
    await answer("sgEpFixedMonthlySalarySgd").fill("7300");
    await enterCompassForty(page);
    const results = await checkProfile(page);
    const employmentPass = results.locator('[data-route-id="sg-employment-pass"]');
    await expect(employmentPass.locator("time")).toHaveText("2026-12-31");
    await expect(employmentPass.getByText(/7,223/)).toBeVisible();
    const compass = employmentPass.locator('[data-policy-id="sg-ep-stage-2-compass"]');
    await expect(compass.getByText("All checked conditions met", { exact: true })).toBeVisible();

    await writeFile(serverClock, "2026-12-31T16:01:00Z");
    const metadata = page.waitForResponse((response) => response.url().endsWith("/api/assessment"));
    await checkProfile(page);
    const response = await metadata;
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.request().method()).toBe("GET");
    expect(response.request().postData()).toBeNull();
    await expect(employmentPass.locator("time")).toHaveText("2027-01-01");
    await expect(employmentPass.getByText(/7,750/)).toBeVisible();
    await expect(employmentPass.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();
    await expect(answer("sgEpFixedMonthlySalarySgd")).toHaveValue("7300");
    await expect(answer("sgEpCompassC2")).toHaveValue("");
    await expect(answer("sgEpCompassShortRole")).toHaveValue("");
    await expect(compass.getByText("More information needed", { exact: true })).toBeVisible();
  } finally {
    await rm(serverClock, { force: true });
  }
});

test("keeps answers available for retry when current rules cannot be loaded", async ({ page }) => {
  await openEnglish(page);
  const goal = page.getByLabel("Main goal");
  await goal.selectOption("post-study");
  const location = page.locator("#question-uk-graduate-inUk");
  await location.selectOption("yes");
  const results = await checkProfile(page);

  await page.route("**/api/assessment", (route) => route.fulfill({ status: 503 }));
  await page.getByRole("button", { name: "Check published rules" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Current rules could not be loaded" })).toBeVisible();
  await expect(results).toHaveCount(0);
  await expect(goal).toHaveValue("post-study");
  await expect(location).toHaveValue("yes");

  await page.unroute("**/api/assessment");
  await checkProfile(page);
});

test("retains answers across a valid rule withdrawal and clears even hidden answers", async ({ page }) => {
  await openEnglish(page);
  const goal = page.getByLabel("Main goal");
  const location = page.locator("#question-uk-graduate-inUk");
  await goal.selectOption("post-study");
  await location.selectOption("yes");
  await page.locator("#question-uk-graduate-ukCompletionReported").selectOption("yes");
  const results = await checkProfile(page);

  const hideRules = () => page.route("**/api/assessment", async (route) => {
    const live = await route.fetch();
    await route.fulfill({ response: live, json: { ...await live.json(), policies: {} } });
  });
  await hideRules();
  await checkProfile(page);
  await expect(location).toHaveCount(0);
  await expect(results.locator('[data-route-id="uk-graduate"]')).toHaveCount(0);

  await page.unroute("**/api/assessment");
  await checkProfile(page);
  await expect(location).toHaveValue("yes");
  await expect(results.getByText("All checked conditions met", { exact: true })).toBeVisible();

  await hideRules();
  await checkProfile(page);
  await expect(location).toHaveCount(0);
  await page.getByRole("button", { name: "Clear answers" }).click();
  await expect(goal).toHaveValue("");
  await page.unroute("**/api/assessment");
  await checkProfile(page);
  await expect(location).toHaveValue("");
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("shows missing information and the full eligibility notice in both languages", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
    await page.getByLabel("主要目标").selectOption("post-study");
    await page.getByRole("button", { name: "核对已收录规则" }).click();

    const chineseResult = page.getByRole("region", { name: "你的路径核对结果" }).locator('[data-route-id="uk-graduate"]');
    await expect(chineseResult.getByText("仍需补充信息", { exact: true })).toBeVisible();
    await expect(chineseResult.getByText("完整资格仍待核实", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const englishResult = page.getByRole("region", { name: "Your pathway checks" }).locator('[data-route-id="uk-graduate"]');
    await expect(englishResult.getByText("More information needed", { exact: true })).toBeVisible();
    await expect(englishResult.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();
    const expectNoOverflow = async () => {
      const layout = await page.evaluate(async () => {
        await document.fonts.ready;
        const width = document.documentElement.scrollWidth;
        const overflow = Array.from(document.body.querySelectorAll("*")).flatMap((element) => {
          const right = Math.round(element.getBoundingClientRect().right);
          return right > 390 ? [{ tag: element.tagName, id: element.id, classes: element.className, right }] : [];
        });
        return { width, overflow: overflow.slice(0, 8) };
      });
      expect(layout.width, JSON.stringify(layout.overflow)).toBe(390);
    };
    await expectNoOverflow();

    // Wider fallback fonts must not force the English navigation outside the viewport.
    await page.addStyleTag({ content: ".primary-nav, .footer-inner { font-family: monospace; }" });
    await expectNoOverflow();
    expect(pageErrors).toEqual([]);
  });

  test("shows the Singapore salary threshold only when its selection criteria are known", async ({ page }) => {
    await openEnglish(page);
    await page.getByLabel("Main goal").selectOption("skilled-work");
    const answer = (name: string) => page.locator(`#question-sg-employment-pass-${name}`);
    await answer("sgEpInitialApplication").selectOption("yes");
    await answer("sgEpSingaporeJobOffer").selectOption("yes");
    await answer("sgEpAge").fill("30");
    await answer("sgEpFixedMonthlySalarySgd").fill("7981.99");
    const results = await checkProfile(page);
    const employmentPass = results.locator('[data-route-id="sg-employment-pass"]');
    const newApplication = employmentPass.locator('[data-policy-id="sg-ep-stage-1-2025"]');
    await expect(newApplication.getByText("More information needed", { exact: true })).toBeVisible();
    await expect(employmentPass.getByText("Minimum for these answers", { exact: true })).toHaveCount(0);

    await answer("sgEpFinancialSector").selectOption("yes");
    await checkProfile(page);
    await expect(employmentPass.getByText(/7,982/)).toBeVisible();
    await expect(employmentPass.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();

    await answer("sgEpFixedMonthlySalarySgd").fill("7982");
    await checkProfile(page);
    await expect(employmentPass.getByText("All checked conditions met", { exact: true })).toBeVisible();
    await expect(employmentPass.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();
    await expect(employmentPass.getByText(/Asia\/Singapore/)).toBeVisible();
  });
});

test("checks a Singapore renewal and unknown COMPASS points in both languages on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    await writeFile(serverClock, "2027-12-01T12:00:00Z");
    await openEnglish(page);
    await page.getByLabel("Main goal").selectOption("skilled-work");
    const answer = (name: string) => page.locator(`#question-sg-employment-pass-${name}`);
    await answer("sgEpInitialApplication").selectOption("no");
    await answer("sgEpRenewalOrdinary").selectOption("yes");
    await expect(answer("sgEpSingaporeJobOffer")).toHaveCount(0);
    await answer("sgEpRenewalExpiryDate").fill("2028-01-01");
    await answer("sgEpRenewalSameEmployerRole").selectOption("yes");
    await answer("sgEpAge").fill("30");
    await answer("sgEpFinancialSector").selectOption("yes");
    await answer("sgEpFixedMonthlySalarySgd").fill("8540.99");
    await answer("sgEpCompassOverseasIct").selectOption("no");
    await answer("sgEpCompassShortRole").selectOption("no");
    await answer("sgEpCompassC1").selectOption("20");
    await answer("sgEpCompassC2").selectOption("10");

    const results = await checkProfile(page);
    const pathway = results.locator('[data-route-id="sg-employment-pass"]');
    const renewal = pathway.locator('[data-policy-id="sg-ep-stage-1-renewal"]');
    const compass = pathway.locator('[data-policy-id="sg-ep-stage-2-compass"]');
    await expect(renewal.getByText(/8,541/)).toBeVisible();
    await expect(renewal.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();
    await expect(compass.getByText("More information needed", { exact: true })).toBeVisible();

    await answer("sgEpRenewalExpiryDate").fill("2027-12-31");
    await expect(answer("sgEpCompassC1")).toHaveValue("");
    await answer("sgEpCompassC1").selectOption("20");
    await answer("sgEpCompassC2").selectOption("10");
    await answer("sgEpCompassC3").selectOption("10");
    await answer("sgEpCompassC4").selectOption("0");
    await answer("sgEpCompassC5").selectOption("0");
    await answer("sgEpCompassC6").selectOption("0");
    await checkProfile(page);
    await expect(renewal.getByText(/7,982/)).toBeVisible();
    await expect(compass.getByText("All checked conditions met", { exact: true })).toBeVisible();
    await expect(pathway.getByText("Full eligibility still needs review", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "简体中文" }).click();
    await expect(page.getByLabel("现有就业准证到期日")).toHaveValue("2027-12-31");
    const chinesePathway = page.getByRole("region", { name: "你的路径核对结果" }).locator('[data-route-id="sg-employment-pass"]');
    await expect(chinesePathway.getByRole("heading", { name: "COMPASS 积分或豁免核对" })).toBeVisible();
    await expect(chinesePathway.getByText("完整资格仍待核实", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally {
    await rm(serverClock, { force: true });
  }
});

test("stops a renewal on its expiry date at Singapore midnight", async ({ page }) => {
  try {
    await writeFile(serverClock, "2026-12-01T15:59:00Z");
    await openEnglish(page);
    await page.getByLabel("Main goal").selectOption("skilled-work");
    const answer = sgEpAnswers(page);
    await answer("sgEpInitialApplication").selectOption("no");
    await answer("sgEpRenewalOrdinary").selectOption("yes");
    await answer("sgEpRenewalExpiryDate").fill("2026-12-02");
    await answer("sgEpRenewalSameEmployerRole").selectOption("yes");
    await answer("sgEpAge").fill("30");
    await answer("sgEpFinancialSector").selectOption("no");
    await answer("sgEpFixedMonthlySalarySgd").fill("22500");
    const results = await checkProfile(page);
    const pathway = results.locator('[data-route-id="sg-employment-pass"]');
    const salary = pathway.locator('[data-policy-id="sg-ep-stage-1-renewal"]');
    const compass = pathway.locator('[data-policy-id="sg-ep-stage-2-compass"]');
    await expect(pathway.getByText("All checked conditions met", { exact: true })).toHaveCount(2);

    await writeFile(serverClock, "2026-12-01T16:01:00Z");
    await checkProfile(page);
    await expect(pathway.locator("time")).toHaveText("2026-12-02");
    await expect(salary.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();
    await expect(salary.getByText(/ask your employer to apply for a new pass/)).toBeVisible();
    await expect(compass.getByText("These checks do not apply", { exact: true })).toBeVisible();
    await expect(pathway.getByText("All checked conditions met", { exact: true })).toHaveCount(0);
    await expect(results.locator(".match-card").first()).toHaveAttribute("data-route-id", "uk-skilled-worker");
  } finally {
    await rm(serverClock, { force: true });
  }
});

test("ranks required EP stages together and shows missing coverage after withdrawal", async ({ page }) => {
  await openEnglish(page);
  await page.getByLabel("Main goal").selectOption("skilled-work");
  const answer = sgEpAnswers(page);
  await answer("sgEpInitialApplication").selectOption("yes");
  await answer("sgEpSingaporeJobOffer").selectOption("yes");
  await answer("sgEpAge").fill("30");
  await answer("sgEpFinancialSector").selectOption("no");
  await answer("sgEpFixedMonthlySalarySgd").fill("5000");
  await enterCompassForty(page);

  const results = await checkProfile(page);
  const firstMatch = results.locator(".match-card").first();
  const pathway = results.locator('[data-route-id="sg-employment-pass"]');
  const salary = pathway.locator('[data-policy-id="sg-ep-stage-1-2025"]');
  const compass = pathway.locator('[data-policy-id="sg-ep-stage-2-compass"]');
  await expect(pathway.locator("[data-policy-id]").first()).toHaveAttribute("data-policy-id", "sg-ep-stage-1-2025");
  await expect(salary.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();
  await expect(compass.getByText("All checked conditions met", { exact: true })).toBeVisible();
  await expect(firstMatch).toHaveAttribute("data-route-id", "uk-skilled-worker");

  await answer("sgEpFixedMonthlySalarySgd").fill("");
  await expect(answer("sgEpCompassC2")).toHaveValue("");
  await answer("sgEpCompassOverseasIct").selectOption("yes");
  await checkProfile(page);
  await expect(salary.getByText("More information needed", { exact: true })).toBeVisible();
  await expect(compass.getByText("All checked conditions met", { exact: true })).toBeVisible();
  await expect(firstMatch).toHaveAttribute("data-route-id", "uk-skilled-worker");

  await answer("sgEpFixedMonthlySalarySgd").fill("8000");
  await expect(answer("sgEpCompassOverseasIct")).toHaveValue("");
  await enterCompassForty(page);
  await checkProfile(page);
  await expect(pathway.getByText("All checked conditions met", { exact: true })).toHaveCount(2);
  await expect(firstMatch).toHaveAttribute("data-route-id", "sg-employment-pass");

  for (const [withdrawn, missing] of [["sg-ep-stage-1-2025", "qualifying-salary"], ["sg-ep-stage-2-compass", "compass"]]) {
    await page.route("**/api/assessment", async (route) => {
      const live = await route.fetch();
      const metadata = await live.json();
      const epPolicies = metadata.policies["sg-employment-pass"].policies as { id: string }[];
      metadata.policies["sg-employment-pass"].policies = epPolicies.filter(({ id }) => id !== withdrawn);
      await route.fulfill({ response: live, json: metadata });
    });
    await checkProfile(page);
    await expect(pathway.locator(`[data-stage-id="${missing}"]`).getByText(/No published check covers this stage/)).toBeVisible();
    await expect(firstMatch).toHaveAttribute("data-route-id", "uk-skilled-worker");
    await page.unroute("**/api/assessment");
  }

  await checkProfile(page);
  await expect(answer("sgEpCompassC2")).toHaveValue("20");
  await page.route("**/api/assessment", (route) => route.fulfill({ status: 503 }));
  await page.getByRole("button", { name: "Check published rules" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Current rules could not be loaded" })).toBeVisible();
  await expect(answer("sgEpCompassC2")).toHaveValue("20");
  await page.unroute("**/api/assessment");

  await checkProfile(page);
  await expect(answer("sgEpCompassC2")).toHaveValue("20");
  await expect(pathway.getByText("All checked conditions met", { exact: true })).toHaveCount(2);

  await page.route("**/api/assessment", async (route) => {
    const live = await route.fetch();
    const metadata = await live.json();
    const epPolicies = metadata.policies["sg-employment-pass"].policies as { id: string; version: string }[];
    metadata.policies["sg-employment-pass"].policies = epPolicies.map((policy) =>
      policy.id === "sg-ep-stage-2-compass" ? { ...policy, version: policy.version + ".test-update" } : policy,
    );
    await route.fulfill({ response: live, json: metadata });
  });
  await checkProfile(page);
  await expect(answer("sgEpCompassC2")).toHaveValue("");
  await expect(compass.getByText("More information needed", { exact: true })).toBeVisible();
});

test("requires new COMPASS confirmations when the C1 expiry edition or application type changes", async ({ page }) => {
  try {
    await writeFile(serverClock, "2027-03-01T12:00:00Z");
    await openEnglish(page);
    await page.getByLabel("Main goal").selectOption("skilled-work");
    const answer = sgEpAnswers(page);
    await answer("sgEpInitialApplication").selectOption("no");
    await answer("sgEpRenewalOrdinary").selectOption("yes");
    await answer("sgEpRenewalExpiryDate").fill("2027-06-30");
    await answer("sgEpRenewalSameEmployerRole").selectOption("yes");
    await answer("sgEpAge").fill("30");
    await answer("sgEpFinancialSector").selectOption("no");
    await answer("sgEpFixedMonthlySalarySgd").fill("10000");
    await enterCompassForty(page);
    const results = await checkProfile(page);
    const compass = results.locator('[data-policy-id="sg-ep-stage-2-compass"]');
    await expect(compass.getByText("All checked conditions met", { exact: true })).toBeVisible();

    await answer("sgEpRenewalExpiryDate").fill("2027-07-01");
    await expect(answer("sgEpCompassC2")).toHaveValue("");
    await expect(answer("sgEpCompassC3")).toHaveValue("");
    await checkProfile(page);
    await expect(compass.getByText("More information needed", { exact: true })).toBeVisible();

    await answer("sgEpCompassC1").selectOption("20");
    await answer("sgEpCompassShortRole").selectOption("yes");
    await answer("sgEpInitialApplication").selectOption("yes");
    await answer("sgEpSingaporeJobOffer").selectOption("yes");
    await expect(answer("sgEpCompassC1")).toHaveValue("");
    await expect(answer("sgEpCompassShortRole")).toHaveValue("");
    await checkProfile(page);
    await expect(compass.getByText("More information needed", { exact: true })).toBeVisible();
  } finally {
    await rm(serverClock, { force: true });
  }
});

test("requires the ordinary pass type for the 180-day renewal window", async ({ page }) => {
  await openEnglish(page);
  await page.getByLabel("Main goal").selectOption("skilled-work");
  const answer = sgEpAnswers(page);
  await answer("sgEpInitialApplication").selectOption("no");
  await answer("sgEpRenewalExpiryDate").fill("2027-03-31");
  await answer("sgEpRenewalSameEmployerRole").selectOption("yes");
  await answer("sgEpAge").fill("30");
  await answer("sgEpFinancialSector").selectOption("no");
  await answer("sgEpFixedMonthlySalarySgd").fill("22500");

  const type = page.getByLabel("Which type of Employment Pass do you currently hold?");
  const results = await checkProfile(page);
  const firstMatch = results.locator(".match-card").first();
  const pathway = results.locator('[data-route-id="sg-employment-pass"]');
  const salary = pathway.locator('[data-policy-id="sg-ep-stage-1-renewal"]');
  const compass = pathway.locator('[data-policy-id="sg-ep-stage-2-compass"]');
  const passed = pathway.getByText("All checked conditions met", { exact: true });
  const renewalWindow = pathway.getByText(/ordinary EP renewal window has opened/);

  await expect(pathway.locator("time")).toHaveText("2026-11-27");
  await expect(type).toHaveValue("");
  await expect(salary.getByText("More information needed", { exact: true })).toBeVisible();
  await expect(compass.getByText("More information needed", { exact: true })).toBeVisible();
  await expect(renewalWindow).toHaveCount(0);
  await expect(firstMatch).toHaveAttribute("data-route-id", "uk-skilled-worker");

  await type.selectOption("yes");
  await enterCompassForty(page);
  await answer("sgEpCompassShortRole").selectOption("yes");
  await checkProfile(page);
  await expect(passed).toHaveCount(2);
  await expect(firstMatch).toHaveAttribute("data-route-id", "sg-employment-pass");

  await type.selectOption("no");
  await expect(answer("sgEpCompassC2")).toHaveValue("");
  await expect(answer("sgEpCompassShortRole")).toHaveValue("");
  await checkProfile(page);
  await expect(pathway.getByText(/separate three-month renewal window/)).toBeVisible();
  await expect(pathway.locator('[data-stage-id="qualifying-salary"]')).toContainText("No published check covers this stage");
  await expect(renewalWindow).toHaveCount(0);
  await expect(passed).toHaveCount(0);
  await expect(firstMatch).toHaveAttribute("data-route-id", "uk-skilled-worker");

  const snapshots = ["sg-ep-stage-1-renewal", "sg-ep-stage-2-compass"];
  for (const present of snapshots) {
    await page.route("**/api/assessment", async (route) => {
      const live = await route.fetch();
      const metadata = await live.json();
      const epPolicies = metadata.policies["sg-employment-pass"].policies as { id: string }[];
      metadata.policies["sg-employment-pass"].policies = epPolicies.filter(({ id }) => id === present);
      await route.fulfill({ response: live, json: metadata });
    });
    await checkProfile(page);
    await expect(type).toHaveValue("no");
    await expect(passed).toHaveCount(0);
    await expect(renewalWindow).toHaveCount(0);
    await expect(firstMatch).toHaveAttribute("data-route-id", "uk-skilled-worker");

    await type.selectOption("yes");
    await checkProfile(page);
    await expect(passed).toHaveCount(1);
    await expect(firstMatch).toHaveAttribute("data-route-id", "uk-skilled-worker");
    await type.selectOption("no");
    await page.unroute("**/api/assessment");
  }

  await answer("sgEpRenewalExpiryDate").fill("2026-11-27");
  await checkProfile(page);
  await expect(salary.getByText("A checked requirement is unmet", { exact: true })).toBeVisible();
  await expect(salary.getByText(/ask your employer to apply for a new pass/)).toBeVisible();
  await expect(compass.getByText("These checks do not apply", { exact: true })).toBeVisible();
  await expect(passed).toHaveCount(0);
});

import { expect, test, type Page } from "@playwright/test";

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
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    expect(pageErrors).toEqual([]);
  });
});

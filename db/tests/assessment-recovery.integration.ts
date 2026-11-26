import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";
import type { Pool } from "pg";

const port = "3111";
const origin = "http://127.0.0.1:" + port;

async function waitForApplication() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) }).catch(() => null);
    if (response?.ok) {
      await response.body?.cancel();
      return;
    }
    await setTimeout(250);
  }
  throw new Error("The production assessment test server did not start.");
}

export async function exerciseAssessmentRecovery(admin: Pool, database: string, readerUrl: URL) {
  const applicationName = "gvn_assessment_recovery";
  const login = new URL(readerUrl);
  login.searchParams.set("application_name", applicationName);
  const server = spawn(process.execPath, [
    "--require", "./e2e/server-clock.cjs", "./node_modules/next/dist/bin/next",
    "start", "--hostname", "127.0.0.1", "--port", port,
  ], {
    env: { ...process.env, NODE_ENV: "production", POLICY_DATABASE_URL: login.href, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
  });
  const stopped = once(server, "exit");
  try {
    await waitForApplication();
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(10_000);
      await page.goto(origin);
      await page.getByRole("button", { name: "English" }).click();
      const goal = page.getByLabel("Main goal");
      const answer = (key: string) => page.locator("#question-sg-employment-pass-" + key);
      const salary = answer("sgEpFixedMonthlySalarySgd");
      await goal.selectOption("skilled-work");
      await answer("sgEpInitialApplication").selectOption("yes");
      await answer("sgEpSingaporeJobOffer").selectOption("yes");
      await answer("sgEpAge").fill("30");
      await answer("sgEpFinancialSector").selectOption("no");
      await salary.fill("7300");

      const results = page.getByRole("region", { name: "Your pathway checks" });
      const employmentPass = results.locator('[data-route-id="sg-employment-pass"]');
      const submit = async () => {
        const metadata = page.waitForResponse((response) => response.url() === origin + "/api/assessment");
        await page.getByRole("button", { name: "Check published rules" }).click();
        const response = await metadata;
        assert.equal(response.headers()["cache-control"], "no-store");
        assert.equal(response.request().method(), "GET");
        assert.equal(response.request().postData(), null);
        return response;
      };
      assert.equal((await submit()).status(), 200);
      await expect(employmentPass.getByText("All checked conditions met", { exact: true })).toBeVisible();

      // Stop new connections to the disposable fixture database and close the app's active backend.
      await admin.query("ALTER DATABASE " + database + " ALLOW_CONNECTIONS false");
      try {
        const disconnected = await admin.query<{ stopped: boolean }>(
          "SELECT pg_terminate_backend(pid, 5000) AS stopped FROM pg_stat_activity WHERE datname = $1 AND application_name = $2",
          [database, applicationName],
        );
        assert.ok(disconnected.rows.length > 0 && disconnected.rows.every(({ stopped }) => stopped));

        const failed = await submit();
        assert.equal(failed.status(), 503);
        await expect(page.getByRole("status").filter({ hasText: "Current rules could not be loaded" })).toBeVisible();
        await expect(results).toHaveCount(0);
        await expect(goal).toHaveValue("skilled-work");
        await expect(salary).toHaveValue("7300");
        await expect(answer("sgEpFinancialSector")).toHaveValue("no");
        const directory = page.getByRole("region", { name: "Find a visa pathway" });
        await expect(directory.locator('[data-route-id="sg-employment-pass"]').getByText("Directory listing")).toBeVisible();
        const firstLoadDuringOutage = await fetch(origin, { signal: AbortSignal.timeout(5_000) });
        assert.equal(firstLoadDuringOutage.status, 200);
        assert.match(await firstLoadDuringOutage.text(), /data-route-id="sg-employment-pass"/);
      } finally {
        await admin.query("ALTER DATABASE " + database + " ALLOW_CONNECTIONS true");
      }

      assert.equal((await submit()).status(), 200);
      await expect(employmentPass.getByText("All checked conditions met", { exact: true })).toBeVisible();
      await expect(salary).toHaveValue("7300");
      console.log("Passed production browser recovery after a real PostgreSQL disconnection.");
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
    await stopped;
  }
}

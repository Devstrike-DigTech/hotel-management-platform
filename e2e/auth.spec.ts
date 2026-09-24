import { expect, test } from "@playwright/test";
import { ADMIN, completeStepUp, expireStepUp, freshCode, signIn, typeCode } from "./helpers";

test("signs in with password and TOTP, and signs out", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/good (morning|afternoon|evening)|still up/i);
  await expect(page.getByRole("navigation", { name: "Console" })).toBeVisible();
  // the session lives in httpOnly cookies: nothing readable by scripts
  const cookies = await page.context().cookies();
  const at = cookies.find((c) => c.name.endsWith("console_at"));
  expect(at?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("console_at");

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await page.goto("/tenants");
  await page.waitForURL(/\/login/);
});

test("refuses a wrong authenticator code", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Continue" }).click();
  const good = await freshCode();
  const wrong = String((Number(good) + 1) % 1_000_000).padStart(6, "0");
  await typeCode(page, wrong);
  await expect(page.getByText(/that code didn't match/i)).toBeVisible();
});

test("a sensitive action asks for a fresh code (step-up)", async ({ page }) => {
  await signIn(page, "/account");
  await expireStepUp(page);
  await page.getByRole("button", { name: "New recovery codes" }).click();
  await completeStepUp(page);
  await expect(page.getByTestId("recovery-codes")).toBeVisible();
  await expect(page.getByTestId("recovery-codes").locator("code")).toHaveCount(10);
});

test("a code that was just used asks to wait for the next one, without counting as a failure", async ({ browser }) => {
  const code = await freshCode();
  for (const expectOk of [true, false]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("Work email").fill(ADMIN.email);
    await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
    await page.getByRole("button", { name: "Continue" }).click();
    await typeCode(page, code);
    if (expectOk) await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    else {
      await expect(page.getByTestId("code-used")).toContainText(/just been used/);
      await expect(page.getByText(/didn't match/)).toHaveCount(0);
    }
    await ctx.close();
  }
});

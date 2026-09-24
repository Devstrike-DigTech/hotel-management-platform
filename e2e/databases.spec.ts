import { expect, test } from "@playwright/test";
import { completeStepUp, expireStepUp, unique } from "./helpers";

test("provisions a dedicated database for a new Enterprise tenant", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/");
  // a fresh Enterprise tenant to move
  const created = await page.evaluate(async (name) => {
    const r = await fetch("/api/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json", "x-console-request": "1" },
      body: JSON.stringify({ name, city: "Jos", state: "Plateau", owner: { fullName: "Dung Pam", email: `dung.${Date.now()}@plateauheights.ng`, phone: "+2348035550199" }, planCode: "enterprise", customPriceKobo: 60000000 }),
    });
    return { status: r.status, body: await r.json() };
  }, unique("Plateau Heights"));
  expect(created.status).toBe(201);
  await expireStepUp(page);
  await page.goto(`/databases/${created.body.tenant.id}`);
  await page.getByTestId("provision").click();
  await completeStepUp(page);
  const live = page.getByTestId("provisioning-live");
  await expect(live).toBeVisible();
  const unavailable = page.getByText(/DEDICATED_DB_UNAVAILABLE|needs DATABASE_ADMIN_URL/);
  test.skip(await unavailable.isVisible().catch(() => false), "provisioning is not configured on this API");
  await expect(live).toHaveAttribute("data-status", "ACTIVE", { timeout: 200_000 });
  await expect(page.getByText("Now serving")).toBeVisible();
});

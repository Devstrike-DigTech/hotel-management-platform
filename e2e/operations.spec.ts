import { expect, test } from "@playwright/test";
import { completeStepUp, expireStepUp, unique } from "./helpers";

test("creates an Enterprise tenant with a custom price", async ({ page }) => {
  const name = unique("Kainji Lakeside Hotels");
  await page.goto("/tenants/new");
  await page.getByLabel("Hotel or group name").fill(name);
  await page.getByLabel("City").fill("New Bussa");
  await page.getByLabel("State").selectOption("Niger");
  await page.getByLabel("Full name").fill("Zainab Garba");
  await page.getByLabel("Email").fill(`zainab.${Date.now()}@kainjilakeside.ng`);
  await page.getByLabel("Phone").fill("0803 555 0142");
  await page.getByLabel("Price").fill("850000");
  await page.getByTestId("create-tenant").click();
  await expect(page.getByTestId("tenant-created")).toContainText(name);
  await page.getByRole("link", { name: "Open the tenant" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
});

test("posts an announcement to Pro and Enterprise hotels", async ({ page }) => {
  const title = unique("Channel manager maintenance");
  await page.goto("/announcements/new");
  await page.getByRole("radio", { name: "Maintenance" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Message").fill("Channex pushes pause for ten minutes on Sunday at 02:00.\nBookings made meanwhile sync straight after.");
  await page.getByRole("radio", { name: "By plan" }).click();
  await page.getByRole("checkbox", { name: "Pro", exact: true }).check({ force: true });
  await page.getByRole("checkbox", { name: "Enterprise", exact: true }).check({ force: true });
  await expect(page.getByTestId("audience-count")).not.toHaveText("0");
  await page.getByTestId("publish-announcement").click();
  await page.waitForURL(/\/announcements$/);
  await expect(page.getByTestId("announcement-card").filter({ hasText: title })).toContainText("Live");
});

test("replies to a support request", async ({ page, request }) => {
  // a hotel opens a request from the admin (through the hotel API), then support answers it here
  const api = process.env.E2E_API_URL || "http://localhost:4000";
  const login = await request.post(`${api}/api/v1/auth/login`, { data: { email: "demo@palmwine.ng", password: "Demo1234!" } });
  const { accessToken } = await login.json();
  const subject = unique("Folio shows the balance twice");
  const opened = await request.post(`${api}/api/v1/support/requests`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { subject, category: "PAYMENTS", priority: "HIGH", message: "After a split cash and POS payment the folio shows the balance twice. Room 204.", context: { pageUrl: "http://localhost:3001/folios", appVersion: "0.6.0" } },
  });
  expect(opened.ok()).toBeTruthy();
  const { id } = await opened.json();

  await page.goto(`/support?open=${id}`);
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();
  const text = `Thanks, we are on it. Reference ${Date.now().toString(36)}.`;
  await page.getByTestId("support-composer").fill(text);
  await page.getByTestId("support-send").click();
  await expect(page.getByRole("list", { name: "Messages" })).toContainText(text);
});

test("starts a read-only impersonation session behind step-up", async ({ page }) => {
  // one running session per console user: end any left over from earlier runs
  const mine = await (await page.request.get("/api/platform/impersonations?active=true&pageSize=50")).json();
  const me = await (await page.request.get("/api/platform/auth/me")).json();
  for (const s of mine.items ?? []) if (s.platformUser.id === me.id) await page.request.post(`/api/platform/impersonations/${s.id}/end`, { headers: { "x-console-request": "1" } });
  await expireStepUp(page);
  await page.goto("/impersonation?new=1");
  await page.getByRole("textbox", { name: "Hotel" }).fill("Palmwine");
  await page.getByRole("dialog").getByRole("button", { name: /The Palmwine House/ }).click();
  await page.getByRole("radio").filter({ hasNotText: "Owner" }).nth(0).click();
  await page.getByLabel("Why are you viewing their account?").fill("E2E: checking the reservations list renders for a manager");
  await page.getByTestId("start-impersonation").click();
  await completeStepUp(page);
  await expect(page.getByTestId("impersonation-started")).toBeVisible();
  await expect(page.getByTestId("handoff-link")).toHaveAttribute("href", /\/impersonate#code=/);
  await page.getByRole("button", { name: "Done" }).click();
  const card = page.getByTestId("active-session").first();
  await expect(card).toContainText("The Palmwine House");
  await card.getByTestId("end-session").click();
  await expect(page.getByTestId("active-session")).toHaveCount(0);
});

test("retries a failed job after a step-up", async ({ page }) => {
  await expireStepUp(page);
  await page.goto("/system");
  await expect(page.locator('[data-testid^="queue-"]').first()).toBeVisible();
  const row = page.locator('[data-testid^="queue-"]').filter({ has: page.getByRole("button", { name: "Failed jobs", disabled: false }) }).first();
  test.skip((await row.count()) === 0, "no failed jobs in the seed right now");
  await row.getByRole("button", { name: "Failed jobs" }).click();
  await page.getByTestId("retry-jobs").click();
  await completeStepUp(page);
  await expect(page.getByText(/back in the queue/)).toBeVisible();
});

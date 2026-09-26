import { expect, test } from "@playwright/test";
import { completeStepUp, expireStepUp } from "./helpers";

/**
 * M8 in the console, against the live API: services a hotel wrote that trip the content screen
 * wait in the review queue with the caught words marked; one is approved (live for guests), one is
 * rejected with a reason the hotel then sees; and a hotel's concierge is suspended behind step-up,
 * then reinstated.
 */

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
const HOTEL = { email: process.env.E2E_HOTEL_EMAIL || "demo@palmwine.ng", password: process.env.E2E_HOTEL_PASSWORD || "Demo1234!" };
const stamp = Date.now().toString(36).slice(-5).toUpperCase();

async function hotel<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = (await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(HOTEL) })).json()) as { accessToken: string };
  const r = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${auth.accessToken}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

type Service = { id: string; name: string; reviewStatus: string; review: { reason: string | null } };

function held(name: string) {
  return hotel<Service>("POST", "/concierge/services", {
    name,
    description: "A slow walk through the herb garden; we pull a weed or two as we go.",
    category: "TOURS_AND_EXPERIENCES",
    imageUrl: null,
    pricing: "FIXED",
    priceKobo: 500000,
    variants: [],
    durationMinutes: 60,
    leadTimeHours: 1,
    availability: null,
    requiresSlot: false,
    slotCapacity: null,
    location: "ON_PROPERTY",
    fulfilledBy: "STAFF",
    vendorId: null,
    discreetEligible: false,
    questions: [],
    taxable: true,
    channels: ["TRIP_PAGE", "FRONT_DESK"],
    active: true,
  });
}

test("the review queue: caught words are marked; approve one, reject one with a reason", async ({ page }) => {
  const a = await held(`Garden walk ${stamp}A`);
  const b = await held(`Garden walk ${stamp}B`);
  expect(a.reviewStatus).toBe("PENDING_REVIEW");
  try {
    await page.goto("/concierge");
    await expect(page.getByRole("heading", { name: /Lawful services/ })).toBeVisible();
    const caseA = page.locator(`[data-testid="review-case"][data-service="${a.name}"]`);
    const caseB = page.locator(`[data-testid="review-case"][data-service="${b.name}"]`);
    // oldest first: page through until they show
    await expect(page.getByTestId("review-queue")).toBeVisible();
    for (let i = 0; i < 10 && !(await caseA.count()); i++) {
      const next = page.getByRole("button", { name: "Next page" });
      if (!(await next.count()) || !(await next.isEnabled())) break;
      await next.click();
      await page.waitForTimeout(600);
    }
    await expect(caseA).toBeVisible();
    await expect(caseA.getByTestId("matched-term").first()).toHaveText(/weed/i);
    await expect(caseA.getByTestId("review-matches")).toContainText(/weed/i);

    await caseA.getByTestId("approve-service").click();
    await page.getByTestId("confirm-approve").click();
    await expect(page.getByRole("status").filter({ hasText: "Approved" })).toBeVisible();
    await expect.poll(async () => (await hotel<Service>("GET", `/concierge/services/${a.id}`)).reviewStatus).toBe("LIVE");

    await expect(caseB).toBeVisible();
    await caseB.getByTestId("reject-service").click();
    const reason = `Please describe it without that word, e2e ${stamp}`;
    await page.getByLabel("Reason for the hotel").fill(reason);
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Rejected" })).toBeVisible();
    const after = await hotel<Service>("GET", `/concierge/services/${b.id}`);
    expect(after.reviewStatus).toBe("REJECTED");
    expect(after.review.reason).toBe(reason);
  } finally {
    await hotel("DELETE", `/concierge/services/${a.id}`).catch(() => undefined);
    await hotel("DELETE", `/concierge/services/${b.id}`).catch(() => undefined);
  }
});

test("suspend a hotel's concierge behind step-up, then reinstate it", async ({ page }) => {
  const TENANT = process.env.E2E_CONCIERGE_TENANT || "Eko Tides";
  await page.goto("/concierge");
  await page.getByTestId("tab-HOTELS").click();
  await page.getByLabel("Find a hotel").fill(TENANT);
  const row = page.locator("[data-tenant]").filter({ hasText: TENANT }).first();
  await expect(row).toBeVisible();
  const name = (await row.getAttribute("data-tenant"))!;
  try {
    await expireStepUp(page);
    await row.getByTestId("suspend-concierge").click();
    await page.getByLabel("Reason (the hotel sees it)").fill(`Checking the suspension path, e2e ${stamp}`);
    await page.getByRole("button", { name: "Suspend concierge" }).click();
    // sensitive: the API may ask for a fresh code first
    const stepUp = page.getByTestId("step-up-dialog");
    if (await stepUp.isVisible({ timeout: 4_000 }).catch(() => false)) await completeStepUp(page);
    await expect(page.getByRole("status").filter({ hasText: "Concierge suspended" })).toBeVisible();
    await expect(row).toContainText("Suspended");
    await expect(row).toContainText(`e2e ${stamp}`);
  } finally {
    const reinstate = row.getByTestId("reinstate-concierge");
    if (await reinstate.isVisible().catch(() => false)) {
      await reinstate.click();
      await page.getByLabel("Note").fill("e2e clean-up");
      await page.getByRole("button", { name: "Reinstate", exact: true }).click();
      const stepUp = page.getByTestId("step-up-dialog");
      if (await stepUp.isVisible({ timeout: 4_000 }).catch(() => false)) await completeStepUp(page);
      await expect(page.getByRole("status").filter({ hasText: "Concierge reinstated" })).toBeVisible();
      await expect(page.locator(`[data-tenant="${name}"]`)).not.toContainText("Suspended");
    }
  }
});

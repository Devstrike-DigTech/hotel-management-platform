import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  email: process.env.E2E_EMAIL || "admin@devstrike.ng",
  password: process.env.E2E_PASSWORD || "Admin1234!",
  /** The seeded development TOTP secret (API-M6.md 1.5). */
  secret: process.env.E2E_TOTP_SECRET || "DEVSTRIKEADMINTOTPSECRET234567AB",
};

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32(s: string) {
  let bits = 0;
  let v = 0;
  const out: number[] = [];
  for (const c of s.replace(/[^A-Z2-7]/g, "")) {
    v = (v << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((v >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totp(secret: string, at = Date.now()) {
  const c = Math.floor(at / 30_000);
  const b = Buffer.alloc(8);
  b.writeUInt32BE(Math.floor(c / 2 ** 32), 0);
  b.writeUInt32BE(c >>> 0, 4);
  const h = crypto.createHmac("sha1", b32(secret)).update(b).digest();
  const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
}

/**
 * The API refuses a code it has already accepted, so remember the windows we
 * used (on disk, shared by every worker and project) and wait for the next
 * 30-second window when needed.
 */
const USED = path.join(os.tmpdir(), "console-e2e-used-totp-windows");
function usedWindows(): Set<string> {
  try {
    return new Set(fs.readFileSync(USED, "utf8").split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
}
export async function freshCode(secret = ADMIN.secret) {
  for (;;) {
    const win = `${secret}:${Math.floor(Date.now() / 30_000)}`;
    // stay clear of the window edge so the code is still valid when it lands
    if (!usedWindows().has(win) && Date.now() % 30_000 < 26_000) {
      fs.appendFileSync(USED, `${win}\n`);
      return totp(secret);
    }
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 300));
  }
}

export async function typeCode(page: Page, code: string, prefix = "otp") {
  await page.locator(`#${prefix}-0`).click();
  await page.keyboard.type(code, { delay: 30 });
}

export async function signIn(page: Page, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Work email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /your code/i })).toBeVisible();
  // the API accepts each window once; if another client used this one, try the next
  for (let attempt = 0; attempt < 2; attempt++) {
    await typeCode(page, await freshCode());
    const ok = await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 8_000 }).then(() => true, () => false);
    if (ok) return;
  }
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/**
 * Makes the current session's step-up stale so the next sensitive action asks
 * for a code. Against the live API this edits the dev database directly
 * (E2E_DATABASE_URL); against the contract mock (E2E_MOCK=1) it calls the
 * mock's dev route.
 */
export async function expireStepUp(page: Page) {
  if (process.env.E2E_MOCK) {
    await page.request.post("/api/platform/dev/expire-step-up", { headers: { "x-console-request": "1" } });
    return;
  }
  const url = process.env.E2E_DATABASE_URL || "postgresql://hotel:hotel@localhost:5432/hotel";
  execFileSync("psql", [
    url,
    "-qc",
    `UPDATE platform_sessions SET step_up_at = now() - interval '11 minutes' WHERE revoked_at IS NULL AND platform_user_id = (SELECT id FROM platform_users WHERE email = '${ADMIN.email}')`,
  ]);
}

/** Completes the step-up dialog if (and only if) it appears. */
export async function completeStepUp(page: Page) {
  const dialog = page.getByTestId("step-up-dialog");
  await expect(dialog).toBeVisible();
  // another client (or test) may have used this window's code: then wait for the next one
  for (let attempt = 0; attempt < 3; attempt++) {
    await typeCode(page, await freshCode(), "stepup");
    const done = await dialog.waitFor({ state: "hidden", timeout: 6_000 }).then(() => true, () => false);
    if (done) return;
    await expect(page.getByTestId("code-used")).toBeVisible();
  }
  await expect(dialog).toBeHidden();
}

export const unique = (p: string) => `${p} ${Date.now().toString(36).slice(-5).toUpperCase()}`;

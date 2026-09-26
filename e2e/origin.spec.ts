import { expect, test } from "@playwright/test";
import { allowedOrigins, isSameOrigin, normalizeOrigin } from "../src/lib/server/origin";

/**
 * CSRF origin checks: the console must compare the browser's Origin with the host people use
 * (behind a proxy or a container), never with the address the server listens on.
 */

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const BIND = "http://0.0.0.0:3002"; // what Next derives inside a container

test.describe("origin rules", () => {
  test("normalises scheme, case and default ports", () => {
    expect(normalizeOrigin("HTTPS://Console.Example.com:443")).toBe("https://console.example.com");
    expect(normalizeOrigin("http://localhost:3002")).toBe("http://localhost:3002");
    expect(normalizeOrigin("null")).toBeNull();
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
  });

  test("behind a proxy: the forwarded host is accepted, the bind address is not needed", () => {
    const headers = h({ origin: "https://console.example.com", "x-forwarded-host": "console.example.com", "x-forwarded-proto": "https", host: "0.0.0.0:3002" });
    expect(isSameOrigin(headers, { requestOrigin: BIND, production: true })).toBe(true);
    expect(allowedOrigins(headers, { requestOrigin: BIND, production: true })).not.toContain(BIND);
  });

  test("a proxy that keeps the Host header works too", () => {
    const headers = h({ origin: "https://console.example.com", host: "console.example.com", "x-forwarded-proto": "https" });
    expect(isSameOrigin(headers, { requestOrigin: BIND, production: true })).toBe(true);
  });

  test("another site is refused", () => {
    const headers = h({ origin: "https://evil.example", "x-forwarded-host": "console.example.com", "x-forwarded-proto": "https", host: "console.example.com" });
    expect(isSameOrigin(headers, { requestOrigin: BIND, production: true })).toBe(false);
  });

  test("the scheme has to match", () => {
    const headers = h({ origin: "http://console.example.com", host: "console.example.com", "x-forwarded-proto": "https" });
    expect(isSameOrigin(headers, { production: true })).toBe(false);
  });

  test("PLATFORM_PUBLIC_ORIGIN, when set, is the only answer", () => {
    const opts = { publicOrigins: "https://console.example.com, https://ops.example.com", requestOrigin: BIND, production: true };
    expect(isSameOrigin(h({ origin: "https://ops.example.com", host: "internal:3002" }), opts)).toBe(true);
    // a forwarded host no longer widens the list
    expect(isSameOrigin(h({ origin: "https://other.example.com", "x-forwarded-host": "other.example.com", "x-forwarded-proto": "https" }), opts)).toBe(false);
  });

  test("no Origin header passes this check (the console header is still required)", () => {
    expect(isSameOrigin(h({ host: "console.example.com" }), { production: true })).toBe(true);
  });

  test("the development URL is accepted only in development", () => {
    const headers = h({ origin: "http://localhost:3002", host: "127.0.0.1:3002" });
    expect(isSameOrigin(headers, { requestOrigin: "http://localhost:3002", production: false })).toBe(true);
    expect(isSameOrigin(headers, { requestOrigin: "http://localhost:3002", production: true })).toBe(false);
  });
});

test.describe("the gateway", () => {
  const post = (request: import("@playwright/test").APIRequestContext, headers: Record<string, string>) =>
    request.post("/api/console/signout", { headers: { "x-console-request": "1", ...headers }, failOnStatusCode: false });

  test("refuses a write from another site", async ({ request }) => {
    const res = await post(request, { origin: "https://evil.example" });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("CSRF");
  });

  test("accepts a write that came through a proxy on another host name", async ({ request }) => {
    const res = await post(request, { origin: "https://console.example.com", "x-forwarded-host": "console.example.com", "x-forwarded-proto": "https" });
    expect(res.status()).toBe(200);
  });

  test("the forwarded API path uses the same rule", async ({ request }) => {
    const bad = await request.post("/api/platform/auth/logout", { headers: { "x-console-request": "1", origin: "https://evil.example" }, failOnStatusCode: false });
    expect(bad.status()).toBe(403);
    const good = await request.post("/api/platform/auth/logout", { headers: { "x-console-request": "1", origin: "https://console.example.com", "x-forwarded-host": "console.example.com", "x-forwarded-proto": "https" }, failOnStatusCode: false });
    expect(good.status()).not.toBe(403);
  });
});

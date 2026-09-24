import { NextRequest, NextResponse } from "next/server";
import { COOKIE, clearCookie, cookieHeader, jwtTtl, readCookie, ttlFromIso } from "@/lib/server/session-cookies";

/**
 * The console's API gateway.
 *
 * The browser calls `/api/<path>`; this handler forwards to
 * `${API_INTERNAL_URL || NEXT_PUBLIC_API_URL}/api/v1/<path>` from the console's
 * server. That gives three properties the browser alone cannot:
 *
 *  1. Credentials stay server-side. Tokens returned by `platform/auth/*` are
 *     moved into httpOnly, SameSite=Strict cookies and stripped from the JSON
 *     the page receives; the handler adds `Authorization` (and the step-up
 *     token) on the way out.
 *  2. The API can refuse platform calls that do not come from this server:
 *     only `platform/*` and a short list of public read endpoints are
 *     forwarded, and the real visitor IP travels as `X-Client-IP` signed with
 *     `TRUSTED_PROXY_SECRET` (per-user IP allowlists and lockouts depend on it).
 *  3. CSRF is closed: writes need the `X-Console-Request` header (a cross-site
 *     form cannot set it) and a same-origin `Origin`.
 */

export const dynamic = "force-dynamic";

const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const PROXY_SECRET = process.env.TRUSTED_PROXY_SECRET?.trim() || "";
const PLATFORM_KEY = process.env.PLATFORM_PROXY_KEY?.trim() || "";

const ALLOWED = [/^platform\//, /^public\/(app|plans|features|cities)$/, /^health$/];
const AUTH_PATH = /^platform\/auth\//;
const REFRESH_PATH = "platform/auth/refresh";
const LOGOUT_PATH = /^platform\/auth\/(logout|sessions\/current)$/;
const DEFAULT_ACCESS_TTL = 15 * 60;
const DEFAULT_REFRESH_TTL = 12 * 60 * 60;
const DEFAULT_STEPUP_TTL = 10 * 60;

type Ctx = { params: Promise<{ path: string[] }> };

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // The last hop is the one our own edge appended; earlier hops are client-controlled.
    if (hops.length) return hops[hops.length - 1];
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

function json(status: number, code: string, message: string) {
  return NextResponse.json({ statusCode: status, code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function forward(req: NextRequest, path: string, body: ArrayBuffer | undefined, tokens: { at: string | null; su: string | null }) {
  const url = `${API}/api/v1/${path}${req.nextUrl.search}`;
  const headers = new Headers();
  for (const h of ["content-type", "accept", "idempotency-key", "x-totp-code", "x-step-up-code", "x-request-id"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept")) headers.set("accept", "application/json");
  headers.set("x-client-ip", clientIp(req));
  const ua = req.headers.get("user-agent");
  if (ua) headers.set("user-agent", ua);
  if (PROXY_SECRET) headers.set("x-proxy-auth", PROXY_SECRET);
  if (PLATFORM_KEY) headers.set("x-platform-proxy-key", PLATFORM_KEY);
  // The API allows platform calls only from PLATFORM_ORIGINS; we are that origin.
  headers.set("origin", req.nextUrl.origin);
  if (tokens.at) headers.set("authorization", `Bearer ${tokens.at}`);
  if (tokens.su) headers.set("x-step-up-token", tokens.su);
  return fetch(url, { method: req.method, headers, body: body && body.byteLength ? body : undefined, redirect: "manual", cache: "no-store" });
}

async function refresh(req: NextRequest, rt: string): Promise<{ at: string; rt?: string; raw: Record<string, unknown> } | null> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json", "x-client-ip": clientIp(req), origin: req.nextUrl.origin };
    if (PROXY_SECRET) headers["x-proxy-auth"] = PROXY_SECRET;
    if (PLATFORM_KEY) headers["x-platform-proxy-key"] = PLATFORM_KEY;
    const r = await fetch(`${API}/api/v1/${REFRESH_PATH}`, { method: "POST", headers, body: JSON.stringify({ refreshToken: rt }), cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    if (typeof data.accessToken !== "string") return null;
    return { at: data.accessToken, rt: typeof data.refreshToken === "string" ? data.refreshToken : undefined, raw: data };
  } catch {
    return null;
  }
}

/** Moves any credential out of an auth response body into cookies. */
function captureTokens(data: Record<string, unknown>, cookies: string[]) {
  if (typeof data.accessToken === "string") {
    cookies.push(cookieHeader({ name: COOKIE.access, value: data.accessToken, maxAge: jwtTtl(data.accessToken, DEFAULT_ACCESS_TTL) }));
    delete data.accessToken;
    data.session = true;
  }
  if (typeof data.refreshToken === "string") {
    cookies.push(
      cookieHeader({
        name: COOKIE.refresh,
        value: data.refreshToken,
        maxAge: ttlFromIso(data.refreshExpiresAt, DEFAULT_REFRESH_TTL),
      }),
    );
    delete data.refreshToken;
  }
  if (typeof data.stepUpToken === "string") {
    cookies.push(
      cookieHeader({ name: COOKIE.stepUp, value: data.stepUpToken, maxAge: ttlFromIso(data.stepUpExpiresAt ?? data.expiresAt, DEFAULT_STEPUP_TTL) }),
    );
    delete data.stepUpToken;
  }
}

async function handle(req: NextRequest, ctx: Ctx) {
  const { path: parts } = await ctx.params;
  const path = parts.map(encodeURIComponent).join("/");
  if (!ALLOWED.some((re) => re.test(path))) return json(404, "NOT_FOUND", "Not found");

  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    if (req.headers.get("x-console-request") !== "1") return json(403, "CSRF", "Missing console request header");
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) return json(403, "CSRF", "Cross-site request refused");
  }

  const cookieHeaderIn = req.headers.get("cookie");
  let at = readCookie(cookieHeaderIn, COOKIE.access);
  const rt = readCookie(cookieHeaderIn, COOKIE.refresh);
  const su = readCookie(cookieHeaderIn, COOKIE.stepUp);
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();
  const setCookies: string[] = [];

  // Access cookie expired but a refresh cookie remains: renew before calling.
  if (!at && rt && !AUTH_PATH.test(path)) {
    const r = await refresh(req, rt);
    if (r) {
      captureTokens({ accessToken: r.at, refreshToken: r.rt, refreshExpiresAt: r.raw.refreshExpiresAt }, setCookies);
      at = r.at;
    }
  }

  let upstream: Response;
  try {
    upstream = await forward(req, path, body, { at, su });
    if (upstream.status === 401 && rt && !AUTH_PATH.test(path)) {
      const r = await refresh(req, rt);
      if (r) {
        captureTokens({ accessToken: r.at, refreshToken: r.rt, refreshExpiresAt: r.raw.refreshExpiresAt }, setCookies);
        upstream = await forward(req, path, body, { at: r.at, su });
      }
    }
  } catch {
    return json(502, "UPSTREAM_UNAVAILABLE", "The platform API is not reachable from the console server.");
  }

  const outHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const h of ["content-type", "content-disposition", "x-next-cursor", "x-request-id", "retry-after", "ratelimit-remaining"]) {
    const v = upstream.headers.get(h);
    if (v) outHeaders.set(h, v);
  }

  const type = upstream.headers.get("content-type") || "";
  let payload: BodyInit | null = upstream.body;
  if (upstream.status === 401 && !AUTH_PATH.test(path)) {
    setCookies.push(clearCookie(COOKIE.access), clearCookie(COOKIE.refresh), clearCookie(COOKIE.stepUp));
  }
  if (AUTH_PATH.test(path) && type.includes("application/json")) {
    const text = await upstream.text();
    try {
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (upstream.ok) captureTokens(data, setCookies);
      payload = JSON.stringify(data);
    } catch {
      payload = text;
    }
    if (upstream.ok && LOGOUT_PATH.test(path) && method !== "GET") {
      setCookies.push(clearCookie(COOKIE.access), clearCookie(COOKIE.refresh), clearCookie(COOKIE.stepUp));
    }
    outHeaders.delete("content-length");
  }
  for (const c of setCookies) outHeaders.append("set-cookie", c);
  return new NextResponse(upstream.status === 204 ? null : payload, { status: upstream.status, headers: outHeaders });
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };

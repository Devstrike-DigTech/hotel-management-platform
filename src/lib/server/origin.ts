/**
 * Same-origin checks for the console's write requests (CSRF).
 *
 * The browser's `Origin` must match the origin the browser actually used to reach the console,
 * which is NOT the address the Node server listens on: behind a proxy, a load balancer or a
 * container the server may bind `0.0.0.0:3002` while people open `https://console.example.com`.
 *
 * Accepted origins, in order:
 *  1. `PLATFORM_PUBLIC_ORIGIN` (comma-separated), when set: exactly those and nothing else.
 *     Recommended in production.
 *  2. Otherwise the origin the request came through: `X-Forwarded-Host` (first value) with
 *     `X-Forwarded-Proto`, then the `Host` header with that protocol. A cross-site page cannot
 *     make a victim's browser send either header with a value of its choosing (forms cannot set
 *     headers, and a cross-origin fetch with custom headers is stopped by CORS preflight), so
 *     comparing against them is safe; the `X-Console-Request` header check stays in front.
 *  3. In development only, the URL Next derives (`http://localhost:3002`).
 */

type HeaderBag = { get(name: string): string | null };

const DEFAULT_PORT: Record<string, string> = { "http:": "80", "https:": "443" };

/** Lower-cases scheme and host and drops a default port; null when it is not an http(s) origin. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || v === "null") return null;
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const port = u.port && u.port !== DEFAULT_PORT[u.protocol] ? `:${u.port}` : "";
    return `${u.protocol}//${u.hostname.toLowerCase()}${port}`;
  } catch {
    return null;
  }
}

function first(v: string | null): string | null {
  if (!v) return null;
  const f = v.split(",")[0]?.trim();
  return f || null;
}

/** The origins a write from the console's own page may carry. */
export function allowedOrigins(headers: HeaderBag, opts: { publicOrigins?: string; requestOrigin?: string; production?: boolean } = {}): string[] {
  const configured = (opts.publicOrigins ?? "")
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter((s): s is string => !!s);
  if (configured.length) return [...new Set(configured)];

  const out: string[] = [];
  const proto = (first(headers.get("x-forwarded-proto")) ?? (opts.requestOrigin?.startsWith("https:") ? "https" : "http")).toLowerCase().replace(/:$/, "");
  const scheme = proto === "https" ? "https" : "http";
  for (const host of [first(headers.get("x-forwarded-host")), headers.get("host")]) {
    if (!host || /[\s/@\\]/.test(host)) continue;
    const o = normalizeOrigin(`${scheme}://${host}`);
    if (o) out.push(o);
  }
  if (!opts.production && opts.requestOrigin) {
    const o = normalizeOrigin(opts.requestOrigin);
    if (o) out.push(o);
  }
  return [...new Set(out)];
}

/**
 * Whether a write request's Origin is the console's own. A request without an Origin header
 * (same-origin GET-like navigations, server-to-server tools) passes this check; the
 * `X-Console-Request` header, which only the console's script sets, is still required.
 */
export function isSameOrigin(headers: HeaderBag, opts: { publicOrigins?: string; requestOrigin?: string; production?: boolean } = {}): boolean {
  const raw = headers.get("origin");
  if (!raw) return true;
  const origin = normalizeOrigin(raw);
  if (!origin) return false;
  return allowedOrigins(headers, opts).includes(origin);
}

export function consoleOriginOptions(requestOrigin: string) {
  return { publicOrigins: process.env.PLATFORM_PUBLIC_ORIGIN, requestOrigin, production: process.env.NODE_ENV === "production" };
}

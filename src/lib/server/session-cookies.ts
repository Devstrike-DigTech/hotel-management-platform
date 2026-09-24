import "server-only";

/**
 * The console keeps every platform credential in httpOnly cookies set by its
 * own server. Browser JavaScript never sees an access, refresh or step-up
 * token, so an injected script cannot lift a session.
 *
 * Cookie names use the __Host- prefix in production (Secure, Path=/, no
 * Domain: the cookie cannot be set or read by any other host, sub-domains of
 * the product domain included).
 */
const prod = process.env.NODE_ENV === "production";
const prefix = prod ? "__Host-" : "";

export const COOKIE = {
  access: `${prefix}console_at`,
  refresh: `${prefix}console_rt`,
  stepUp: `${prefix}console_su`,
} as const;

export interface CookieSpec {
  name: string;
  value: string;
  maxAge: number;
}

export function cookieHeader({ name, value, maxAge }: CookieSpec): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${Math.max(0, Math.floor(maxAge))}`];
  if (prod) parts.push("Secure");
  return parts.join("; ");
}

export const clearCookie = (name: string) => cookieHeader({ name, value: "", maxAge: 0 });

/** Seconds until a JWT's `exp`, or the fallback when it is not a readable JWT. */
export function jwtTtl(token: string, fallback: number): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    if (typeof payload.exp === "number") return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    /* opaque token */
  }
  return fallback;
}

export function ttlFromIso(iso: unknown, fallback: number): number {
  if (typeof iso !== "string") return fallback;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((t - Date.now()) / 1000)) : fallback;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) {
      try {
        return decodeURIComponent(part.slice(i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

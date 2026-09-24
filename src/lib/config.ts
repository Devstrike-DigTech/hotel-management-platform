/**
 * Runtime identity and endpoints. The product name is not final: it is always
 * read from env and never hard-coded in components. NEXT_PUBLIC_* values must be
 * referenced literally so Next can inline them.
 *
 * The browser never talks to the API directly. Every call goes to this app's
 * own `/api/*` route handlers, which forward to `NEXT_PUBLIC_API_URL` (or the
 * server-only `API_INTERNAL_URL`) from the console's server. See
 * `src/app/api/[...path]/route.ts`.
 */
const trim = (s: string) => s.replace(/\/$/, "");

export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "HotelOS",
  appDomain: process.env.NEXT_PUBLIC_APP_DOMAIN || "hotelos.ng",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@hotelos.ng",
  apiUrl: trim(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"),
  adminUrl: trim(process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001"),
  webUrl: trim(process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"),
  /** Where the browser sends API calls: the console's own proxy. */
  proxyBase: "/api",
  company: "Devstrike Digital",
};

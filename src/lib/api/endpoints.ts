import { api } from "./client";
import type { PlatformRole } from "./types";

export interface PlatformMe {
  id: string;
  fullName: string;
  email: string;
  role: PlatformRole;
  permissions?: string[];
  totpEnabled?: boolean;
  stepUpUntil?: string | null;
  [key: string]: unknown;
}

export interface LoginResult {
  /** true once the cookies hold a full session */
  session?: boolean;
  user?: PlatformMe;
  mfaRequired?: boolean;
  enrolmentRequired?: boolean;
  mfaToken?: string;
  [key: string]: unknown;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<LoginResult>("platform/auth/login", { method: "POST", body: { email, password }, noExpire: true, noStepUp: true }),
  verify: (mfaToken: string, body: { code?: string; recoveryCode?: string }) =>
    api<LoginResult>("platform/auth/totp/verify", { method: "POST", body: { mfaToken, ...body }, noExpire: true, noStepUp: true }),
  enrolStart: (mfaToken: string) =>
    api<{ otpauthUri: string; secret: string }>("platform/auth/totp/enrol", { method: "POST", body: { mfaToken }, noExpire: true, noStepUp: true }),
  enrolConfirm: (mfaToken: string, code: string) =>
    api<LoginResult & { recoveryCodes?: string[] }>("platform/auth/totp/enrol/confirm", { method: "POST", body: { mfaToken, code }, noExpire: true, noStepUp: true }),
  me: () => api<PlatformMe>("platform/auth/me", { noExpire: true }),
  stepUp: (body: { code?: string; recoveryCode?: string }) =>
    api<{ expiresAt?: string; stepUpExpiresAt?: string }>("platform/auth/step-up", { method: "POST", body, noStepUp: true }),
  logout: () => api<unknown>("platform/auth/logout", { method: "POST", noExpire: true }),
};

/** Drops the console cookies locally (works even if the API is down). */
export const endLocalSession = () =>
  fetch("/api/console/signout", { method: "POST", headers: { "X-Console-Request": "1" }, credentials: "same-origin" }).catch(() => undefined);

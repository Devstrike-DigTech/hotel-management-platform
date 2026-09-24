import { api, download } from "./client";
import type {
  FeatureInfo,
  MarketplaceSummary,
  ModerationReason,
  ModerationReview,
  OrphanedPayment,
  Paginated,
  Plan,
  PlanPatch,
  Receivables,
  SubscriptionStatus,
  BillingInterval,
} from "./types";
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementInput,
  AnnouncementStats,
  ApiUsageOverview,
  AudiencePreview,
  Coupon,
  CreateTenantInput,
  DataExport,
  EnrolStart,
  FailedJob,
  ImpersonationSession,
  InviteInfo,
  MfaChallenge,
  Offboarding,
  Overview,
  PermissionCatalogue,
  PlatformAuditItem,
  PlatformMe,
  PlatformRole,
  PlatformSession,
  PlatformUserRow,
  Provisioning,
  SessionResult,
  SupportMessage,
  SupportRequest,
  SupportRequestDetail,
  SupportSummary,
  SystemHealth,
  TenantApiUsage,
  TenantDatabaseView,
  TenantDetailM6,
  TenantRef,
  TenantRowM6,
} from "./types-m6";

export type { PlatformMe };
type Q = Record<string, string | number | boolean | null | undefined>;
const noStep = { noExpire: true, noStepUp: true } as const;

/* ---------- 1. auth ---------- */
export const authApi = {
  login: (email: string, password: string) => api<MfaChallenge>("platform/auth/login", { method: "POST", body: { email, password }, ...noStep }),
  verify: (mfaToken: string, body: { code?: string; recoveryCode?: string }) =>
    api<SessionResult>("platform/auth/mfa/verify", { method: "POST", body: { mfaToken, ...body }, ...noStep }),
  enrolStart: (mfaToken: string) => api<EnrolStart>("platform/auth/mfa/enrol/start", { method: "POST", body: { mfaToken }, ...noStep }),
  enrolVerify: (mfaToken: string, code: string) =>
    api<SessionResult & { recoveryCodes: string[] }>("platform/auth/mfa/enrol/verify", { method: "POST", body: { mfaToken, code }, ...noStep }),
  me: () => api<PlatformMe>("platform/auth/me", { noExpire: true }),
  stepUp: (body: { code?: string; recoveryCode?: string }) => api<{ stepUpUntil: string }>("platform/auth/step-up", { method: "POST", body, noStepUp: true }),
  logout: () => api<unknown>("platform/auth/logout", { method: "POST", noExpire: true }),
  sessions: () => api<PlatformSession[]>("platform/auth/sessions"),
  revokeSession: (id: string) => api<unknown>(`platform/auth/sessions/${id}`, { method: "DELETE" }),
  revokeOthers: () => api<{ revoked: number }>("platform/auth/sessions/revoke-others", { method: "POST" }),
  regenerateCodes: () => api<{ recoveryCodes: string[] }>("platform/auth/mfa/recovery-codes", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<unknown>("platform/auth/password", { method: "POST", body: { currentPassword, newPassword } }),
  setIpAllowlist: (cidrs: string[]) => api<PlatformMe>("platform/auth/ip-allowlist", { method: "PUT", body: { cidrs } }),
  invite: (token: string) => api<InviteInfo>(`platform/auth/invite/${encodeURIComponent(token)}`, noStep),
  acceptInvite: (token: string, password: string, fullName?: string) =>
    api<MfaChallenge>("platform/auth/invite/accept", { method: "POST", body: { token, password, fullName }, ...noStep }),
  permissions: () => api<PermissionCatalogue>("platform/permissions"),
};

/** Drops the console cookies locally (works even if the API is down). */
export const endLocalSession = () =>
  fetch("/api/console/signout", { method: "POST", headers: { "X-Console-Request": "1" }, credentials: "same-origin" }).catch(() => undefined);

/* ---------- 3. overview, public ---------- */
export const overviewApi = {
  overview: () => api<Overview>("platform/overview"),
  features: () => api<FeatureInfo[]>("public/features"),
};

/* ---------- 4. tenants ---------- */
export interface SubscriptionPatch {
  planCode?: string;
  status?: SubscriptionStatus;
  trialEndsAt?: string;
  interval?: BillingInterval;
  customPriceKobo?: number | null;
  contractStartAt?: string | null;
  contractEndAt?: string | null;
  contractNotes?: string | null;
}
export const tenantsApi = {
  list: (q: Q) => api<Paginated<TenantRowM6>>("platform/tenants", { query: q }),
  get: (id: string) => api<TenantDetailM6>(`platform/tenants/${id}`),
  create: (body: CreateTenantInput) => api<{ tenant: TenantDetailM6; ownerSetupUrl: string }>("platform/tenants", { method: "POST", body }),
  updateSubscription: (id: string, body: SubscriptionPatch) => api<TenantDetailM6>(`platform/tenants/${id}/subscription`, { method: "PATCH", body }),
  setFeature: (id: string, featureCode: string, enabled: boolean) =>
    api<TenantDetailM6>(`platform/tenants/${id}/features`, { method: "PUT", body: { featureCode, enabled } }),
  removeFeature: (id: string, featureCode: string) => api<unknown>(`platform/tenants/${id}/features/${featureCode}`, { method: "DELETE" }),
  extendTrial: (id: string, days: number, reason: string) => api<TenantDetailM6>(`platform/tenants/${id}/extend-trial`, { method: "POST", body: { days, reason } }),
  suspend: (id: string, reason: string) => api<TenantDetailM6>(`platform/tenants/${id}/suspend`, { method: "POST", body: { reason } }),
  reinstate: (id: string, reason: string) => api<TenantDetailM6>(`platform/tenants/${id}/reinstate`, { method: "POST", body: { reason } }),
  applyCoupon: (id: string, code: string) => api<TenantDetailM6>(`platform/tenants/${id}/coupon`, { method: "POST", body: { code } }),
  removeCoupon: (id: string) => api<unknown>(`platform/tenants/${id}/coupon`, { method: "DELETE" }),
  offboarding: (id: string) => api<Offboarding | null>(`platform/tenants/${id}/offboarding`),
  offboard: (id: string, confirmName: string, reason: string) => api<Offboarding>(`platform/tenants/${id}/offboard`, { method: "POST", body: { confirmName, reason } }),
  offboardings: (status?: string) => api<Offboarding[]>("platform/offboardings", { query: { status } }),
  cancelOffboarding: (id: string, reason: string) => api<Offboarding>(`platform/offboardings/${id}/cancel`, { method: "POST", body: { reason } }),
  deleteNow: (id: string) => api<Offboarding>(`platform/offboardings/${id}/delete-now`, { method: "POST" }),
  exports: (id: string) => api<DataExport[]>(`platform/tenants/${id}/exports`),
  startExport: (id: string) => api<DataExport>(`platform/tenants/${id}/exports`, { method: "POST" }),
  apiUsage: (id: string, q: Q = {}) => api<TenantApiUsage>(`platform/tenants/${id}/api-usage`, { query: q }),
};

/* ---------- 5. plans, coupons, marketplace ---------- */
export const plansApi = {
  list: async () => {
    const r = await api<Plan[] | { items: Plan[] }>("platform/plans");
    return (Array.isArray(r) ? r : r.items).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  },
  update: (code: string, patch: PlanPatch) => api<Plan>(`platform/plans/${code}`, { method: "PATCH", body: patch }),
};
export type CouponInput = Omit<Coupon, "id" | "redemptions" | "createdAt" | "createdBy">;
export const couponsApi = {
  list: (active?: boolean) => api<Coupon[]>("platform/coupons", { query: { active } }),
  create: (body: Partial<CouponInput>) => api<Coupon>("platform/coupons", { method: "POST", body }),
  update: (id: string, body: Partial<Pick<Coupon, "name" | "active" | "validUntil" | "maxRedemptions">>) =>
    api<Coupon>(`platform/coupons/${id}`, { method: "PATCH", body }),
  redemptions: (id: string) => api<{ tenant: TenantRef; appliedAt: string; monthsRemaining: number | null }[]>(`platform/coupons/${id}/redemptions`),
};
export const marketApi = {
  summary: (from?: string, to?: string) => api<MarketplaceSummary>("platform/marketplace/summary", { query: { from, to } }),
  receivables: (month?: string) => api<Receivables>("platform/commission/receivables", { query: { month } }),
  settle: (tenantId: string, month: string, reference?: string) =>
    api<Receivables["items"][number]>("platform/commission/receivables/settle", { method: "POST", body: { tenantId, month, reference } }),
  orphaned: (q: Q) => api<Paginated<OrphanedPayment>>("platform/payments/orphaned", { query: q }),
  retryRefund: (id: string) => api<OrphanedPayment>(`platform/payments/${id}/retry-refund`, { method: "POST" }),
  reviews: (q: Q) => api<Paginated<ModerationReview>>("platform/reviews", { query: q }),
  moderate: (id: string, body: { status: "HIDDEN" | "PUBLISHED"; reason?: ModerationReason; note?: string }) =>
    api<ModerationReview>(`platform/reviews/${id}`, { method: "PATCH", body }),
};

/* ---------- 6. impersonation ---------- */
export const impersonationApi = {
  list: (q: Q) => api<Paginated<ImpersonationSession>>("platform/impersonations", { query: q }),
  get: (id: string) => api<ImpersonationSession & { activity: import("./types").AuditItem[] }>(`platform/impersonations/${id}`),
  start: (body: { tenantId: string; userId: string; reason: string; durationMinutes?: number; supportRequestId?: string }) =>
    api<{ session: ImpersonationSession; handoffUrl: string }>("platform/impersonations", { method: "POST", body }),
  writeMode: (id: string, enabled: boolean, reason?: string) =>
    api<ImpersonationSession>(`platform/impersonations/${id}/write-mode`, { method: "POST", body: { enabled, reason } }),
  end: (id: string) => api<ImpersonationSession>(`platform/impersonations/${id}/end`, { method: "POST" }),
};

/* ---------- 7. system ---------- */
export const systemApi = {
  health: () => api<SystemHealth>("platform/system/health"),
  failed: (queue: string) => api<FailedJob[]>(`platform/system/queues/${queue}/failed`, { query: { limit: 50 } }),
  retry: (queue: string, jobIds?: string[]) => api<{ retried: number }>(`platform/system/queues/${queue}/retry`, { method: "POST", body: { jobIds } }),
  clean: (queue: string, jobIds?: string[]) => api<{ removed: number }>(`platform/system/queues/${queue}/clean`, { method: "POST", body: { jobIds } }),
  runJob: (name: string) => api<{ result: unknown }>(`platform/jobs/${name}/run`, { method: "POST" }),
};

/* ---------- 8. dedicated databases ---------- */
export const databasesApi = {
  list: () => api<(TenantDatabaseView & { tenant: TenantRef })[]>("platform/dedicated-databases"),
  get: (tenantId: string) => api<TenantDatabaseView>(`platform/tenants/${tenantId}/database`),
  provision: (tenantId: string, body: { source: "AUTO" | "URL"; url?: string }) =>
    api<Provisioning>(`platform/tenants/${tenantId}/database/provision`, { method: "POST", body }),
  provisioning: (id: string) => api<Provisioning>(`platform/provisionings/${id}`),
  rollback: (tenantId: string) => api<Provisioning>(`platform/tenants/${tenantId}/database/rollback`, { method: "POST" }),
  purgeShared: (tenantId: string) => api<TenantDatabaseView>(`platform/tenants/${tenantId}/database/purge-shared`, { method: "POST" }),
  migrateAll: () =>
    api<{ results: { target: string; applied: string[]; ok: boolean; error: string | null }[] }>("platform/databases/migrate-all", { method: "POST" }),
};

/* ---------- 9. announcements, support, users, api usage, audit ---------- */
export const announcementsApi = {
  list: (state?: string) => api<Announcement[]>("platform/announcements", { query: { state } }),
  create: (body: AnnouncementInput) => api<Announcement>("platform/announcements", { method: "POST", body }),
  update: (id: string, body: Partial<AnnouncementInput>) => api<Announcement>(`platform/announcements/${id}`, { method: "PATCH", body }),
  publish: (id: string) => api<Announcement>(`platform/announcements/${id}/publish`, { method: "POST" }),
  end: (id: string) => api<Announcement>(`platform/announcements/${id}/end`, { method: "POST" }),
  archive: (id: string) => api<unknown>(`platform/announcements/${id}`, { method: "DELETE" }),
  preview: (audience: AnnouncementAudience) => api<AudiencePreview>("platform/announcements/audience-preview", { method: "POST", body: { audience } }),
  stats: (id: string) => api<AnnouncementStats>(`platform/announcements/${id}/stats`),
};
export const supportApi = {
  list: (q: Q) => api<Paginated<SupportRequest>>("platform/support/requests", { query: q }),
  get: (id: string) => api<SupportRequestDetail>(`platform/support/requests/${id}`),
  update: (id: string, body: { status?: string; priority?: string; assigneeId?: string | null; category?: string }) =>
    api<SupportRequest>(`platform/support/requests/${id}`, { method: "PATCH", body }),
  reply: (id: string, body: { body: string; internal?: boolean; attachmentKeys?: string[] }) =>
    api<SupportMessage>(`platform/support/requests/${id}/messages`, { method: "POST", body }),
  attach: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api<import("./types-m6").Attachment>("platform/support/attachments", { method: "POST", body: fd });
  },
  summary: () => api<SupportSummary>("platform/support/summary"),
};
export const usersApi = {
  list: () => api<PlatformUserRow[]>("platform/users"),
  invite: (body: { email: string; fullName: string; role: PlatformRole }) =>
    api<{ user: PlatformUserRow; inviteUrl: string }>("platform/users", { method: "POST", body }),
  update: (id: string, body: { role?: PlatformRole; isActive?: boolean; ipAllowlist?: string[]; fullName?: string }) =>
    api<PlatformUserRow>(`platform/users/${id}`, { method: "PATCH", body }),
  resetMfa: (id: string) => api<PlatformUserRow>(`platform/users/${id}/reset-mfa`, { method: "POST" }),
  unlock: (id: string) => api<PlatformUserRow>(`platform/users/${id}/unlock`, { method: "POST" }),
  resendInvite: (id: string) => api<{ inviteUrl: string }>(`platform/users/${id}/resend-invite`, { method: "POST" }),
  remove: (id: string) => api<unknown>(`platform/users/${id}`, { method: "DELETE" }),
  sessions: (id: string) => api<PlatformSession[]>(`platform/users/${id}/sessions`),
  revokeSession: (id: string, sid: string) => api<unknown>(`platform/users/${id}/sessions/${sid}`, { method: "DELETE" }),
};
export const usageApi = {
  overview: (q: Q = {}) => api<ApiUsageOverview>("platform/api-usage", { query: q }),
};
export const auditApi = {
  list: (q: Q) => api<Paginated<PlatformAuditItem>>("platform/audit", { query: q }),
  export: (q: Q, format: "csv" | "json") => download("platform/audit/export", `platform-audit.${format}`, { query: { ...q, format } }),
};
export const supportRequests = supportApi;

/* The M6 platform contract (API-M6.md sections 0-9) as TypeScript. Money in kobo. */

import type { AuditItem, BillingInterval, Paginated, PlatformRole, SubscriptionStatus, TenantDetail, TenantRow } from "./types";

export type PlatformPermission =
  | "tenants.view"
  | "tenants.manage"
  | "plans.manage"
  | "billing.view"
  | "billing.manage"
  | "commission.manage"
  | "reviews.moderate"
  | "impersonate"
  | "announcements.manage"
  | "support.handle"
  | "dedicated_db.manage"
  | "platform_users.manage"
  | "audit.view"
  | "system.view";

export type TenantRef = { id: string; name: string; slug: string };
export type PlatformUserRef = { id: string; fullName: string; email: string };
export type Attachment = { key: string; name: string; size: number; contentType: string; url: string };

/* ---------- 1. auth ---------- */
export interface PlatformSession {
  id: string;
  current: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  mfaMethod: "totp" | "recovery_code";
  stepUpUntil: string | null;
  revokedAt: string | null;
}
export interface PlatformMe {
  id: string;
  fullName: string;
  email: string;
  role: PlatformRole;
  permissions: PlatformPermission[];
  mfaEnabled: boolean;
  recoveryCodesRemaining: number;
  ipAllowlist: string[];
  stepUpUntil: string | null;
  session: PlatformSession;
  lastLoginAt: string | null;
}
export interface MfaChallenge {
  status: "MFA_REQUIRED" | "MFA_ENROLMENT_REQUIRED";
  mfaToken: string;
  mfaTokenExpiresAt: string;
}
/** After the proxy: tokens are moved into cookies, `session: true` marks success. */
export interface SessionResult {
  status: "OK";
  session?: boolean;
  accessTokenExpiresAt?: string;
  user: PlatformMe;
  recoveryCodes?: string[];
}
export interface EnrolStart {
  secret: string;
  otpauthUri: string;
  qrSvg?: string;
  issuer: string;
  account: string;
}
export interface InviteInfo {
  email: string;
  fullName: string;
  role: PlatformRole;
  expiresAt: string;
}
export interface PermissionCatalogue {
  permissions: { code: PlatformPermission; label: string; description: string }[];
  roles: { role: PlatformRole; label: string; permissions: PlatformPermission[] }[];
}

/* ---------- 2. audit ---------- */
export interface PlatformAuditItem {
  id: string;
  createdAt: string;
  actor: { id: string; fullName: string; role: PlatformRole } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  tenant: TenantRef | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
}

/* ---------- 7. health ---------- */
export interface SystemHealthSummary {
  status: "ok" | "degraded" | "down";
  failedJobs: number;
  webhookFailures24h: number;
  notificationFailures24h: number;
  channelSyncErrors24h: number;
  overdueCrons: number;
  dedicatedDbsUnhealthy: number;
}
export interface QueueStat {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
}
export interface CronRow {
  job: string;
  queue: string;
  schedule: string;
  lastRunAt: string | null;
  lastStatus: "OK" | "FAILED" | null;
  lastDurationMs: number | null;
  lastError: string | null;
  nextRunAt: string | null;
  overdue: boolean;
}
export interface SystemHealth {
  summary: SystemHealthSummary;
  queues: QueueStat[];
  notifications: {
    failed24h: number;
    byChannel: { channel: "EMAIL" | "SMS" | "WHATSAPP"; provider: string; sent24h: number; failed24h: number }[];
    recentFailures: { id: string; tenant: TenantRef | null; template: string; channel: string; recipient: string; error: string | null; createdAt: string }[];
  };
  webhooks: {
    failed24h: number;
    disabledEndpoints: number;
    recentFailures: { deliveryId: string; tenant: TenantRef; endpointUrl: string; eventType: string; responseStatus: number | null; error: string | null; attempts: number; at: string }[];
  };
  channelSync: { errors24h: number; recent: { tenant: TenantRef; propertyName: string; kind: string; message: string; at: string }[] };
  paystack: { events24h: number; recent: { id: string; eventType: string; tenant: TenantRef | null; processed: boolean; createdAt: string }[] };
  crons: CronRow[];
  database: {
    sharedSizeBytes: number;
    tenants: { tenant: TenantRef; mode: "SHARED" | "DEDICATED"; sizeBytes: number | null; estimatedBytes: number; rows: number }[];
  };
  generatedAt: string;
}
export interface FailedJob {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
  data: unknown;
}

/* ---------- 3. overview ---------- */
export interface Overview {
  mrrKobo: number;
  arrKobo: number;
  gmv30dKobo: number;
  commission30d: { collectedKobo: number; receivableKobo: number };
  tenantsTotal: number;
  tenantsByPlan: Record<string, number>;
  tenantsByStatus: Record<SubscriptionStatus, number>;
  signupsByWeek: { week: string; count: number }[];
  newTenants30d: number;
  churn: { churned30d: number; churnRatePct: number; mrrLost30dKobo: number; byMonth: { month: string; churned: number }[] };
  trialsEndingSoon: TenantRow[];
  health: SystemHealthSummary;
}

/* ---------- 8. dedicated databases ---------- */
export type DbMode = "SHARED" | "DEDICATED";
export type DbStatus = "PROVISIONING" | "MIGRATING" | "COPYING" | "CUTOVER" | "ACTIVE" | "FAILED";
export type ProvisioningStep = "CREATE_DATABASE" | "MIGRATE" | "COPY" | "READ_ONLY_DELTA" | "VERIFY" | "CUTOVER" | "DONE" | "ROLLBACK";
export interface Provisioning {
  id: string;
  kind?: "PROVISION" | "ROLLBACK";
  tenant: TenantRef;
  status: DbStatus | "ROLLED_BACK";
  step: ProvisioningStep;
  progressPct: number;
  startedAt: string;
  finishedAt: string | null;
  requestedBy: PlatformUserRef | null;
  readOnlyWindow: { startedAt: string; endedAt: string | null; durationMs: number | null } | null;
  tables: { table: string; sourceRows: number; copiedRows: number; targetRows: number | null; sourceChecksum: string | null; targetChecksum: string | null; ok: boolean | null }[];
  logs: { at: string; level: "info" | "warn" | "error"; message: string }[];
  error: string | null;
}
export interface TenantDatabaseView {
  tenantId: string;
  mode: DbMode;
  status: DbStatus | null;
  dbName: string | null;
  host: string | null;
  version: string | null;
  lastMigratedAt: string | null;
  activatedAt: string | null;
  sharedCopyPurgeAfter: string | null;
  sharedCopyPurgedAt: string | null;
  sizeBytes: number | null;
  currentProvisioning: Provisioning | null;
}

/* ---------- 15 / 4.5 exports and offboarding ---------- */
export interface DataExport {
  id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED" | "EXPIRED";
  requestedBy: { kind: "USER" | "PLATFORM"; id: string; fullName: string };
  reason: "REQUEST" | "OFFBOARDING";
  progressPct: number;
  entities: { name: string; rows: number }[];
  sizeBytes: number | null;
  fileName: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
}
export type OffboardingStatus = "EXPORTING" | "GRACE" | "DELETING" | "DELETED" | "CANCELLED" | "FAILED";
export interface Offboarding {
  id: string;
  tenant: TenantRef;
  status: OffboardingStatus;
  reason: string;
  requestedBy: PlatformUserRef;
  requestedAt: string;
  exportId: string | null;
  export: DataExport | null;
  deleteAfter: string | null;
  deletedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: PlatformUserRef | null;
  summary: { tables: number; rowsDeleted: number } | null;
  error: string | null;
}

/* ---------- 5.2 coupons ---------- */
export interface Coupon {
  id: string;
  code: string;
  name: string;
  percentOff: number | null;
  amountOffKobo: number | null;
  durationMonths: number | null;
  planCodes: string[];
  intervals: BillingInterval[];
  maxRedemptions: number | null;
  redemptions: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
  createdBy: PlatformUserRef | null;
}
export interface CouponRedemption {
  couponId: string;
  code: string;
  name: string;
  percentOff: number | null;
  amountOffKobo: number | null;
  monthsRemaining: number | null;
  appliedAt: string;
}

/* ---------- 6. impersonation ---------- */
export type ImpersonationMode = "READ_ONLY" | "WRITE";
export interface ImpersonationSession {
  id: string;
  tenant: TenantRef;
  staff: { id: string; fullName: string; email: string; role: string };
  platformUser: PlatformUserRef;
  reason: string;
  writeReason: string | null;
  mode: ImpersonationMode;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endedBy: "PLATFORM" | "HOTEL_OWNER" | "EXPIRED" | "SELF" | null;
  supportRequestId: string | null;
  requests: number;
  writes: number;
}

/* ---------- 4. tenants (M6 additions) ---------- */
export interface TenantRowM6 extends TenantRow {
  lifecycle: "ACTIVE" | "OFFBOARDING" | "DELETED";
  mrrKobo: number;
  dbMode: DbMode;
  offboarding: boolean;
  properties: number;
}
export interface TenantStaff {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}
export interface TenantDetailM6 extends Omit<TenantDetail, "subscription" | "offboarding" | "staff"> {
  lifecycle?: "ACTIVE" | "OFFBOARDING" | "DELETED";
  mrrKobo?: number;
  dbMode?: DbMode;
  subscription:
    | (NonNullable<TenantDetail["subscription"]> & {
        customPriceKobo: number | null;
        contractStartAt: string | null;
        contractEndAt: string | null;
        contractNotes: string | null;
        coupon: CouponRedemption | null;
      })
    | null;
  usage: { rooms: number; staff: number; properties: number };
  staff: TenantStaff[];
  payout: { ready: boolean; properties: { propertyId: string; name: string; payoutReady: boolean; bankName: string | null; accountLast4: string | null }[] };
  domains: { propertyId: string; domain: string; status: "PENDING" | "VERIFIED" | "FAILED"; kind: "BOOKING_SITE" | "STAFF_PORTAL" }[];
  whiteLabel: { enabled: boolean; emailDomain: string | null; emailDomainStatus: string | null; smsSenderId: string | null; smsSenderStatus: string | null };
  sso: { enabled: boolean; provider: string | null; enforced: boolean };
  dedicatedDb: TenantDatabaseView;
  apiUsage: { keys: number; requests30d: number; errors30d: number; lastUsedAt: string | null };
  support: { open: number; overdue: number };
  offboarding: Offboarding | null;
  impersonations: ImpersonationSession[];
  recentActivity: AuditItem[];
}
export interface CreateTenantInput {
  name: string;
  slug?: string;
  city: string;
  state: string;
  owner: { fullName: string; email: string; phone: string };
  planCode?: string;
  interval?: BillingInterval;
  customPriceKobo?: number | null;
  contractStartAt?: string;
  contractEndAt?: string;
  contractNotes?: string;
  status?: "ACTIVE" | "TRIALING";
  trialEndsAt?: string;
  propertyName?: string;
}

/* ---------- 9.1 announcements ---------- */
export type AnnouncementSeverity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL" | "MAINTENANCE";
export type AnnouncementAudience =
  | { kind: "ALL" }
  | { kind: "PLANS"; planCodes: string[] }
  | { kind: "CITIES"; cities: string[] }
  | { kind: "TENANTS"; tenantIds: string[] };
export type AnnouncementState = "DRAFT" | "SCHEDULED" | "ACTIVE" | "ENDED" | "ARCHIVED";
export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  channels: { inApp: boolean; email: boolean };
  startsAt: string;
  endsAt: string | null;
  dismissible: boolean;
  link: { label: string; url: string } | null;
  state: AnnouncementState;
  publishedAt: string | null;
  emailedAt: string | null;
  createdBy: PlatformUserRef | null;
  createdAt: string;
  updatedAt: string;
  stats: { targetedTenants: number; emailsSent: number; seenUsers: number; dismissedUsers: number };
}
export type AnnouncementInput = Pick<Announcement, "title" | "body" | "severity" | "audience" | "channels" | "startsAt" | "endsAt" | "dismissible" | "link">;
export interface AudiencePreview {
  tenantCount: number;
  sample: TenantRef[];
  byPlan: Record<string, number>;
}
export interface AnnouncementStats {
  targetedTenants: number;
  emailsSent: number;
  seenUsers: number;
  dismissedUsers: number;
  byTenant: { tenant: TenantRef; seen: number; dismissed: number; emailed: boolean }[];
}

/* ---------- 9.2 support ---------- */
export type SupportCategory = "BILLING" | "TECHNICAL" | "ACCOUNT" | "BOOKINGS" | "PAYMENTS" | "FEATURE_REQUEST" | "DATA_PRIVACY" | "OTHER";
export type SupportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SupportStatus = "NEW" | "OPEN" | "WAITING_ON_HOTEL" | "RESOLVED" | "CLOSED";
export type SlaState = "ON_TRACK" | "DUE_SOON" | "BREACHED" | "MET" | "MISSED";
export interface SupportRequest {
  id: string;
  number: string;
  tenant: TenantRef;
  property: { id: string; name: string } | null;
  openedBy: { id: string; fullName: string; email: string; role: string };
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  planCode: string;
  slaHours: number;
  firstResponseDueAt: string;
  firstRespondedAt: string | null;
  sla: SlaState;
  assignee: PlatformUserRef | null;
  context: { pageUrl: string | null; appVersion: string | null; userAgent: string | null; propertyName: string | null; userRole: string | null };
  lastMessageAt: string;
  messageCount: number;
  unread: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SupportMessage {
  id: string;
  author: { kind: "HOTEL" | "PLATFORM"; id: string; fullName: string };
  body: string;
  internal: boolean;
  attachments: Attachment[];
  createdAt: string;
}
export interface SupportRequestDetail extends SupportRequest {
  messages: SupportMessage[];
  tenantStaff: { id: string; fullName: string; role: string }[];
}
export interface SupportSummary {
  new: number;
  open: number;
  waitingOnHotel: number;
  overdue: number;
  mine: number;
  dueSoon: number;
}

/* ---------- 9.3 platform users ---------- */
export interface PlatformUserRow {
  id: string;
  email: string;
  fullName: string;
  role: PlatformRole;
  isActive: boolean;
  mfaEnabled: boolean;
  ipAllowlist: string[];
  lockedUntil: string | null;
  lastLoginAt: string | null;
  invitePending: boolean;
  inviteExpiresAt: string | null;
  createdAt: string;
  activeSessions: number;
}

/* ---------- 9.4 API usage ---------- */
export interface ApiUsageOverview {
  totals: { requests: number; errors: number; writes: number; rateLimited: number };
  byTenant: { tenant: TenantRef; keys: number; requests: number; errors: number; rateLimited: number; lastUsedAt: string | null }[];
  byDay: { date: string; requests: number; errors: number }[];
}
export interface TenantApiUsage {
  from: string;
  to: string;
  totals: { requests: number; errors: number; writes: number; rateLimited: number };
  keys: { id: string; name: string; prefix: string; environment: "LIVE" | "TEST"; requests: number; errors: number; rateLimited: number; lastUsedAt: string | null }[];
  byDay: { date: string; requests: number; errors: number; rateLimited: number }[];
}

export type { Paginated, PlatformRole };

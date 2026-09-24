/* Shapes shared with the API (BRIEF.md, API-CHANGES.md, API-M3.md). Money is integer kobo. */

export type PlanCode = "starter" | "growth" | "pro" | "enterprise" | (string & {});
export type BillingInterval = "MONTHLY" | "YEARLY";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "SUSPENDED" | "CANCELLED";
export type PlatformRole = "SUPER_ADMIN" | "OPERATIONS" | "SUPPORT" | "FINANCE" | "SALES_READONLY";

export interface Paginated<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
  nextCursor?: string | null;
}

export interface Plan {
  id?: string;
  code: PlanCode;
  name: string;
  tagline: string;
  priceMonthlyKobo: number | null;
  priceYearlyKobo: number | null;
  limits: Record<string, number>;
  features: string[];
  commissionBps: number | null;
  highlighted: boolean;
  sortOrder: number;
  isActive?: boolean;
  tenantCount?: number;
}
export type PlanPatch = Partial<
  Pick<Plan, "name" | "tagline" | "priceMonthlyKobo" | "priceYearlyKobo" | "limits" | "features" | "commissionBps" | "highlighted">
>;

export interface FeatureInfo {
  code: string;
  name: string;
  description: string;
  category: string;
}

export interface Invoice {
  id: string;
  reference: string;
  amountKobo: number;
  status: string;
  planCode: PlanCode;
  interval: BillingInterval;
  paidAt: string | null;
  createdAt: string;
}

export interface AuditItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actor: { id: string; fullName: string; email?: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/* ---------- tenants ---------- */
export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  planCode: PlanCode;
  status: SubscriptionStatus;
  rooms: number;
  staff: number;
  createdAt: string;
  trialEndsAt: string | null;
  state?: string | null;
  databaseMode?: "SHARED" | "DEDICATED" | null;
  offboarding?: { status: string; deleteAfter: string | null } | null;
}

export interface TenantSubscription {
  planCode: PlanCode;
  planName: string;
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pastDueAt: string | null;
  readOnlyAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  customPriceKobo?: number | null;
  contractStartsAt?: string | null;
  contractEndsAt?: string | null;
  suspendedReason?: string | null;
}

export interface TenantDetail extends TenantRow {
  owner: { id: string; fullName: string; email: string; phone: string | null } | null;
  properties: { id: string; name: string; slug: string; city: string | null; area: string | null; listedOnMarketplace: boolean }[];
  subscription: TenantSubscription | null;
  entitlements: { features: string[]; limits: Record<string, number>; usage: Record<string, number> };
  featureOverrides: { featureCode: string; enabled: boolean; note: string | null; updatedAt: string }[];
  invoices: Invoice[];
  recentActivity: AuditItem[];
  [key: string]: unknown;
}

/* ---------- metrics ---------- */
export interface PlatformMetrics {
  mrrKobo: number;
  arrKobo: number;
  tenantsTotal: number;
  tenantsByPlan: Record<string, number>;
  tenantsByStatus: Partial<Record<SubscriptionStatus, number>>;
  trialsEndingSoon: TenantRow[];
  newTenants30d: number;
  signupsByWeek: { week: string; count: number }[];
  marketplace?: { gmv30dKobo: number; commission30dKobo: number; receivableKobo: number; orphanedOpen: number; flaggedReviews: number };
  [key: string]: unknown;
}

/* ---------- marketplace (API-M3.md section 7) ---------- */
export type RefundStatus = "PENDING" | "PROCESSED" | "FAILED";
export type OrphanReason = "LATE_NO_INVENTORY" | "AMOUNT_MISMATCH" | "BOOKING_CANCELLED" | "DUPLICATE_PAYMENT";
export interface MarketplaceSummary {
  from: string;
  to: string;
  gmvKobo: number;
  onlineCollectedKobo: number;
  refundsKobo: number;
  commissionCollectedKobo: number;
  commissionReceivableKobo: number;
  bookings: { total: number; marketplace: number; bookingSite: number; payOnline: number; payAtHotel: number; cancelled: number; expiredHolds: number };
  orphanedOpen: number;
  byHotel: {
    tenantId: string;
    hotelName: string;
    slug: string;
    planCode: string;
    payoutReady: boolean;
    bookings: number;
    gmvKobo: number;
    commissionCollectedKobo: number;
    commissionReceivableKobo: number;
  }[];
  byDay: { date: string; bookings: number; gmvKobo: number; commissionKobo: number }[];
}
export interface Receivables {
  month: string;
  totalDueKobo: number;
  items: {
    tenantId: string;
    hotelName: string;
    slug: string;
    bookings: number;
    accruedKobo: number;
    reversedKobo: number;
    dueKobo: number;
    settledKobo: number;
    settledAt: string | null;
  }[];
}
export interface OrphanedPayment {
  id: string;
  reference: string;
  tenantId: string;
  hotelName: string;
  reservationId: string;
  reservationCode: string;
  guestName: string;
  guestPhoneMasked: string;
  amountKobo: number;
  orphanReason: OrphanReason;
  paidAt: string | null;
  createdAt: string;
  refund: { id: string; amountKobo: number; status: RefundStatus; error: string | null; processedAt: string | null } | null;
}
export type ReviewStatus = "PUBLISHED" | "FLAGGED" | "HIDDEN";
export type ModerationReason = "ABUSE" | "PERSONAL_DATA" | "OFF_TOPIC" | "SPAM" | "OTHER";
export interface ModerationReview {
  id: string;
  tenantId: string;
  hotelName: string;
  slug: string;
  overall: number;
  cleanliness: number;
  service: number;
  location: number;
  value: number;
  title: string | null;
  body: string;
  stayMonth: string;
  travellerType: string;
  displayName: string;
  createdAt: string;
  hotelReply: { body: string; repliedAt: string } | null;
  status: ReviewStatus;
  reservationId: string;
  reservationCode: string;
  guestName: string;
  flaggedReason: string | null;
  flaggedAt: string | null;
  moderation: { reason: ModerationReason; note: string | null; at: string } | null;
}

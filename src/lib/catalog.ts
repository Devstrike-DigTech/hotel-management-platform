import type { FeatureInfo, PlatformRole, SubscriptionStatus } from "./api/types";

export type Tone = "neutral" | "brass" | "palm" | "adire" | "ochre" | "danger";

/* ---------------- Subscription status ---------------- */
export const SUB_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone; color: string }> = {
  TRIALING: { label: "Trial", tone: "brass", color: "var(--brass)" },
  ACTIVE: { label: "Active", tone: "palm", color: "var(--palm)" },
  PAST_DUE: { label: "Past due", tone: "ochre", color: "var(--ochre-bar)" },
  READ_ONLY: { label: "Read-only", tone: "danger", color: "var(--laterite)" },
  SUSPENDED: { label: "Suspended", tone: "danger", color: "var(--laterite)" },
  CANCELLED: { label: "Cancelled", tone: "neutral", color: "var(--ink-faint)" },
};
export const SUB_STATUS_ORDER: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "READ_ONLY", "SUSPENDED", "CANCELLED"];

/* ---------------- Plans ---------------- */
export const PLAN_ORDER = ["starter", "growth", "pro", "enterprise"];
export const PLAN_NAMES: Record<string, string> = { starter: "Starter", growth: "Growth", pro: "Pro", enterprise: "Enterprise" };
export const planName = (code: string | null | undefined) => (code ? (PLAN_NAMES[code] ?? code) : "-");
export const planTone = (code: string) =>
  ({ starter: "var(--plan-starter)", growth: "var(--plan-growth)", pro: "var(--plan-pro)", enterprise: "var(--plan-enterprise)" })[code] ??
  "var(--ink-faint)";
/** First-response SLA per plan (hours), per the M6 brief. */
export const SLA_HOURS: Record<string, number> = { starter: 48, growth: 24, pro: 8, enterprise: 2 };

/* ---------------- Features ---------------- */
export const FEATURE_CATEGORIES = ["Operations", "Revenue", "Guests", "Growth", "Platform"];
export const FALLBACK_FEATURES: FeatureInfo[] = [
  { code: "front_desk", name: "Front desk", description: "Check-ins, check-outs and the live room board.", category: "Operations" },
  { code: "reservations", name: "Reservations", description: "Take and manage bookings across dates.", category: "Operations" },
  { code: "guest_register", name: "Guest register", description: "A digital guest book that satisfies inspectors.", category: "Guests" },
  { code: "invoicing", name: "Invoicing", description: "Folios and receipts in naira.", category: "Revenue" },
  { code: "hourly_bookings", name: "Hourly bookings", description: "Sell short stays by the hour.", category: "Revenue" },
  { code: "offline_mode", name: "Offline mode", description: "Keep the desk running when the network drops.", category: "Operations" },
  { code: "marketplace_listing", name: "Marketplace listing", description: "Be discovered by guests on the marketplace.", category: "Growth" },
  { code: "booking_site_branding", name: "Booking site branding", description: "Colours and logo on the booking site.", category: "Growth" },
  { code: "custom_domain", name: "Custom domain", description: "Booking site on the hotel's own domain.", category: "Growth" },
  { code: "white_label", name: "White label", description: "No platform branding anywhere.", category: "Platform" },
  { code: "revenue_guard_basic", name: "Revenue Guard (basic)", description: "Flags voided payments and odd discounts.", category: "Revenue" },
  { code: "revenue_guard_full", name: "Revenue Guard (full)", description: "Night audit reconciliation and leakage alerts.", category: "Revenue" },
  { code: "owner_whatsapp_alerts", name: "Owner WhatsApp alerts", description: "Takings and red flags on the owner's phone.", category: "Revenue" },
  { code: "housekeeping", name: "Housekeeping", description: "Assign, track and inspect cleaning.", category: "Operations" },
  { code: "maintenance", name: "Maintenance", description: "Log faults, block rooms, track fixes.", category: "Operations" },
  { code: "custom_roles", name: "Custom roles", description: "Fine-grained staff permissions.", category: "Platform" },
  { code: "audit_export", name: "Audit export", description: "Export the full audit trail.", category: "Platform" },
  { code: "promotions", name: "Promotions", description: "Promo codes and seasonal offers.", category: "Growth" },
  { code: "pos", name: "Point of sale", description: "Outlets posting to the room.", category: "Revenue" },
  { code: "channel_manager", name: "Channel manager", description: "Rates and availability synced with OTAs.", category: "Growth" },
  { code: "dynamic_pricing", name: "Dynamic pricing", description: "Rates that follow demand.", category: "Revenue" },
  { code: "whatsapp_messaging", name: "WhatsApp messaging", description: "Guest messages on WhatsApp.", category: "Guests" },
  { code: "sms_messaging", name: "SMS messaging", description: "Confirmations by SMS.", category: "Guests" },
  { code: "loyalty", name: "Loyalty", description: "Points and perks for returning guests.", category: "Guests" },
  { code: "multi_property", name: "Multi-property", description: "Several hotels in one account.", category: "Platform" },
  { code: "api_access", name: "API access", description: "Partner API keys and webhooks.", category: "Platform" },
  { code: "dedicated_database", name: "Dedicated database", description: "Tenant data in an isolated database.", category: "Platform" },
];
export const featureName = (code: string, list?: FeatureInfo[]) =>
  list?.find((f) => f.code === code)?.name ?? FALLBACK_FEATURES.find((f) => f.code === code)?.name ?? code.replace(/_/g, " ");

export const LIMIT_LABEL: Record<string, string> = { max_rooms: "Rooms", max_staff: "Staff seats", max_properties: "Properties" };

/* ---------------- Platform roles and permissions ---------------- */
export const PLATFORM_ROLES: Record<PlatformRole, { label: string; description: string }> = {
  SUPER_ADMIN: { label: "Super admin", description: "Everything, including people and dedicated databases" },
  OPERATIONS: { label: "Operations", description: "Tenants, announcements, system health and provisioning" },
  SUPPORT: { label: "Support", description: "Support desk, impersonation, reviews and system health" },
  FINANCE: { label: "Finance", description: "Billing, commission, coupons and orphaned payments" },
  SALES_READONLY: { label: "Sales (read-only)", description: "Reads tenants, plans and the overview" },
};
export const PLATFORM_ROLE_ORDER: PlatformRole[] = ["SUPER_ADMIN", "OPERATIONS", "SUPPORT", "FINANCE", "SALES_READONLY"];

export const PERMISSIONS = [
  "tenants.view",
  "tenants.manage",
  "plans.manage",
  "billing.view",
  "billing.manage",
  "commission.manage",
  "reviews.moderate",
  "impersonate",
  "announcements.manage",
  "support.handle",
  "dedicated_db.manage",
  "platform_users.manage",
  "audit.view",
  "system.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  "tenants.view": "View tenants",
  "tenants.manage": "Manage tenants",
  "plans.manage": "Edit plans and coupons",
  "billing.view": "View billing",
  "billing.manage": "Manage billing",
  "commission.manage": "Settle commission",
  "reviews.moderate": "Moderate reviews",
  impersonate: "Impersonate staff",
  "announcements.manage": "Send announcements",
  "support.handle": "Handle support",
  "dedicated_db.manage": "Dedicated databases",
  "platform_users.manage": "Manage console users",
  "audit.view": "Read the audit log",
  "system.view": "System health",
};

/**
 * Fallback matrix, used only when the API does not send `permissions` with the
 * signed-in user. The API enforces its own; this only shapes the UI.
 */
export const ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  OPERATIONS: [
    "tenants.view",
    "tenants.manage",
    "billing.view",
    "reviews.moderate",
    "impersonate",
    "announcements.manage",
    "support.handle",
    "dedicated_db.manage",
    "audit.view",
    "system.view",
  ],
  SUPPORT: ["tenants.view", "impersonate", "support.handle", "reviews.moderate", "system.view"],
  FINANCE: ["tenants.view", "billing.view", "billing.manage", "commission.manage", "plans.manage", "audit.view"],
  SALES_READONLY: ["tenants.view", "billing.view"],
};

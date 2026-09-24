import {
  Buildings,
  ChartLineUp,
  ClockCounterClockwise,
  Database,
  Gauge,
  Lifebuoy,
  Megaphone,
  Receipt,
  ShieldCheck,
  Stack,
  Star,
  Storefront,
  Ticket,
  UserCircleGear,
  UserSwitch,
  WarningDiamond,
  Plugs,
  type Icon,
} from "@phosphor-icons/react";
import type { Permission } from "./catalog";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  perm?: Permission | Permission[];
  /** key into the shell's badge counts */
  badge?: "support" | "flagged" | "orphaned" | "failedJobs";
  keywords?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { href: "/", label: "Overview", icon: ChartLineUp, keywords: "home mrr arr revenue metrics" },
      { href: "/tenants", label: "Tenants", icon: Buildings, perm: "tenants.view", keywords: "hotels customers accounts" },
      { href: "/support", label: "Support desk", icon: Lifebuoy, perm: "support.handle", badge: "support", keywords: "tickets requests inbox sla" },
      { href: "/impersonation", label: "Impersonation", icon: UserSwitch, perm: "impersonate", keywords: "view as support session" },
      { href: "/announcements", label: "Announcements", icon: Megaphone, perm: "announcements.manage", keywords: "broadcast banner email" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/plans", label: "Plans", icon: Stack, perm: ["plans.manage", "billing.view"], keywords: "pricing tiers features limits" },
      { href: "/coupons", label: "Coupons", icon: Ticket, perm: ["plans.manage", "billing.manage"], keywords: "discount promo subscription" },
      { href: "/marketplace", label: "Marketplace", icon: Storefront, perm: ["billing.view", "commission.manage"], keywords: "gmv commission settle receivables" },
      { href: "/payments/orphaned", label: "Orphaned payments", icon: Receipt, perm: ["billing.view", "commission.manage"], badge: "orphaned", keywords: "refund paystack" },
    ],
  },
  {
    label: "Trust",
    items: [{ href: "/reviews", label: "Reviews", icon: Star, perm: "reviews.moderate", badge: "flagged", keywords: "moderation flagged hide" }],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/system", label: "System health", icon: Gauge, perm: "system.view", badge: "failedJobs", keywords: "queues jobs webhooks cron failures" },
      { href: "/databases", label: "Databases", icon: Database, perm: ["dedicated_db.manage", "system.view"], keywords: "dedicated provisioning migrate" },
      { href: "/api-usage", label: "API usage", icon: Plugs, perm: ["tenants.view", "system.view"], keywords: "partner keys requests rate" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/users", label: "Console users", icon: UserCircleGear, perm: "platform_users.manage", keywords: "team staff roles invite 2fa" },
      { href: "/audit", label: "Audit log", icon: ClockCounterClockwise, perm: "audit.view", keywords: "history export actions" },
    ],
  },
];

export const ACCOUNT_ITEM: NavItem = { href: "/account", label: "Account and security", icon: ShieldCheck, keywords: "sessions 2fa recovery codes password" };
export const DANGER_ICON = WarningDiamond;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

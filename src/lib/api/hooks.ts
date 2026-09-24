"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  announcementsApi,
  auditApi,
  authApi,
  couponsApi,
  databasesApi,
  impersonationApi,
  marketApi,
  overviewApi,
  plansApi,
  supportApi,
  systemApi,
  tenantsApi,
  usageApi,
  usersApi,
} from "./endpoints";

type Q = Record<string, string | number | boolean | null | undefined>;

export const qk = {
  overview: ["platform", "overview"] as const,
  features: ["public", "features"] as const,
  tenants: (q: Q) => ["platform", "tenants", q] as const,
  tenantsAll: ["platform", "tenants"] as const,
  tenant: (id: string) => ["platform", "tenant", id] as const,
  tenantUsage: (id: string) => ["platform", "tenant", id, "api-usage"] as const,
  tenantExports: (id: string) => ["platform", "tenant", id, "exports"] as const,
  plans: ["platform", "plans"] as const,
  coupons: ["platform", "coupons"] as const,
  couponRedemptions: (id: string) => ["platform", "coupons", id, "redemptions"] as const,
  market: (f?: string, t?: string) => ["platform", "marketplace", f ?? "", t ?? ""] as const,
  receivables: (m?: string) => ["platform", "receivables", m ?? ""] as const,
  orphaned: (q: Q) => ["platform", "orphaned", q] as const,
  reviews: (q: Q) => ["platform", "reviews", q] as const,
  impersonations: (q: Q) => ["platform", "impersonations", q] as const,
  impersonation: (id: string) => ["platform", "impersonation", id] as const,
  health: ["platform", "health"] as const,
  failed: (q: string) => ["platform", "health", "failed", q] as const,
  databases: ["platform", "databases"] as const,
  provisioning: (id: string) => ["platform", "provisioning", id] as const,
  announcements: (s?: string) => ["platform", "announcements", s ?? ""] as const,
  announcementStats: (id: string) => ["platform", "announcement-stats", id] as const,
  support: (q: Q) => ["platform", "support", q] as const,
  supportAll: ["platform", "support"] as const,
  supportItem: (id: string) => ["platform", "support-item", id] as const,
  supportSummary: ["platform", "support-summary"] as const,
  users: ["platform", "users"] as const,
  userSessions: (id: string) => ["platform", "users", id, "sessions"] as const,
  sessions: ["platform", "my-sessions"] as const,
  usage: (q: Q) => ["platform", "api-usage", q] as const,
  audit: (q: Q) => ["platform", "audit", q] as const,
  offboardings: ["platform", "offboardings"] as const,
};

const opt = { placeholderData: keepPreviousData };

export const useOverview = () => useQuery({ queryKey: qk.overview, queryFn: overviewApi.overview, refetchInterval: 60_000 });
export const useFeatures = () => useQuery({ queryKey: qk.features, queryFn: overviewApi.features, staleTime: 10 * 60_000 });
export const useTenants = (q: Q, enabled = true) => useQuery({ queryKey: qk.tenants(q), queryFn: () => tenantsApi.list(q), enabled, ...opt });
export const useTenant = (id: string) => useQuery({ queryKey: qk.tenant(id), queryFn: () => tenantsApi.get(id) });
export const useTenantUsage = (id: string, enabled = true) => useQuery({ queryKey: qk.tenantUsage(id), queryFn: () => tenantsApi.apiUsage(id), enabled });
export const useTenantExports = (id: string) =>
  useQuery({
    queryKey: qk.tenantExports(id),
    queryFn: () => tenantsApi.exports(id),
    refetchInterval: (q) => (q.state.data?.some((e) => e.status === "QUEUED" || e.status === "RUNNING") ? 2000 : false),
  });
export const usePlans = (enabled = true) => useQuery({ queryKey: qk.plans, queryFn: plansApi.list, enabled });
export const useCoupons = () => useQuery({ queryKey: qk.coupons, queryFn: () => couponsApi.list() });
export const useCouponRedemptions = (id: string | null) =>
  useQuery({ queryKey: qk.couponRedemptions(id ?? ""), queryFn: () => couponsApi.redemptions(id!), enabled: !!id });
export const useMarketplace = (from?: string, to?: string) => useQuery({ queryKey: qk.market(from, to), queryFn: () => marketApi.summary(from, to), ...opt });
export const useReceivables = (month?: string) => useQuery({ queryKey: qk.receivables(month), queryFn: () => marketApi.receivables(month), ...opt });
export const useOrphaned = (q: Q) => useQuery({ queryKey: qk.orphaned(q), queryFn: () => marketApi.orphaned(q), ...opt });
export const useReviews = (q: Q) => useQuery({ queryKey: qk.reviews(q), queryFn: () => marketApi.reviews(q), ...opt });
export const useImpersonations = (q: Q, poll = false) =>
  useQuery({ queryKey: qk.impersonations(q), queryFn: () => impersonationApi.list(q), refetchInterval: poll ? 15_000 : false, ...opt });
export const useImpersonation = (id: string | null) =>
  useQuery({ queryKey: qk.impersonation(id ?? ""), queryFn: () => impersonationApi.get(id!), enabled: !!id, refetchInterval: 10_000 });
export const useHealth = (enabled = true) => useQuery({ queryKey: qk.health, queryFn: systemApi.health, refetchInterval: 30_000, enabled });
export const useFailedJobs = (queue: string | null) => useQuery({ queryKey: qk.failed(queue ?? ""), queryFn: () => systemApi.failed(queue!), enabled: !!queue });
export const useDatabases = () => useQuery({ queryKey: qk.databases, queryFn: databasesApi.list, refetchInterval: 15_000 });
export const useProvisioning = (id: string | null, live: boolean) =>
  useQuery({ queryKey: qk.provisioning(id ?? ""), queryFn: () => databasesApi.provisioning(id!), enabled: !!id, refetchInterval: live ? 1200 : false });
export const useAnnouncements = (state?: string) => useQuery({ queryKey: qk.announcements(state), queryFn: () => announcementsApi.list(state) });
export const useAnnouncementStats = (id: string | null) =>
  useQuery({ queryKey: qk.announcementStats(id ?? ""), queryFn: () => announcementsApi.stats(id!), enabled: !!id });
export const useSupport = (q: Q) => useQuery({ queryKey: qk.support(q), queryFn: () => supportApi.list(q), refetchInterval: 30_000, ...opt });
export const useSupportItem = (id: string | null) =>
  useQuery({ queryKey: qk.supportItem(id ?? ""), queryFn: () => supportApi.get(id!), enabled: !!id, refetchInterval: 20_000 });
export const useSupportSummary = (enabled = true) => useQuery({ queryKey: qk.supportSummary, queryFn: supportApi.summary, refetchInterval: 30_000, enabled });
export const useUsers = (enabled = true) => useQuery({ queryKey: qk.users, queryFn: usersApi.list, enabled });
export const useUserSessions = (id: string | null) => useQuery({ queryKey: qk.userSessions(id ?? ""), queryFn: () => usersApi.sessions(id!), enabled: !!id });
export const useMySessions = () => useQuery({ queryKey: qk.sessions, queryFn: authApi.sessions });
export const useApiUsage = (q: Q) => useQuery({ queryKey: qk.usage(q), queryFn: () => usageApi.overview(q), ...opt });
export const useAudit = (q: Q) => useQuery({ queryKey: qk.audit(q), queryFn: () => auditApi.list(q), ...opt });
export const useOffboardings = () => useQuery({ queryKey: qk.offboardings, queryFn: () => tenantsApi.offboardings() });

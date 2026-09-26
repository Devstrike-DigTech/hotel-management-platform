"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Paginated } from "./types";
import type { ReviewItem, ReviewPage, ReviewStatus, TenantConciergeRow } from "./types-m8";

type Q = Record<string, string | number | boolean | null | undefined>;

export const conciergeApi = {
  reviews: (q: { status?: ReviewStatus; tenantId?: string; q?: string; page?: number; pageSize?: number }) => api<ReviewPage>("platform/concierge/reviews", { query: q as Q }),
  approve: (tenantId: string, serviceId: string, note?: string) => api<ReviewItem>(`platform/concierge/tenants/${tenantId}/services/${serviceId}/approve`, { method: "POST", body: note ? { note } : {} }),
  reject: (tenantId: string, serviceId: string, reason: string) => api<ReviewItem>(`platform/concierge/tenants/${tenantId}/services/${serviceId}/reject`, { method: "POST", body: { reason } }),
  hide: (tenantId: string, serviceId: string, reason: string) => api<ReviewItem>(`platform/concierge/tenants/${tenantId}/services/${serviceId}/hide`, { method: "POST", body: { reason } }),
  tenants: (q: { suspended?: boolean; q?: string; page?: number; pageSize?: number }) => api<Paginated<TenantConciergeRow>>("platform/concierge/tenants", { query: q as Q }),
  tenant: (id: string) => api<TenantConciergeRow & { services: ReviewItem[] }>(`platform/concierge/tenants/${id}`),
  suspend: (id: string, reason: string) => api<TenantConciergeRow>(`platform/concierge/tenants/${id}/suspend`, { method: "POST", body: { reason } }),
  reinstate: (id: string, note?: string) => api<TenantConciergeRow>(`platform/concierge/tenants/${id}/reinstate`, { method: "POST", body: note ? { note } : {} }),
};

export const qkc = {
  all: ["platform", "concierge"] as const,
  reviews: (q: object) => ["platform", "concierge", "reviews", q] as const,
  tenants: (q: object) => ["platform", "concierge", "tenants", q] as const,
  tenant: (id: string) => ["platform", "concierge", "tenant", id] as const,
};

export const useConciergeReviews = (q: Parameters<typeof conciergeApi.reviews>[0], enabled = true) =>
  useQuery({ queryKey: qkc.reviews(q), queryFn: () => conciergeApi.reviews(q), enabled, refetchInterval: 60_000 });
export const useConciergeTenants = (q: Parameters<typeof conciergeApi.tenants>[0], enabled = true) => useQuery({ queryKey: qkc.tenants(q), queryFn: () => conciergeApi.tenants(q), enabled });
export const useConciergeTenant = (id: string | null) => useQuery({ queryKey: qkc.tenant(id ?? ""), queryFn: () => conciergeApi.tenant(id!), enabled: !!id });

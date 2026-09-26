"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { PlatformMetrics } from "@/lib/api/types";
import { useHealth, useSupportSummary } from "@/lib/api/hooks";
import type { NavItem } from "@/lib/nav";
import { useCan } from "@/lib/session";
import { useConciergeReviews } from "@/lib/api/concierge";

export type BadgeKey = NonNullable<NavItem["badge"]>;

/** Counts shown against nav items; each only fetched when the person can see that section. */
export function useBadgeCounts(): Partial<Record<BadgeKey, number>> {
  const can = useCan();
  const support = useSupportSummary(can("support.handle"));
  const health = useHealth(can("system.view"));
  const concierge = useConciergeReviews({ status: "PENDING_REVIEW", pageSize: 1 }, can("concierge.review"));
  const metrics = useQuery({
    queryKey: ["platform", "metrics"],
    queryFn: () => api<PlatformMetrics>("platform/metrics"),
    enabled: can("tenants.view"),
    refetchInterval: 60_000,
  });
  return {
    support: support.data ? support.data.new + support.data.overdue : undefined,
    failedJobs: health.data?.summary.failedJobs,
    flagged: can("reviews.moderate") ? metrics.data?.marketplace?.flaggedReviews : undefined,
    orphaned: can("billing.view") ? metrics.data?.marketplace?.orphanedOpen : undefined,
    concierge: concierge.data?.counts.pending,
  };
}

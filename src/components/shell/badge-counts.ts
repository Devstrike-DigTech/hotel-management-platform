"use client";

import type { NavItem } from "@/lib/nav";

export type BadgeKey = NonNullable<NavItem["badge"]>;

/** Counts shown against nav items. Filled from the overview queries once wired. */
export function useBadgeCounts(): Partial<Record<BadgeKey, number>> {
  return {};
}

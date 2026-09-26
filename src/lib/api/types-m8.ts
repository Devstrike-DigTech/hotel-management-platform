/** The M8 platform contract (API-M8.md section 11): concierge review and tenant suspension. */

export type ConciergeCategory =
  | "WELLNESS"
  | "DINING"
  | "ROMANCE_AND_CELEBRATION"
  | "GROOMING"
  | "TRANSPORT"
  | "SECURITY"
  | "TOURS_AND_EXPERIENCES"
  | "FAMILY"
  | "SHOPPING"
  | "PHOTOGRAPHY"
  | "EVENTS"
  | "NIGHTLIFE_RESERVATIONS"
  | "BUSINESS"
  | "LAUNDRY_EXPRESS"
  | "OTHER";
export type ServicePricing = "FIXED" | "FROM" | "PER_HOUR" | "PER_PERSON" | "FREE";
export type ReviewStatus = "LIVE" | "PENDING_REVIEW" | "REJECTED" | "HIDDEN";

export interface ReviewItem {
  serviceId: string;
  tenant: { id: string; name: string; slug: string };
  property: { id: string; name: string; slug: string };
  name: string;
  description: string;
  category: ConciergeCategory;
  pricing: ServicePricing;
  priceKobo: number | null;
  variants: string[];
  questions: string[];
  flaggedTerms: string[];
  matches: { term: string; category: string; excerpt: string }[];
  reviewStatus: ReviewStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reason: string | null;
  active: boolean;
  tenantSuspended: boolean;
  updatedAt: string;
}

export interface ReviewPage {
  items: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: { pending: number; rejected: number; hidden: number };
}

export interface TenantConciergeRow {
  tenant: { id: string; name: string; slug: string; planCode: string | null };
  feature: boolean;
  aupAcceptedAt: string | null;
  aupVersion: string | null;
  enabledProperties: number;
  services: { live: number; pending: number; rejected: number; hidden: number };
  requests30d: number;
  flaggedRequests30d: number;
  suspended: { since: string; reason: string; by: string } | null;
}

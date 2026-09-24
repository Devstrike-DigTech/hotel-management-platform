import type { Metadata } from "next";
import { TenantDetailView } from "@/components/tenants/tenant-detail";

export const metadata: Metadata = { title: "Tenant" };

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TenantDetailView id={id} />;
}

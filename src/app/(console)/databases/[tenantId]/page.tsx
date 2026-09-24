import type { Metadata } from "next";
import { Suspense } from "react";
import { ProvisioningView } from "@/components/databases/provisioning-view";

export const metadata: Metadata = { title: "Dedicated database" };

export default async function DatabasePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <Suspense fallback={null}>
      <ProvisioningView tenantId={tenantId} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { TenantsView } from "@/components/tenants/tenants-view";

export const metadata: Metadata = { title: "Tenants" };

export default function TenantsPage() {
  return <TenantsView />;
}

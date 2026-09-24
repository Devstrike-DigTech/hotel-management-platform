import type { Metadata } from "next";
import { CreateTenantView } from "@/components/tenants/create-tenant";

export const metadata: Metadata = { title: "New enterprise tenant" };

export default function NewTenantPage() {
  return <CreateTenantView />;
}

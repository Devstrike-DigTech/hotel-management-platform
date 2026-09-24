import type { Metadata } from "next";
import { OffboardView } from "@/components/tenants/offboarding";

export const metadata: Metadata = { title: "Offboard tenant" };

export default async function OffboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OffboardView id={id} />;
}

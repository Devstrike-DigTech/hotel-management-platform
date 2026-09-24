import type { Metadata } from "next";
import { ImpersonationView } from "@/components/impersonation/impersonation-view";

export const metadata: Metadata = { title: "Impersonation" };

export default function Page() {
  return <ImpersonationView />;
}

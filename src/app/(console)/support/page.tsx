import type { Metadata } from "next";
import { SupportView } from "@/components/support/support-view";

export const metadata: Metadata = { title: "Support desk" };

export default function Page() {
  return <SupportView />;
}

import type { Metadata } from "next";
import { ApiUsageView } from "@/components/usage/api-usage-view";

export const metadata: Metadata = { title: "API usage" };

export default function Page() {
  return <ApiUsageView />;
}

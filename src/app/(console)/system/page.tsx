import type { Metadata } from "next";
import { SystemView } from "@/components/system/system-view";

export const metadata: Metadata = { title: "System health" };

export default function Page() {
  return <SystemView />;
}

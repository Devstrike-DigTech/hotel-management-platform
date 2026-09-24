import type { Metadata } from "next";
import { OrphanedView } from "@/components/money/orphaned-view";

export const metadata: Metadata = { title: "Orphaned payments" };

export default function Page() {
  return <OrphanedView />;
}

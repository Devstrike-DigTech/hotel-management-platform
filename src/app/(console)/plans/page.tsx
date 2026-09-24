import type { Metadata } from "next";
import { PlansEditor } from "@/components/plans/plans-editor";

export const metadata: Metadata = { title: "Plans" };

export default function Page() {
  return <PlansEditor />;
}

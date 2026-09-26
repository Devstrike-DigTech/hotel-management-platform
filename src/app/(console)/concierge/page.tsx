import type { Metadata } from "next";
import { ConciergeReviewView } from "@/components/concierge/concierge-review";

export const metadata: Metadata = { title: "Concierge review" };

export default function Page() {
  return <ConciergeReviewView />;
}

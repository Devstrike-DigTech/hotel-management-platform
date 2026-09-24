import type { Metadata } from "next";
import { ModerationView } from "@/components/reviews/moderation-view";

export const metadata: Metadata = { title: "Reviews" };

export default function Page() {
  return <ModerationView />;
}

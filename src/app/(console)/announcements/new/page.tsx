import type { Metadata } from "next";
import { AnnouncementComposerPage } from "@/components/announcements/composer";

export const metadata: Metadata = { title: "New announcement" };

export default function Page() {
  return <AnnouncementComposerPage />;
}

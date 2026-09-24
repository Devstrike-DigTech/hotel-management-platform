import type { Metadata } from "next";
import { AnnouncementsView } from "@/components/announcements/announcements-view";

export const metadata: Metadata = { title: "Announcements" };

export default function Page() {
  return <AnnouncementsView />;
}

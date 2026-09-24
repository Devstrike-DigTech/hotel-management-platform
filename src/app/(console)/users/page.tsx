import type { Metadata } from "next";
import { UsersView } from "@/components/users/users-view";

export const metadata: Metadata = { title: "Console users" };

export default function Page() {
  return <UsersView />;
}

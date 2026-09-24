import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = { title: "Account and security" };

export default function Page() {
  return <AccountView />;
}

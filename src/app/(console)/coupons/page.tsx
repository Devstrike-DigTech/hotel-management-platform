import type { Metadata } from "next";
import { CouponsView } from "@/components/coupons/coupons-view";

export const metadata: Metadata = { title: "Coupons" };

export default function Page() {
  return <CouponsView />;
}

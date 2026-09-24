"use client";

import { Receipt } from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/primitives";
import { Gate } from "@/components/ui/kit";
import { Orphaned } from "./marketplace-view";

export function OrphanedView() {
  return (
    <Gate perm={["billing.view", "commission.manage"]}>
      <PageHeader
        eyebrow={
          <>
            <Receipt size={14} weight="duotone" /> Money at risk
          </>
        }
        title={
          <>
            Payments <em>without a home</em>.
          </>
        }
        description="Guest money that reached Paystack but could not be applied to a booking. Each one is refunded automatically; a failed refund waits here for a retry."
      />
      <Orphaned />
    </Gate>
  );
}

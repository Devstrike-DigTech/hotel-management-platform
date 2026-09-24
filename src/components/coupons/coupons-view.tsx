"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Ticket, UsersThree } from "@phosphor-icons/react";
import { couponsApi } from "@/lib/api/endpoints";
import { qk, useCouponRedemptions, useCoupons } from "@/lib/api/hooks";
import type { BillingInterval } from "@/lib/api/types";
import type { Coupon } from "@/lib/api/types-m6";
import { PLAN_ORDER, planName } from "@/lib/catalog";
import { formatDate, naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { useCan } from "@/lib/session";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, Input, Switch } from "@/components/ui/form";
import { Sheet } from "@/components/ui/overlay";
import { EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { Gate } from "@/components/ui/kit";

export function CouponsView() {
  return (
    <Gate perm="billing.view">
      <View />
    </Gate>
  );
}

function discount(c: Pick<Coupon, "percentOff" | "amountOffKobo">) {
  return c.percentOff ? `${c.percentOff}%` : naira(c.amountOffKobo);
}
function durationText(m: number | null) {
  return m == null ? "forever" : m === 1 ? "first month" : `first ${m} months`;
}

function View() {
  const can = useCan();
  const list = useCoupons();
  const [creating, setCreating] = useState(false);
  const [redeemed, setRedeemed] = useState<Coupon | null>(null);
  const items = list.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Ticket size={14} weight="duotone" /> Coupons
          </>
        }
        title={
          <>
            Discounts on <em>the subscription</em>.
          </>
        }
        description="Codes hotels enter at checkout, or that you apply to a tenant. Terms are fixed once someone has used a code; you can still pause it or change its limits."
        actions={
          can("billing.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={15} weight="bold" /> New coupon
            </Button>
          )
        }
      />
      {list.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : list.isError ? (
        <Panel>
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        </Panel>
      ) : !items.length ? (
        <Panel>
          <EmptyState glyph="dots" title="No coupons yet" />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((c) => (
            <Stub key={c.id} c={c} onRedemptions={() => setRedeemed(c)} />
          ))}
        </div>
      )}
      <CreateSheet open={creating} onOpenChange={setCreating} />
      <RedemptionsSheet c={redeemed} onClose={() => setRedeemed(null)} />
    </>
  );
}

/** A coupon drawn as a ticket stub: perforation, the code in mono, the terms beside it. */
function Stub({ c, onRedemptions }: { c: Coupon; onRedemptions: () => void }) {
  const qc = useQueryClient();
  const can = useCan();
  const now = useNow(60_000);
  const expired = !!c.validUntil && new Date(c.validUntil).getTime() < now;
  const full = c.maxRedemptions != null && c.redemptions >= c.maxRedemptions;
  const live = c.active && !expired && !full;
  const toggle = useMutation({
    mutationFn: (active: boolean) => couponsApi.update(c.id, { active }),
    onSuccess: (_d, active) => {
      toast.success(active ? "Coupon on" : "Coupon paused", c.code);
      void qc.invalidateQueries({ queryKey: qk.coupons });
    },
    meta: { errorTitle: "Coupon not changed" },
  });
  return (
    <article className={cn("relative flex overflow-hidden rounded-lg border bg-surface", live ? "border-line" : "border-line opacity-75")} data-testid="coupon">
      <div className={cn("flex w-[132px] shrink-0 flex-col items-center justify-center gap-1 border-r-2 border-dashed px-3 py-5 text-center", live ? "border-line-strong bg-adire-wash/60" : "border-line bg-surface-2")}>
        <span className={cn("figure text-[30px] leading-none", live ? "text-adire" : "text-ink-muted")}>{discount(c)}</span>
        <span className="text-[11.5px] text-ink-muted">off, {durationText(c.durationMonths)}</span>
      </div>
      <span aria-hidden className="absolute left-[126px] top-[-7px] h-3.5 w-3.5 rounded-full border border-line bg-paper" />
      <span aria-hidden className="absolute bottom-[-7px] left-[126px] h-3.5 w-3.5 rounded-full border border-line bg-paper" />
      <div className="min-w-0 flex-1 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-[16px] tracking-[0.1em] text-ink">{c.code}</span>
          {can("billing.manage") && <Switch ariaLabel={`${c.code} active`} checked={c.active} onChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} />}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-muted">{c.name}</p>
        <p className="mt-2 text-[12px] text-ink-muted">
          {c.planCodes.length ? c.planCodes.map(planName).join(", ") : "Any paid plan"} &middot; {c.intervals.length ? c.intervals.map((i) => (i === "MONTHLY" ? "monthly" : "yearly")).join(", ") : "any billing"}
        </p>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[11.5px]">
            <button onClick={onRedemptions} className="inline-flex items-center gap-1 text-adire hover:underline">
              <UsersThree size={12} /> {c.redemptions} used
            </button>
            <span className="font-mono text-ink-faint">{c.maxRedemptions != null ? `of ${c.maxRedemptions}` : "no cap"}</span>
          </div>
          {c.maxRedemptions != null && (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className={cn("h-full rounded-full", full ? "bg-ochre-bar" : "bg-adire-soft")} style={{ width: `${Math.min(100, (c.redemptions / c.maxRedemptions) * 100)}%`, background: full ? "var(--ochre-bar)" : undefined }} />
            </div>
          )}
        </div>
        <p className={cn("mt-2 font-mono text-[11px]", expired ? "text-laterite" : "text-ink-faint")}>
          {c.validUntil ? `${expired ? "expired" : "until"} ${formatDate(c.validUntil)}` : "no end date"}
          {full && <span className="ml-2 font-sans text-ochre">fully used</span>}
        </p>
      </div>
    </article>
  );
}

function CreateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const blank = { code: "", name: "", kind: "percent" as "percent" | "amount", value: "", months: "3", forever: false, plans: [] as string[], intervals: [] as BillingInterval[], max: "", until: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const valueNum = Number(f.value);
  const valid = /^[A-Z0-9]{3,32}$/.test(f.code) && f.name.trim() && valueNum > 0 && (f.kind === "amount" || valueNum <= 100) && (f.forever || Number(f.months) > 0);
  const create = useMutation({
    mutationFn: () =>
      couponsApi.create({
        code: f.code,
        name: f.name.trim(),
        percentOff: f.kind === "percent" ? valueNum : null,
        amountOffKobo: f.kind === "amount" ? valueNum * 100 : null,
        durationMonths: f.forever ? null : Number(f.months),
        planCodes: f.plans,
        intervals: f.intervals,
        maxRedemptions: f.max ? Number(f.max) : null,
        validUntil: f.until ? new Date(`${f.until}T23:59:00+01:00`).toISOString() : null,
        active: true,
      }),
    onSuccess: (c) => {
      toast.success("Coupon created", c.code);
      void qc.invalidateQueries({ queryKey: qk.coupons });
      setF(blank);
      onOpenChange(false);
    },
    meta: { errorTitle: "Coupon not created" },
  });
  const paid = PLAN_ORDER.filter((p) => p !== "enterprise");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Coupons"
      title="New coupon"
      width="max-w-[520px]"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="ml-auto" disabled={!valid} loading={create.isPending} onClick={() => create.mutate()}>
            Create coupon
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Code" htmlFor="cp-code" hint="Capitals and digits, 3 to 32. Hotels type it at checkout.">
          <Input id="cp-code" className="font-mono uppercase tracking-[0.1em]" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))} placeholder="LAUNCH50" />
        </Field>
        <Field label="Name" htmlFor="cp-name" hint="What finance sees on invoices and reports.">
          <Input id="cp-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Launch: half off for three months" />
        </Field>
        <div>
          <Segmented
            label="Discount type"
            value={f.kind}
            onChange={(k) => set("kind", k)}
            options={[
              { value: "percent", label: "Percentage" },
              { value: "amount", label: "Fixed amount" },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <AffixInput
              aria-label="Discount"
              inputMode="numeric"
              className="font-mono"
              prefix={f.kind === "amount" ? "₦" : undefined}
              suffix={f.kind === "percent" ? "%" : "off"}
              value={f.value}
              onChange={(e) => set("value", e.target.value.replace(/[^\d]/g, ""))}
            />
            <AffixInput aria-label="Months" inputMode="numeric" className="font-mono" suffix="months" disabled={f.forever} value={f.forever ? "" : f.months} onChange={(e) => set("months", e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          <div className="mt-2">
            <Checkbox checked={f.forever} onChange={(v) => set("forever", v)} label="For as long as they subscribe" />
          </div>
        </div>
        <Field label="Plans" htmlFor="cp-plans" hint="None ticked means any paid plan.">
          <div className="flex flex-wrap gap-4" id="cp-plans">
            {paid.map((p) => (
              <Checkbox key={p} checked={f.plans.includes(p)} onChange={(v) => set("plans", v ? [...f.plans, p] : f.plans.filter((x) => x !== p))} label={planName(p)} />
            ))}
          </div>
        </Field>
        <Field label="Billing" htmlFor="cp-int" hint="None ticked means monthly and yearly.">
          <div className="flex gap-4" id="cp-int">
            {(["MONTHLY", "YEARLY"] as BillingInterval[]).map((i) => (
              <Checkbox key={i} checked={f.intervals.includes(i)} onChange={(v) => set("intervals", v ? [...f.intervals, i] : f.intervals.filter((x) => x !== i))} label={i === "MONTHLY" ? "Monthly" : "Yearly"} />
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Uses allowed" htmlFor="cp-max" optional>
            <Input id="cp-max" inputMode="numeric" className="font-mono" value={f.max} onChange={(e) => set("max", e.target.value.replace(/[^\d]/g, ""))} placeholder="No cap" />
          </Field>
          <Field label="Valid until" htmlFor="cp-until" optional>
            <Input id="cp-until" type="date" className="font-mono" value={f.until} onChange={(e) => set("until", e.target.value)} />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

function RedemptionsSheet({ c, onClose }: { c: Coupon | null; onClose: () => void }) {
  const r = useCouponRedemptions(c?.id ?? null);
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()} eyebrow={<span className="font-mono normal-case tracking-normal">{c?.code}</span>} title="Who used it">
      {!r.data ? (
        <Skeleton className="h-32" />
      ) : !r.data.length ? (
        <EmptyState compact glyph="dots" title="Nobody yet" />
      ) : (
        <ul className="divide-y divide-line">
          {r.data.map((x) => (
            <li key={x.tenant.id} className="flex items-center justify-between gap-3 py-3 text-[13px]">
              <Link href={`/tenants/${x.tenant.id}`} className="text-ink hover:underline">
                {x.tenant.name}
              </Link>
              <span className="text-right text-[12px] text-ink-muted">
                {formatDate(x.appliedAt)}
                <span className="block font-mono">{x.monthsRemaining == null ? "forever" : `${x.monthsRemaining} months left`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

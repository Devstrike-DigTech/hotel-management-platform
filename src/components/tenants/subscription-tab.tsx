"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Receipt, Ticket, X } from "@phosphor-icons/react";
import { tenantsApi, type SubscriptionPatch } from "@/lib/api/endpoints";
import { usePlans } from "@/lib/api/hooks";
import type { BillingInterval, SubscriptionStatus } from "@/lib/api/types";
import type { TenantDetailM6 } from "@/lib/api/types-m6";
import { SUB_STATUS, SUB_STATUS_ORDER, planName } from "@/lib/catalog";
import { formatDate, naira, titleCase } from "@/lib/format";
import { toast } from "@/lib/store";
import { useCan } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";

const dateIn = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const toIso = (d: string) => (d ? new Date(`${d}T00:00:00+01:00`).toISOString() : null);

export function SubscriptionTab({ tenant, onSaved }: { tenant: TenantDetailM6; onSaved: (d?: TenantDetailM6) => void }) {
  const can = useCan();
  const plans = usePlans();
  const sub = tenant.subscription;
  const manage = can("tenants.manage");
  const money = can("billing.manage");
  const initial = {
    planCode: sub?.planCode ?? tenant.planCode,
    status: (sub?.status ?? tenant.status) as SubscriptionStatus,
    interval: (sub?.interval ?? "MONTHLY") as BillingInterval,
    price: sub?.customPriceKobo != null ? String(Math.round(sub.customPriceKobo / 100)) : "",
    start: dateIn(sub?.contractStartAt),
    end: dateIn(sub?.contractEndAt),
    notes: sub?.contractNotes ?? "",
  };
  const [f, setF] = useState(initial);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirtyKeys = (Object.keys(f) as (keyof typeof f)[]).filter((k) => f[k] !== initial[k]);
  const plan = plans.data?.find((p) => p.code === f.planCode);
  const listPrice = f.interval === "YEARLY" ? plan?.priceYearlyKobo : plan?.priceMonthlyKobo;

  const save = useMutation({
    mutationFn: () => {
      const body: SubscriptionPatch = {};
      if (f.planCode !== initial.planCode) body.planCode = f.planCode;
      if (f.status !== initial.status) body.status = f.status;
      if (f.interval !== initial.interval) body.interval = f.interval;
      if (f.price !== initial.price) body.customPriceKobo = f.price ? Number(f.price) * 100 : null;
      if (f.start !== initial.start) body.contractStartAt = toIso(f.start);
      if (f.end !== initial.end) body.contractEndAt = toIso(f.end);
      if (f.notes !== initial.notes) body.contractNotes = f.notes || null;
      return tenantsApi.updateSubscription(tenant.id, body);
    },
    onSuccess: (d) => {
      toast.success("Subscription updated", `${tenant.name}: ${planName(f.planCode)}, ${SUB_STATUS[f.status].label.toLowerCase()}.`);
      onSaved(d);
    },
    meta: { errorTitle: "Subscription not updated" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Panel className="lg:col-span-8">
        <PanelHeader eyebrow="Subscription" title="Plan, price and contract" description="Changes apply to the hotel immediately and are recorded on both audit logs." />
        <fieldset disabled={!manage} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Plan" htmlFor="s-plan">
            <Select id="s-plan" value={f.planCode} onChange={(e) => set("planCode", e.target.value)}>
              {(plans.data ?? [{ code: f.planCode, name: planName(f.planCode) }]).map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="s-status" hint="Use Suspend in Actions to record a reason.">
            <Select id="s-status" value={f.status} onChange={(e) => set("status", e.target.value as SubscriptionStatus)}>
              {SUB_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SUB_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing interval" htmlFor="s-int">
            <Select id="s-int" value={f.interval} onChange={(e) => set("interval", e.target.value as BillingInterval)}>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </Field>
          <Field
            label="Custom price"
            htmlFor="s-price"
            locked={!money ? "billing.manage" : undefined}
            hint={f.price ? `Per ${f.interval === "YEARLY" ? "year" : "month"}. List price ${naira(listPrice ?? null)}.` : `Empty uses the list price, ${naira(listPrice ?? null)}.`}
          >
            <AffixInput
              id="s-price"
              prefix="₦"
              suffix={f.interval === "YEARLY" ? "/yr" : "/mo"}
              inputMode="numeric"
              className="font-mono"
              disabled={!money}
              value={f.price ? Number(f.price).toLocaleString("en-NG") : ""}
              onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="List price"
            />
          </Field>
          <Field label="Contract starts" htmlFor="s-start" locked={!money ? "billing.manage" : undefined}>
            <Input id="s-start" type="date" className="font-mono" disabled={!money} value={f.start} onChange={(e) => set("start", e.target.value)} />
          </Field>
          <Field label="Contract ends" htmlFor="s-end" locked={!money ? "billing.manage" : undefined}>
            <Input id="s-end" type="date" className="font-mono" disabled={!money} value={f.end} onChange={(e) => set("end", e.target.value)} />
          </Field>
          <Field label="Contract notes" htmlFor="s-notes" className="sm:col-span-2" optional>
            <Textarea id="s-notes" disabled={!money} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Terms agreed outside the plan, review dates, who signed" />
          </Field>
        </fieldset>
        {manage && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3.5 sm:px-6">
            {dirtyKeys.length > 0 && (
              <>
                <span className="mr-auto text-[12.5px] text-ink-muted">
                  {dirtyKeys.length} unsaved {dirtyKeys.length === 1 ? "change" : "changes"}
                </span>
                <Button variant="ghost" onClick={() => setF(initial)}>
                  Reset
                </Button>
              </>
            )}
            <Button disabled={!dirtyKeys.length} loading={save.isPending} onClick={() => save.mutate()}>
              Apply changes
            </Button>
          </div>
        )}
      </Panel>

      <div className="flex flex-col gap-6 lg:col-span-4">
        <CouponCard tenant={tenant} onSaved={onSaved} />
        <Panel className="p-5">
          <p className="eyebrow mb-3">This period</p>
          <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
            <dt className="text-ink-muted">Started</dt>
            <dd className="text-right font-mono text-ink">{formatDate(sub?.currentPeriodStart)}</dd>
            <dt className="text-ink-muted">Renews</dt>
            <dd className="text-right font-mono text-ink">{formatDate(sub?.currentPeriodEnd)}</dd>
            <dt className="text-ink-muted">Trial ends</dt>
            <dd className="text-right font-mono text-ink">{formatDate(sub?.trialEndsAt)}</dd>
          </dl>
        </Panel>
      </div>

      <Panel className="overflow-hidden lg:col-span-12">
        <PanelHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <Receipt size={13} weight="duotone" /> Invoices
            </span>
          }
          title="Platform invoices"
          description="The last ten subscription invoices"
        />
        {tenant.invoices?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13.5px]">
              <tbody>
                {tenant.invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-b-0">
                    <td className="py-3 pl-5 font-mono text-[12.5px] text-ink">{i.reference}</td>
                    <td className="py-3 text-ink-muted">
                      {planName(i.planCode)}, {titleCase(i.interval)}
                    </td>
                    <td className="py-3">
                      <Badge tone={i.status === "PAID" ? "palm" : i.status === "FAILED" ? "danger" : "neutral"}>{titleCase(i.status)}</Badge>
                    </td>
                    <td className="py-3 text-ink-muted">{formatDate(i.paidAt ?? i.createdAt)}</td>
                    <td className="py-3 pr-5 text-right font-mono text-ink">{naira(i.amountKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState compact glyph="ladder" title="No invoices yet" />
        )}
      </Panel>
    </div>
  );
}

function CouponCard({ tenant, onSaved }: { tenant: TenantDetailM6; onSaved: (d?: TenantDetailM6) => void }) {
  const can = useCan();
  const [code, setCode] = useState("");
  const c = tenant.subscription?.coupon;
  const apply = useMutation({
    mutationFn: () => tenantsApi.applyCoupon(tenant.id, code.trim().toUpperCase()),
    onSuccess: (d) => {
      toast.success("Coupon applied", code.toUpperCase());
      setCode("");
      onSaved(d);
    },
    meta: { errorTitle: "Coupon not applied" },
  });
  const remove = useMutation({
    mutationFn: () => tenantsApi.removeCoupon(tenant.id),
    onSuccess: () => {
      toast.success("Coupon removed");
      onSaved();
    },
    meta: { errorTitle: "Coupon not removed" },
  });
  return (
    <Panel className="p-5">
      <p className="eyebrow mb-3 flex items-center gap-2">
        <Ticket size={13} weight="duotone" /> Coupon
      </p>
      {c ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[15px] tracking-[0.08em] text-ink">{c.code}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{c.name}</p>
            <p className="mt-2 text-[12.5px] text-ink">
              {c.percentOff ? `${c.percentOff}% off` : naira(c.amountOffKobo) + " off"}
              {c.monthsRemaining != null ? `, ${c.monthsRemaining} more ${c.monthsRemaining === 1 ? "month" : "months"}` : ", forever"}
            </p>
          </div>
          {can("billing.manage") && (
            <Button size="icon-sm" variant="ghost" aria-label="Remove coupon" loading={remove.isPending} onClick={() => remove.mutate()}>
              <X size={14} />
            </Button>
          )}
        </div>
      ) : can("billing.manage") ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) apply.mutate();
          }}
        >
          <Input aria-label="Coupon code" placeholder="CODE" className="font-mono uppercase tracking-[0.08em]" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" variant="secondary" loading={apply.isPending} disabled={!code.trim()}>
            Apply
          </Button>
        </form>
      ) : (
        <p className="text-[13px] text-ink-muted">No coupon.</p>
      )}
    </Panel>
  );
}

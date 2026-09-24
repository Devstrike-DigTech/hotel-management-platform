"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Buildings, Check, Copy, Handshake, UserCircle } from "@phosphor-icons/react";
import { tenantsApi } from "@/lib/api/endpoints";
import { qk, usePlans } from "@/lib/api/hooks";
import type { BillingInterval } from "@/lib/api/types";
import type { TenantDetailM6 } from "@/lib/api/types-m6";
import { planName } from "@/lib/catalog";
import { formatDate, naira, nairaCompact } from "@/lib/format";
import { useCan } from "@/lib/session";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { AffixInput, Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader, Panel, PlanPlate } from "@/components/ui/primitives";
import { Gate } from "@/components/ui/kit";

const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function CreateTenantView() {
  return (
    <Gate perm="tenants.manage">
      <CreateTenant />
    </Gate>
  );
}

function CreateTenant() {
  const qc = useQueryClient();
  const can = useCan();
  const plans = usePlans();
  const [f, setF] = useState({
    name: "",
    slug: "",
    slugTouched: false,
    city: "",
    state: "Lagos",
    propertyName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    planCode: "enterprise",
    interval: "MONTHLY" as BillingInterval,
    price: "",
    start: new Date().toISOString().slice(0, 10),
    end: "",
    notes: "",
    status: "ACTIVE" as "ACTIVE" | "TRIALING",
    trialEnds: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const [done, setDone] = useState<{ tenant: TenantDetailM6; ownerSetupUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const plan = plans.data?.find((p) => p.code === f.planCode);
  const listKobo = f.interval === "YEARLY" ? plan?.priceYearlyKobo : plan?.priceMonthlyKobo;
  const priceKobo = f.price ? Number(f.price) * 100 : (listKobo ?? null);
  const months = f.start && f.end ? Math.max(0, Math.round((new Date(f.end).getTime() - new Date(f.start).getTime()) / (30.44 * 864e5))) : null;
  const monthly = priceKobo == null ? null : f.interval === "YEARLY" ? priceKobo / 12 : priceKobo;
  const tcv = monthly != null && months ? monthly * months : null;
  const phoneOk = /^\+?234\d{10}$|^0\d{10}$/.test(f.ownerPhone.replace(/\s+/g, ""));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.ownerEmail);
  const valid = f.name.trim().length >= 2 && f.city.trim() && emailOk && f.ownerName.trim() && phoneOk && (f.status === "ACTIVE" || f.trialEnds) && (f.planCode !== "enterprise" || priceKobo != null);

  const create = useMutation({
    mutationFn: () => {
      const phone = f.ownerPhone.replace(/\s+/g, "");
      return tenantsApi.create({
        name: f.name.trim(),
        slug: f.slug || undefined,
        city: f.city.trim(),
        state: f.state,
        propertyName: f.propertyName.trim() || undefined,
        owner: { fullName: f.ownerName.trim(), email: f.ownerEmail.trim().toLowerCase(), phone: phone.startsWith("0") ? `+234${phone.slice(1)}` : phone.startsWith("+") ? phone : `+${phone}` },
        planCode: f.planCode,
        interval: f.interval,
        customPriceKobo: f.price ? Number(f.price) * 100 : null,
        contractStartAt: f.start ? new Date(`${f.start}T00:00:00+01:00`).toISOString() : undefined,
        contractEndAt: f.end ? new Date(`${f.end}T00:00:00+01:00`).toISOString() : undefined,
        contractNotes: f.notes.trim() || undefined,
        status: f.status,
        trialEndsAt: f.status === "TRIALING" && f.trialEnds ? new Date(`${f.trialEnds}T23:59:00+01:00`).toISOString() : undefined,
      });
    },
    onSuccess: (res) => {
      setDone(res);
      void qc.invalidateQueries({ queryKey: qk.tenantsAll });
      void qc.invalidateQueries({ queryKey: qk.overview });
    },
    meta: { errorTitle: "Tenant not created" },
  });

  if (done)
    return (
      <div className="mx-auto max-w-xl py-6" data-testid="tenant-created">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-[color-mix(in_oklab,var(--palm)_35%,transparent)] bg-palm-wash text-palm">
          <Check size={22} weight="bold" />
        </span>
        <h1 className="display mt-5 text-[36px] leading-tight text-ink">
          <em>{done.tenant.name}</em> is on the platform.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">
          {done.tenant.owner?.fullName ?? "The owner"} has been emailed a link to set a password. It is valid for seven days; you can also send it yourself.
        </p>
        <Panel className="mt-6 p-4">
          <p className="eyebrow mb-2 text-[10px]">Owner set-up link</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm bg-surface-2 px-2 py-1.5 font-mono text-[12px] text-ink">{done.ownerSetupUrl}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(done.ownerSetupUrl);
                  setCopied(true);
                } catch {
                  /* clipboard blocked */
                }
              }}
            >
              {copied ? <Check size={14} className="text-palm" /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Panel>
        <div className="mt-6 flex gap-2">
          <ButtonLink href={`/tenants/${done.tenant.id}`}>
            Open the tenant <ArrowRight size={15} />
          </ButtonLink>
          <ButtonLink href="/tenants" variant="secondary">
            All tenants
          </ButtonLink>
        </div>
      </div>
    );

  return (
    <>
      <Link href="/tenants" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> All tenants
      </Link>
      <PageHeader
        eyebrow={
          <>
            <Handshake size={14} weight="duotone" /> Enterprise onboarding
          </>
        }
        title={
          <>
            A new hotel, <em>on its own terms</em>.
          </>
        }
        description="For groups and chains signed by sales: a custom price and contract dates. The owner receives a link to set their password."
      />
      <form
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <div className="flex flex-col gap-6">
          <Section icon={Buildings} title="The hotel">
            <Field label="Hotel or group name" htmlFor="c-name">
              <Input
                id="c-name"
                value={f.name}
                onChange={(e) => setF((x) => ({ ...x, name: e.target.value, slug: x.slugTouched ? x.slug : slugify(e.target.value) }))}
                placeholder="Harmattan Hotels & Suites"
                autoFocus
              />
            </Field>
            <Field label="Slug" htmlFor="c-slug" hint="Used in the booking site address; letters, numbers and dashes.">
              <AffixInput
                id="c-slug"
                className="font-mono"
                suffix={`.${process.env.NEXT_PUBLIC_APP_DOMAIN || "hotelos.ng"}`}
                value={f.slug}
                onChange={(e) => setF((x) => ({ ...x, slug: slugify(e.target.value), slugTouched: true }))}
              />
            </Field>
            <Field label="City" htmlFor="c-city">
              <Input id="c-city" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Abuja" />
            </Field>
            <Field label="State" htmlFor="c-state">
              <Select id="c-state" value={f.state} onChange={(e) => set("state", e.target.value)}>
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="First property name" htmlFor="c-prop" optional hint="Defaults to the hotel name. Add more properties from the hotel admin." className="sm:col-span-2">
              <Input id="c-prop" value={f.propertyName} onChange={(e) => set("propertyName", e.target.value)} placeholder={f.name || "Harmattan Abuja"} />
            </Field>
          </Section>

          <Section icon={UserCircle} title="The owner">
            <Field label="Full name" htmlFor="c-oname">
              <Input id="c-oname" value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Email" htmlFor="c-oemail" error={f.ownerEmail && !emailOk ? "That doesn't look like an email address." : null}>
              <Input id="c-oemail" type="email" value={f.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Phone" htmlFor="c-ophone" error={f.ownerPhone && !phoneOk ? "Use a Nigerian number, e.g. 0803 123 4567." : null}>
              <AffixInput id="c-ophone" prefix="NG" className="font-mono" inputMode="tel" value={f.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} placeholder="0803 123 4567" />
            </Field>
          </Section>

          <Section icon={Handshake} title="Commercial terms">
            <Field label="Plan" htmlFor="c-plan">
              <Select id="c-plan" value={f.planCode} onChange={(e) => set("planCode", e.target.value)}>
                {(plans.data ?? [{ code: "enterprise", name: "Enterprise" }]).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Billing" htmlFor="c-int">
              <Select id="c-int" value={f.interval} onChange={(e) => set("interval", e.target.value as BillingInterval)}>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </Select>
            </Field>
            <Field
              label="Price"
              htmlFor="c-price"
              className="sm:col-span-2"
              locked={!can("billing.manage") ? "billing.manage" : undefined}
              hint={listKobo != null ? `List price ${naira(listKobo)} per ${f.interval === "YEARLY" ? "year" : "month"}; leave empty to use it.` : "Enterprise has no list price: agree one."}
            >
              <AffixInput
                id="c-price"
                prefix="₦"
                suffix={f.interval === "YEARLY" ? "/yr" : "/mo"}
                inputMode="numeric"
                className="font-mono"
                disabled={!can("billing.manage")}
                value={f.price ? Number(f.price).toLocaleString("en-NG") : ""}
                onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))}
                placeholder={listKobo != null ? String(listKobo / 100) : "1,250,000"}
              />
            </Field>
            <Field label="Contract starts" htmlFor="c-start">
              <Input id="c-start" type="date" className="font-mono" value={f.start} onChange={(e) => set("start", e.target.value)} />
            </Field>
            <Field label="Contract ends" htmlFor="c-end" optional>
              <Input id="c-end" type="date" className="font-mono" value={f.end} min={f.start} onChange={(e) => set("end", e.target.value)} />
            </Field>
            <Field label="Start as" htmlFor="c-status">
              <Select id="c-status" value={f.status} onChange={(e) => set("status", e.target.value as "ACTIVE" | "TRIALING")}>
                <option value="ACTIVE">Active, billing from the start date</option>
                <option value="TRIALING">Trial first</option>
              </Select>
            </Field>
            {f.status === "TRIALING" && (
              <Field label="Trial ends" htmlFor="c-trial">
                <Input id="c-trial" type="date" className="font-mono" value={f.trialEnds} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set("trialEnds", e.target.value)} />
              </Field>
            )}
            <Field label="Contract notes" htmlFor="c-notes" optional className="sm:col-span-2">
              <Textarea id="c-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Signed by, review dates, anything agreed outside the plan" />
            </Field>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-line bg-night text-night-ink shadow-float">
            <div className="border-b border-night-line px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-night-brass">Contract summary</p>
              <p className="display-sm mt-2 truncate text-[20px]">{f.name || "Unnamed hotel"}</p>
              <p className="mt-1 text-[12.5px] text-night-muted">{[f.city, f.state].filter(Boolean).join(", ") || "City to follow"}</p>
            </div>
            <dl className="grid grid-cols-2 gap-y-3 px-5 py-4 text-[12.5px]">
              <dt className="text-night-muted">Plan</dt>
              <dd className="text-right">
                <PlanPlate name={planName(f.planCode)} code={f.planCode} className="bg-night-2" />
              </dd>
              <dt className="text-night-muted">Price</dt>
              <dd className="text-right font-mono">{priceKobo != null ? `${naira(priceKobo)}${f.interval === "YEARLY" ? "/yr" : "/mo"}` : "to agree"}</dd>
              <dt className="text-night-muted">Monthly value</dt>
              <dd className="text-right font-mono text-night-brass">{monthly != null ? nairaCompact(monthly) : "-"}</dd>
              <dt className="text-night-muted">Term</dt>
              <dd className="text-right font-mono">{months ? `${months} months` : f.start ? `from ${formatDate(new Date(f.start).toISOString())}` : "-"}</dd>
              <dt className="text-night-muted">Contract value</dt>
              <dd className="text-right font-mono text-[15px] text-night-ink">{tcv != null ? nairaCompact(tcv) : "-"}</dd>
            </dl>
            <div className="border-t border-night-line px-5 py-4">
              <Button type="submit" variant="brass" size="lg" className="w-full" disabled={!valid} loading={create.isPending} data-testid="create-tenant">
                Create tenant
              </Button>
              <p className={cn("mt-2.5 text-[11.5px] leading-relaxed text-night-muted")}>
                Creates the tenant, its first property and the owner account, and emails the owner. Recorded in the platform audit log.
              </p>
            </div>
          </div>
        </aside>
      </form>
    </>
  );
}

function Section({ icon: I, title, children }: { icon: typeof Buildings; title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <I size={17} weight="duotone" className="text-adire" />
        <h2 className="display-sm text-[17px] text-ink">{title}</h2>
      </header>
      <div className="grid gap-5 p-5 sm:grid-cols-2">{children}</div>
    </Panel>
  );
}

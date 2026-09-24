"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft,
  ArrowSquareOut,
  CalendarPlus,
  CaretDown,
  Database,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  Pause,
  Phone,
  Play,
  Trash,
  WarningDiamond,
} from "@phosphor-icons/react";
import { tenantsApi } from "@/lib/api/endpoints";
import { qk, useTenant } from "@/lib/api/hooks";
import type { TenantDetailM6 } from "@/lib/api/types-m6";
import { LIMIT_LABEL, SUB_STATUS, planName } from "@/lib/catalog";
import { config } from "@/lib/config";
import { daysUntil, formatDate, formatDateTime, formatPhone, nairaCompact, number, relativeTime, titleCase } from "@/lib/format";
import { toast } from "@/lib/store";
import { useCan } from "@/lib/session";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Meter, Panel, PanelHeader, PlanPlate, Segmented, Skeleton } from "@/components/ui/primitives";
import { Gate, KV, ReasonDialog } from "@/components/ui/kit";
import { Field, Input } from "@/components/ui/form";
import { ImpersonationLauncher, type LaunchTarget } from "@/components/impersonation/launcher";
import { SubscriptionTab } from "./subscription-tab";
import { FeaturesTab } from "./features-tab";
import { InfrastructureTab } from "./infrastructure-tab";
import { OffboardingBanner } from "./offboarding";

type Tab = "overview" | "subscription" | "features" | "people" | "infrastructure" | "activity";

export function TenantDetailView({ id }: { id: string }) {
  const t = useTenant(id);
  return (
    <Gate perm="tenants.view">
      {t.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-12 w-80" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : t.isError || !t.data ? (
        <Panel>
          <ErrorState error={t.error} onRetry={() => t.refetch()} />
        </Panel>
      ) : (
        <Detail tenant={t.data} />
      )}
    </Gate>
  );
}

function Detail({ tenant }: { tenant: TenantDetailM6 }) {
  const can = useCan();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [launch, setLaunch] = useState<LaunchTarget | null>(null);
  const [dialog, setDialog] = useState<"suspend" | "reinstate" | "trial" | null>(null);
  const [trialDays, setTrialDays] = useState(14);
  const sub = tenant.subscription;
  const status = sub?.status ?? tenant.status;
  const offboarding = tenant.offboarding && !["CANCELLED"].includes(tenant.offboarding.status) ? tenant.offboarding : null;
  const deleted = tenant.lifecycle === "DELETED";

  const refresh = (d?: TenantDetailM6) => {
    if (d) qc.setQueryData(qk.tenant(tenant.id), d);
    void qc.invalidateQueries({ queryKey: qk.tenant(tenant.id) });
    void qc.invalidateQueries({ queryKey: qk.tenantsAll });
    void qc.invalidateQueries({ queryKey: qk.overview });
  };
  const exportNow = useMutation({
    mutationFn: () => tenantsApi.startExport(tenant.id),
    onSuccess: () => {
      toast.success("Export started", "The zip appears under Infrastructure when it is ready.");
      void qc.invalidateQueries({ queryKey: qk.tenantExports(tenant.id) });
    },
    meta: { errorTitle: "Export not started" },
  });

  return (
    <>
      <Link href="/tenants" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> All tenants
      </Link>
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-3 flex flex-wrap items-center gap-2">
            <span className="font-mono normal-case tracking-normal">{tenant.slug}</span>
            <span className="text-ink-faint">&middot;</span> {tenant.city}
            {tenant.state && tenant.state !== tenant.city && <span className="normal-case tracking-normal text-ink-faint">{tenant.state}</span>}
          </p>
          <h1 className="display text-[34px] leading-[1.04] text-ink md:text-[44px]">{tenant.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PlanPlate name={planName(tenant.planCode)} code={tenant.planCode} />
            {deleted ? (
              <Badge tone="neutral">Deleted</Badge>
            ) : offboarding ? (
              <Badge tone="danger" dot>
                Offboarding
              </Badge>
            ) : (
              <Badge tone={SUB_STATUS[status]?.tone ?? "neutral"} dot>
                {SUB_STATUS[status]?.label ?? status}
              </Badge>
            )}
            {tenant.dedicatedDb?.mode === "DEDICATED" && (
              <Badge tone="adire" icon={<Database size={12} weight="bold" />}>
                Dedicated database
              </Badge>
            )}
            <span className="text-[12.5px] text-ink-muted">Joined {formatDate(tenant.createdAt)}</span>
            {!!tenant.mrrKobo && (
              <span className="text-[12.5px] text-ink-muted">
                &middot; <span className="font-mono text-ink">{nairaCompact(tenant.mrrKobo)}</span>/mo
              </span>
            )}
          </div>
        </div>
        {!deleted && (
          <div className="flex flex-wrap items-center gap-2">
            {can("impersonate") && (
              <Button onClick={() => setLaunch({ tenantId: tenant.id, tenantName: tenant.name })} data-testid="view-as">
                <Eye size={15} /> View as staff
              </Button>
            )}
            <ButtonLink href={`${config.webUrl}/hotels/${tenant.properties[0]?.slug ?? tenant.slug}`} variant="secondary" target="_blank" rel="noopener noreferrer">
              Public page <ArrowSquareOut size={14} />
            </ButtonLink>
            {can("tenants.manage") && (
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button variant="secondary" aria-label="More actions">
                    Actions <CaretDown size={13} />
                  </Button>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-float animate-[rise_140ms_ease-out]">
                    <MenuItem icon={CalendarPlus} onSelect={() => setDialog("trial")} disabled={!!offboarding}>
                      Extend trial
                    </MenuItem>
                    {status === "SUSPENDED" && !offboarding ? (
                      <MenuItem icon={Play} onSelect={() => setDialog("reinstate")}>
                        Reinstate
                      </MenuItem>
                    ) : (
                      <MenuItem icon={Pause} onSelect={() => setDialog("suspend")} disabled={!!offboarding}>
                        Suspend
                      </MenuItem>
                    )}
                    <MenuItem icon={DownloadSimple} onSelect={() => exportNow.mutate()}>
                      Export all data
                    </MenuItem>
                    <Menu.Separator className="my-1 h-px bg-line" />
                    <Menu.Item asChild disabled={!!offboarding}>
                      <Link
                        href={`/tenants/${tenant.id}/offboard`}
                        className="flex h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-laterite outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-laterite-wash"
                      >
                        <Trash size={15} /> Offboard and delete
                      </Link>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>
            )}
          </div>
        )}
      </div>

      {offboarding && <OffboardingBanner o={offboarding} tenantId={tenant.id} />}
      {status === "SUSPENDED" && !offboarding && sub?.suspendedReason && (
        <p className="mb-6 flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--laterite)_30%,transparent)] bg-laterite-wash px-4 py-3 text-[13px] text-laterite">
          <WarningDiamond size={16} weight="duotone" className="mt-0.5 shrink-0" /> Suspended: {sub.suspendedReason}
        </p>
      )}

      <div className="mb-6 overflow-x-auto">
        <Segmented<Tab>
          label="Tenant sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "subscription", label: "Subscription" },
            { value: "features", label: "Features" },
            { value: "people", label: `People ${tenant.staff.length}` },
            { value: "infrastructure", label: "Infrastructure" },
            { value: "activity", label: "Activity" },
          ]}
        />
      </div>

      {tab === "overview" && <OverviewTab tenant={tenant} onViewAs={(staffId) => setLaunch({ tenantId: tenant.id, tenantName: tenant.name, staffId })} />}
      {tab === "subscription" && <SubscriptionTab tenant={tenant} onSaved={refresh} />}
      {tab === "features" && <FeaturesTab tenant={tenant} />}
      {tab === "people" && <PeopleTab tenant={tenant} onViewAs={(staffId) => setLaunch({ tenantId: tenant.id, tenantName: tenant.name, staffId })} />}
      {tab === "infrastructure" && <InfrastructureTab tenant={tenant} />}
      {tab === "activity" && <ActivityTab tenant={tenant} />}

      <ImpersonationLauncher open={!!launch} onOpenChange={(o) => !o && setLaunch(null)} target={launch ?? {}} />

      <ReasonDialog
        open={dialog === "suspend"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Suspend ${tenant.name}`}
        eyebrow="Tenant status"
        description="Staff lose write access and the booking site stops taking bookings. The hotel sees the reason. Reinstating restores everything."
        confirmLabel="Suspend hotel"
        danger
        min={5}
        placeholder="e.g. Unpaid since August; owner not answering calls"
        onConfirm={async (reason) => refresh(await tenantsApi.suspend(tenant.id, reason))}
      />
      <ReasonDialog
        open={dialog === "reinstate"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reinstate ${tenant.name}`}
        eyebrow="Tenant status"
        description="The hotel goes back to active (or to its trial, if the trial is still running)."
        confirmLabel="Reinstate"
        min={5}
        onConfirm={async (reason) => refresh(await tenantsApi.reinstate(tenant.id, reason))}
      />
      <ReasonDialog
        open={dialog === "trial"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Extend the trial"
        eyebrow={tenant.name}
        description={
          sub?.trialEndsAt ? `The trial ends ${formatDate(sub.trialEndsAt)}. Days are added from that date, or from today if it has passed.` : "Starts a trial from today."
        }
        confirmLabel={`Add ${trialDays} days`}
        min={5}
        placeholder="e.g. Waiting on their board to sign off on Pro"
        onConfirm={async (reason) => refresh(await tenantsApi.extendTrial(tenant.id, trialDays, reason))}
      >
        <Field label="Days to add" htmlFor="trial-days" className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {[7, 14, 30].map((d) => (
              <Button key={d} size="sm" variant={trialDays === d ? "ink" : "secondary"} onClick={() => setTrialDays(d)}>
                {d} days
              </Button>
            ))}
            <Input id="trial-days" type="number" min={1} max={90} value={trialDays} onChange={(e) => setTrialDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))} className="w-24 font-mono" />
          </div>
        </Field>
      </ReasonDialog>
    </>
  );
}

function MenuItem({ icon: I, children, onSelect, disabled }: { icon: typeof Eye; children: React.ReactNode; onSelect: () => void; disabled?: boolean }) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2"
    >
      <I size={15} className="text-ink-muted" /> {children}
    </Menu.Item>
  );
}

/* ---------------- overview tab ---------------- */
function OverviewTab({ tenant, onViewAs }: { tenant: TenantDetailM6; onViewAs: (id: string) => void }) {
  const can = useCan();
  const lim = tenant.entitlements?.limits ?? {};
  const usage = tenant.usage ?? tenant.entitlements?.usage ?? {};
  const owner = tenant.owner;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Panel className="lg:col-span-7">
        <PanelHeader eyebrow="Usage" title="Against the plan's limits" description={`Limits come from ${planName(tenant.planCode)} and any add-ons`} />
        <div className="grid gap-6 px-5 py-5 sm:grid-cols-3">
          {(["max_rooms", "max_staff", "max_properties"] as const).map((k) => (
            <Meter key={k} label={LIMIT_LABEL[k]} used={usage[k.replace("max_", "") as "rooms"] ?? 0} max={lim[k]} />
          ))}
        </div>
        <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4 [&>*]:border-line [&>*:not(:first-child)]:border-l max-sm:[&>*:nth-child(3)]:border-l-0 max-sm:[&>*:nth-child(-n+2)]:border-b">
          <Mini k="Open support" v={String(tenant.support?.open ?? 0)} href={`/support?tenantId=${tenant.id}`} alert={!!tenant.support?.overdue} note={tenant.support?.overdue ? `${tenant.support.overdue} overdue` : undefined} />
          <Mini k="API calls, 30d" v={number(tenant.apiUsage?.requests30d ?? 0)} note={tenant.apiUsage?.keys ? `${tenant.apiUsage.keys} keys` : "no keys"} />
          <Mini k="Payouts" v={tenant.payout?.ready ? "Ready" : "Not set up"} alert={!tenant.payout?.ready} />
          <Mini k="Last invoice" v={tenant.invoices?.[0] ? nairaCompact(tenant.invoices[0].amountKobo) : "-"} note={tenant.invoices?.[0]?.status ? titleCase(tenant.invoices[0].status) : undefined} alert={tenant.invoices?.[0]?.status === "FAILED"} />
        </div>
      </Panel>

      <Panel className="p-5 lg:col-span-5">
        <p className="eyebrow mb-3">Owner</p>
        {owner ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="display-sm text-[19px] text-ink">{owner.fullName}</p>
              <a href={`mailto:${owner.email}`} className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink">
                <EnvelopeSimple size={14} /> {owner.email}
              </a>
              {owner.phone && (
                <a href={`tel:${owner.phone}`} className="mt-1 flex items-center gap-2 font-mono text-[12.5px] text-ink-muted hover:text-ink">
                  <Phone size={14} /> {formatPhone(owner.phone)}
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">No owner on record.</p>
        )}
        <div className="mt-5 border-t border-line pt-4">
          <p className="eyebrow mb-2">Properties</p>
          <ul className="flex flex-col gap-2">
            {tenant.properties.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-ink">{p.name}</span>
                <span className="shrink-0 text-ink-muted">
                  {[p.area, p.city].filter(Boolean).join(", ")}
                  {!p.listedOnMarketplace && <span className="ml-2 text-ink-faint">unlisted</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel className="lg:col-span-7">
        <PanelHeader eyebrow="Recent" title="Activity in the hotel" description="The tenant's own audit log" />
        {tenant.recentActivity?.length ? (
          <ul className="divide-y divide-line">
            {tenant.recentActivity.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                <span className="font-mono text-[11.5px] text-ink-muted">{a.action}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{a.actor?.fullName ?? "System"}</span>
                <span className="shrink-0 text-[12px] text-ink-faint" suppressHydrationWarning>
                  {relativeTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact glyph="ladder" title="Nothing recorded yet" />
        )}
      </Panel>

      <Panel className="lg:col-span-5">
        <PanelHeader eyebrow="Support sessions" title="Recent impersonations" />
        {tenant.impersonations?.length ? (
          <ul className="divide-y divide-line">
            {tenant.impersonations.map((s) => (
              <li key={s.id} className="px-5 py-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink">
                    {s.platformUser.fullName} <span className="text-ink-muted">as</span> {s.staff.fullName}
                  </span>
                  <Badge tone={s.mode === "WRITE" ? "danger" : "adire"}>{s.mode === "WRITE" ? "Write" : "Read-only"}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-muted">{s.reason}</p>
                <p className="mt-1 font-mono text-[11px] text-ink-faint">{formatDateTime(s.startedAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact glyph="eye" title="No one has viewed this hotel" />
        )}
        {can("impersonate") && tenant.owner && (
          <div className="border-t border-line px-5 py-3">
            <button onClick={() => onViewAs("")} className="text-[13px] text-adire hover:underline">
              Start a session
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Mini({ k, v, note, alert, href }: { k: string; v: string; note?: string; alert?: boolean; href?: string }) {
  const inner = (
    <>
      <span className="eyebrow text-[9.5px]">{k}</span>
      <span className={cn("mt-1 block font-mono text-[18px]", alert ? "text-laterite" : "text-ink")}>{v}</span>
      {note && <span className={cn("text-[11.5px]", alert ? "text-laterite" : "text-ink-muted")}>{note}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="block px-5 py-4 hover:bg-surface-2/50">
      {inner}
    </Link>
  ) : (
    <div className="px-5 py-4">{inner}</div>
  );
}

/* ---------------- people tab ---------------- */
function PeopleTab({ tenant, onViewAs }: { tenant: TenantDetailM6; onViewAs: (id: string) => void }) {
  const can = useCan();
  return (
    <Panel className="overflow-hidden">
      <PanelHeader eyebrow="People" title="Hotel staff" description="View as any active staff member; owners need a super admin." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow py-3 pl-5 text-[10.5px] font-normal">Name</th>
              <th className="eyebrow py-3 text-[10.5px] font-normal">Role</th>
              <th className="eyebrow py-3 text-[10.5px] font-normal">Last sign-in</th>
              <th className="py-3 pr-5" />
            </tr>
          </thead>
          <tbody>
            {tenant.staff.map((s) => (
              <tr key={s.id} className={cn("border-b border-line last:border-b-0", !s.isActive && "opacity-55")}>
                <td className="py-3 pl-5">
                  <span className="block text-ink">{s.fullName}</span>
                  <span className="block text-[12px] text-ink-muted">{s.email}</span>
                </td>
                <td className="py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">{titleCase(s.role)}</td>
                <td className="py-3 text-[12.5px] text-ink-muted" suppressHydrationWarning>
                  {s.lastLoginAt ? relativeTime(s.lastLoginAt) : "never"}
                </td>
                <td className="py-3 pr-5 text-right">
                  {can("impersonate") && s.isActive && (
                    <Button size="sm" variant="secondary" onClick={() => onViewAs(s.id)}>
                      <Eye size={14} /> View as
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---------------- activity tab ---------------- */
function ActivityTab({ tenant }: { tenant: TenantDetailM6 }) {
  const trial = daysUntil(tenant.subscription?.trialEndsAt);
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Panel className="lg:col-span-8">
        <PanelHeader eyebrow="Tenant audit" title="Most recent actions" />
        <ul className="divide-y divide-line">
          {tenant.recentActivity.map((a) => (
            <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-5 py-3 text-[13px] sm:grid-cols-[180px_minmax(0,1fr)_auto]">
              <span className="font-mono text-[11.5px] text-ink-muted">{a.action}</span>
              <span className="min-w-0 truncate text-ink max-sm:order-3 max-sm:col-span-2">{a.actor?.fullName ?? "System"}</span>
              <span className="font-mono text-[11.5px] text-ink-faint">{formatDateTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-3">
          <Link href={`/audit?tenantId=${tenant.id}`} className="text-[13px] text-adire hover:underline">
            Platform actions on this tenant
          </Link>
        </div>
      </Panel>
      <Panel className="p-5 lg:col-span-4">
        <p className="eyebrow mb-3">Subscription timeline</p>
        <KV
          rows={[
            ["Current period", tenant.subscription?.currentPeriodEnd ? `to ${formatDate(tenant.subscription.currentPeriodEnd)}` : "-"],
            ["Trial", trial !== null && tenant.subscription?.trialEndsAt ? `${trial} days left` : "-"],
            ["Past due since", formatDate(tenant.subscription?.pastDueAt)],
            ["Suspended", formatDate(tenant.subscription?.suspendedAt)],
            ["Cancelled", formatDate(tenant.subscription?.cancelledAt)],
          ]}
        />
      </Panel>
    </div>
  );
}

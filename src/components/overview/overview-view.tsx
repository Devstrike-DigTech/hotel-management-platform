"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle, Pulse, WarningDiamond } from "@phosphor-icons/react";
import { useMarketplace, useOverview } from "@/lib/api/hooks";
import type { SystemHealthSummary } from "@/lib/api/types-m6";
import { PLAN_ORDER, SUB_STATUS, SUB_STATUS_ORDER, planName, planTone } from "@/lib/catalog";
import { daysUntil, firstName, formatDate, greeting, lagosLongDate, naira, nairaCompact, number } from "@/lib/format";
import { useCan, useMe } from "@/lib/session";
import { cn } from "@/lib/cn";
import { ColumnChart, ShareBar, UnitRows } from "@/components/charts/charts";
import { AreaChart } from "@/components/charts/trend";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { Figure, FigureRow } from "@/components/ui/kit";

export function OverviewView() {
  const me = useMe().data;
  const can = useCan();
  const o = useOverview();
  const d = o.data;
  const today = new Date();
  const from = new Date(today.getTime() - 29 * 864e5).toISOString().slice(0, 10);
  const market = useMarketplace(from, today.toISOString().slice(0, 10));

  return (
    <>
      <PageHeader
        eyebrow={<span suppressHydrationWarning>{lagosLongDate()}</span>}
        title={
          <span suppressHydrationWarning>
            {greeting()}, <em>{firstName(me?.fullName) || "there"}</em>.
          </span>
        }
        description="Recurring revenue, the marketplace, who is joining and leaving, and whether the machinery is healthy."
      />

      {o.isError ? (
        <Panel>
          <ErrorState error={o.error} onRetry={() => o.refetch()} />
        </Panel>
      ) : (
        <>
          {d && can("system.view") ? <HealthStrip h={d.health} /> : d ? null : <Skeleton className="mb-6 h-12 w-full rounded-lg" />}

          <FigureRow cols={5} className="mb-6">
            <Figure label="Monthly recurring" value={d ? nairaCompact(d.mrrKobo) : null} sub={d ? naira(d.mrrKobo) : undefined} tone="adire" loading={!d} />
            <Figure label="Annual run-rate" value={d ? nairaCompact(d.arrKobo) : null} sub="MRR x 12, custom prices in" loading={!d} />
            <Figure label="Marketplace GMV" value={d ? nairaCompact(d.gmv30dKobo) : null} sub="last 30 days" loading={!d} />
            <Figure
              label="Commission"
              value={d ? nairaCompact(d.commission30d.collectedKobo) : null}
              sub={d ? `${nairaCompact(d.commission30d.receivableKobo)} still receivable` : undefined}
              tone="brass"
              loading={!d}
            />
            <Figure
              label="Churn, 30 days"
              value={d ? `${d.churn.churnRatePct.toFixed(1)}%` : null}
              sub={d ? `${d.churn.churned30d} ${d.churn.churned30d === 1 ? "hotel" : "hotels"}, ${nairaCompact(d.churn.mrrLost30dKobo)} MRR lost` : undefined}
              tone={d && d.churn.churnRatePct >= 3 ? "danger" : "ink"}
              loading={!d}
            />
          </FigureRow>

          <div className="grid gap-6 lg:grid-cols-12">
            <Panel className="lg:col-span-7">
              <PanelHeader
                eyebrow="Marketplace"
                title="Gross booking value, 30 days"
                description="Online bookings across every hotel, by day"
                actions={
                  <Link href="/marketplace" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
                    Marketplace <ArrowUpRight size={13} />
                  </Link>
                }
              />
              <div className="px-3 pb-4 pt-5 sm:px-5">
                {market.data ? (
                  <AreaChart
                    label="Gross booking value by day"
                    data={market.data.byDay.map((x) => ({ x: x.date, y: x.gmvKobo }))}
                    formatY={(v) => nairaCompact(v)}
                    formatX={(s) => formatDate(s, { day: "numeric", month: "short", year: undefined })}
                    tipX={(s) => formatDate(s, { weekday: "short", day: "numeric", month: "short", year: undefined })}
                  />
                ) : market.isError ? (
                  <EmptyState compact glyph="river" title="Marketplace figures unavailable" />
                ) : (
                  <Skeleton className="h-[200px]" />
                )}
              </div>
            </Panel>

            <Panel className="lg:col-span-5">
              <PanelHeader eyebrow="Mix" title="Hotels by plan" description={d ? `${number(d.tenantsTotal)} tenants, ${d.newTenants30d} new in 30 days` : undefined} />
              <div className="px-5 py-5">
                {d ? (
                  <ShareBar
                    label="Hotels by plan"
                    items={[...new Set([...PLAN_ORDER, ...Object.keys(d.tenantsByPlan)])].map((code) => ({
                      key: code,
                      label: planName(code),
                      value: d.tenantsByPlan[code] ?? 0,
                      color: planTone(code),
                      ink: "#ffffff",
                    }))}
                  />
                ) : (
                  <Skeleton className="h-16" />
                )}
                <div className="mt-6 border-t border-line pt-5">
                  <p className="eyebrow mb-3 text-[10px]">Subscription status</p>
                  {d ? (
                    <UnitRows
                      rows={SUB_STATUS_ORDER.map((s) => ({
                        key: s,
                        label: SUB_STATUS[s].label,
                        value: d.tenantsByStatus[s] ?? 0,
                        color: SUB_STATUS[s].color,
                        hatch: s === "SUSPENDED" || s === "READ_ONLY",
                      }))}
                    />
                  ) : (
                    <Skeleton className="h-36" />
                  )}
                </div>
              </div>
            </Panel>

            <Panel className="lg:col-span-5">
              <PanelHeader eyebrow="Growth" title="Signups by week" description="New hotel accounts, last 12 weeks" />
              <div className="px-3 pb-4 pt-5 sm:px-5">
                {d ? (
                  <ColumnChart
                    label="Signups by week"
                    data={d.signupsByWeek.map((w) => ({ x: w.week, y: w.count }))}
                    formatX={(s) => formatDate(s, { day: "numeric", month: "short", year: undefined })}
                    tipLabel={(s) => `week of ${formatDate(s, { day: "numeric", month: "short", year: undefined })}`}
                  />
                ) : (
                  <Skeleton className="h-[180px]" />
                )}
              </div>
            </Panel>

            <Panel className="overflow-hidden lg:col-span-7">
              <PanelHeader
                eyebrow="Follow up"
                title="Trials ending in the next 7 days"
                actions={
                  <Link href="/tenants?status=TRIALING" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
                    All trials <ArrowUpRight size={13} />
                  </Link>
                }
              />
              {!d ? (
                <div className="space-y-2 p-5">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : !d.trialsEndingSoon.length ? (
                <EmptyState compact glyph="frond" title="No trials end this week" />
              ) : (
                <ul className="divide-y divide-line">
                  {d.trialsEndingSoon.map((t) => {
                    const left = daysUntil(t.trialEndsAt) ?? 0;
                    return (
                      <li key={t.id}>
                        <Link href={`/tenants/${t.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2/60">
                          <span
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-md border font-mono text-[15px]",
                              left <= 2 ? "border-laterite text-laterite" : "border-line-strong text-ink",
                            )}
                            aria-label={`${left} days left`}
                          >
                            {left}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-ink">{t.name}</span>
                            <span className="block text-[12.5px] text-ink-muted">
                              {t.city} &middot; ends {formatDate(t.trialEndsAt)}
                            </span>
                          </span>
                          <PlanPlate name={planName(t.planCode)} code={t.planCode} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel className="lg:col-span-12">
              <PanelHeader eyebrow="Retention" title="Hotels lost, by month" description="Cancelled, suspended or offboarded; six months" />
              <div className="grid gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_260px]">
                {d ? (
                  <ColumnChart
                    label="Hotels lost by month"
                    height={150}
                    color="var(--series-3)"
                    data={d.churn.byMonth.map((m) => ({ x: m.month, y: m.churned }))}
                    formatX={(s) => new Date(`${s}-01T12:00:00`).toLocaleString("en-GB", { month: "short" })}
                    tipLabel={(s) => new Date(`${s}-01T12:00:00`).toLocaleString("en-GB", { month: "long", year: "numeric" })}
                  />
                ) : (
                  <Skeleton className="h-[150px]" />
                )}
                <div className="flex flex-col justify-center gap-3 border-line text-[13px] md:border-l md:pl-6">
                  <p className="text-ink-muted">Churn rate is hotels lost in 30 days over paying hotels 30 days ago. Trials that lapse without paying are not churn.</p>
                  <Link href="/tenants?status=SUSPENDED" className="inline-flex items-center gap-1.5 text-adire hover:underline">
                    Suspended hotels <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function HealthStrip({ h }: { h: SystemHealthSummary }) {
  const items: [string, number, string][] = [
    ["failed jobs", h.failedJobs, "/system#queues"],
    ["webhook failures", h.webhookFailures24h, "/system#webhooks"],
    ["notification failures", h.notificationFailures24h, "/system#notifications"],
    ["channel sync errors", h.channelSyncErrors24h, "/system#channels"],
    ["overdue crons", h.overdueCrons, "/system#crons"],
    ["unhealthy databases", h.dedicatedDbsUnhealthy, "/databases"],
  ];
  const issues = items.filter(([, n]) => n > 0);
  const ok = h.status === "ok" && issues.length === 0;
  const down = h.status === "down";
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center",
        ok
          ? "border-[color-mix(in_oklab,var(--palm)_30%,transparent)] bg-palm-wash"
          : down
            ? "border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] bg-laterite-wash"
            : "border-[color-mix(in_oklab,var(--ochre)_30%,transparent)] bg-ochre-wash",
      )}
      data-testid="health-strip"
    >
      <span className={cn("flex shrink-0 items-center gap-2 text-[13.5px] font-medium", ok ? "text-palm" : down ? "text-laterite" : "text-ochre")}>
        {ok ? <CheckCircle size={18} weight="duotone" /> : down ? <WarningDiamond size={18} weight="duotone" /> : <Pulse size={18} weight="duotone" />}
        {ok ? "All systems normal" : down ? "Something is down" : "Degraded"}
      </span>
      {!ok && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink">
          {issues.map(([label, n, href]) => (
            <li key={label}>
              <Link href={href} className="hover:underline">
                <span className="font-mono">{n}</span> {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/system" className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-ink-muted hover:text-ink sm:ml-auto">
        System health <ArrowRight size={12} />
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Plugs } from "@phosphor-icons/react";
import { useApiUsage } from "@/lib/api/hooks";
import { addDays, todayKey } from "@/lib/dates";
import { formatDate, number, relativeTime } from "@/lib/format";
import { AreaChart, RankBar } from "@/components/charts/trend";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { Figure, FigureRow, Gate } from "@/components/ui/kit";

type Range = "7" | "30" | "90";

export function ApiUsageView() {
  return (
    <Gate perm="tenants.view">
      <View />
    </Gate>
  );
}

function View() {
  const [range, setRange] = useState<Range>("30");
  const to = todayKey();
  const from = addDays(to, -(Number(range) - 1));
  const u = useApiUsage({ from, to });
  const d = u.data;
  const errRate = d && d.totals.requests ? (d.totals.errors / d.totals.requests) * 100 : 0;
  const max = Math.max(1, ...(d?.byTenant ?? []).map((t) => t.requests));
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Plugs size={14} weight="duotone" /> Partner API
          </>
        }
        title={
          <>
            Who is <em>building on us</em>.
          </>
        }
        description="Calls to the partner API by Enterprise hotels and their integrators, metered per key per day."
        actions={
          <Segmented<Range>
            label="Range"
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
          />
        }
      />
      {u.isError ? (
        <Panel>
          <ErrorState error={u.error} onRetry={() => u.refetch()} />
        </Panel>
      ) : (
        <>
          <FigureRow className="mb-6">
            <Figure label="Requests" value={d ? number(d.totals.requests) : null} tone="adire" loading={!d} />
            <Figure label="Writes" value={d ? number(d.totals.writes) : null} loading={!d} sub={d && d.totals.requests ? `${Math.round((d.totals.writes / d.totals.requests) * 100)}% of calls` : undefined} />
            <Figure label="Errors" value={d ? number(d.totals.errors) : null} tone={errRate > 2 ? "danger" : "ink"} loading={!d} sub={d ? `${errRate.toFixed(2)}% error rate` : undefined} />
            <Figure label="Rate limited" value={d ? number(d.totals.rateLimited) : null} tone={d?.totals.rateLimited ? "ochre" : "ink"} loading={!d} sub="429 answers" />
          </FigureRow>
          <div className="grid gap-6 lg:grid-cols-12">
            <Panel className="lg:col-span-7">
              <PanelHeader eyebrow="Daily" title="Requests per day" />
              <div className="px-3 pb-4 pt-5 sm:px-5">
                {d ? (
                  <AreaChart
                    label="Partner API requests per day"
                    data={d.byDay.map((x) => ({ x: x.date, y: x.requests }))}
                    formatY={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
                    formatX={(s) => formatDate(s, { day: "numeric", month: "short", year: undefined })}
                  />
                ) : (
                  <Skeleton className="h-[200px]" />
                )}
              </div>
            </Panel>
            <Panel className="lg:col-span-5">
              <PanelHeader eyebrow="Daily" title="Errors per day" />
              <div className="px-3 pb-4 pt-5 sm:px-5">
                {d ? (
                  <AreaChart
                    label="Partner API errors per day"
                    color="var(--laterite)"
                    data={d.byDay.map((x) => ({ x: x.date, y: x.errors }))}
                    formatX={(s) => formatDate(s, { day: "numeric", month: "short", year: undefined })}
                  />
                ) : (
                  <Skeleton className="h-[200px]" />
                )}
              </div>
            </Panel>
            <Panel className="overflow-hidden lg:col-span-12">
              <PanelHeader eyebrow="By tenant" title="Heaviest users" />
              {!d ? (
                <Skeleton className="m-5 h-24" />
              ) : !d.byTenant.length ? (
                <EmptyState compact glyph="ladder" title="No partner API calls in this range" />
              ) : (
                <ul className="divide-y divide-line">
                  {d.byTenant
                    .slice()
                    .sort((a, b) => b.requests - a.requests)
                    .map((t) => (
                      <li key={t.tenant.id} className="grid items-center gap-x-6 gap-y-2 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                        <span className="min-w-0">
                          <Link href={`/tenants/${t.tenant.id}`} className="block truncate text-[13.5px] text-ink hover:underline">
                            {t.tenant.name}
                          </Link>
                          <span className="text-[12px] text-ink-muted">
                            {t.keys} {t.keys === 1 ? "key" : "keys"} &middot; last call {t.lastUsedAt ? relativeTime(t.lastUsedAt) : "never"}
                          </span>
                        </span>
                        <RankBar value={t.requests} max={max} />
                        <span className="flex gap-4 font-mono text-[12px] md:justify-end">
                          <span className="text-ink">{number(t.requests)}</span>
                          <span className="text-laterite">{number(t.errors)} err</span>
                          <span className="text-ochre">{number(t.rateLimited)} 429</span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

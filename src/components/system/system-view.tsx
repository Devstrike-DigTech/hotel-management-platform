"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowClockwise,
  ArrowsClockwise,
  ChatCircleDots,
  CheckCircle,
  Clock,
  CreditCard,
  Database,
  Gauge,
  Play,
  Plugs,
  Queue,
  Trash,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { systemApi } from "@/lib/api/endpoints";
import { qk, useFailedJobs, useHealth } from "@/lib/api/hooks";
import type { QueueStat, SystemHealth } from "@/lib/api/types-m6";
import { bytes, duration, formatDateTime, number, relativeTime, titleCase } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { RankBar } from "@/components/charts/trend";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { Sheet } from "@/components/ui/overlay";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { Th } from "@/components/ui/table";
import { Figure, FigureRow, Gate } from "@/components/ui/kit";

export function SystemView() {
  return (
    <Gate perm="system.view">
      <View />
    </Gate>
  );
}

function View() {
  const h = useHealth();
  const [queue, setQueue] = useState<string | null>(null);
  const d = h.data;
  const s = d?.summary;
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Gauge size={14} weight="duotone" /> System health
          </>
        }
        title={
          <>
            The machinery, <em>under the floor</em>.
          </>
        }
        description="Queues, deliveries, channel syncs, payments, scheduled jobs and storage. Refreshes every 30 seconds; retrying and clearing jobs asks for your code."
        actions={
          <div className="flex items-center gap-3">
            {d && (
              <span className="font-mono text-[11.5px] text-ink-muted" suppressHydrationWarning>
                as of {new Date(d.generatedAt).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={() => h.refetch()} loading={h.isFetching && !h.isLoading}>
              <ArrowClockwise size={14} /> Refresh
            </Button>
          </div>
        }
      />
      {h.isError ? (
        <Panel>
          <ErrorState error={h.error} onRetry={() => h.refetch()} />
        </Panel>
      ) : (
        <>
          <FigureRow cols={5} className="mb-6">
            <Figure label="Status" value={s ? <StatusWord s={s.status} /> : null} loading={!s} sub={s ? `${s.overdueCrons} overdue ${s.overdueCrons === 1 ? "cron" : "crons"}` : undefined} />
            <Figure label="Failed jobs" value={s ? number(s.failedJobs) : null} tone={s?.failedJobs ? "danger" : "ink"} loading={!s} sub="across all queues" />
            <Figure label="Webhook failures" value={s ? number(s.webhookFailures24h) : null} tone={s?.webhookFailures24h ? "danger" : "ink"} loading={!s} sub={d ? `${d.webhooks.disabledEndpoints} ${d.webhooks.disabledEndpoints === 1 ? "endpoint" : "endpoints"} disabled` : undefined} />
            <Figure label="Delivery failures" value={s ? number(s.notificationFailures24h) : null} tone={s?.notificationFailures24h ? "ochre" : "ink"} loading={!s} sub="email, SMS, WhatsApp, 24h" />
            <Figure label="Channel sync errors" value={s ? number(s.channelSyncErrors24h) : null} tone={s?.channelSyncErrors24h ? "ochre" : "ink"} loading={!s} sub="last 24 hours" />
          </FigureRow>

          {!d ? (
            <Skeleton className="h-80 w-full rounded-lg" />
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-12">
              <Queues d={d} onOpen={setQueue} />
              <Crons d={d} />
              <Notifications d={d} />
              <Webhooks d={d} />
              <Channels d={d} />
              <Paystack d={d} />
              <Storage d={d} />
            </div>
          )}
        </>
      )}
      <FailedSheet queue={queue} onClose={() => setQueue(null)} />
    </>
  );
}

function StatusWord({ s }: { s: "ok" | "degraded" | "down" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-sans text-[26px] tracking-tight md:text-[28px]", s === "ok" ? "text-palm" : s === "down" ? "text-laterite" : "text-ochre")}>
      <span className="live-dot" style={{ width: 9, height: 9 }} aria-hidden />
      {s === "ok" ? "Normal" : s === "down" ? "Down" : "Degraded"}
    </span>
  );
}

function Section({ id, icon: I, eyebrow, title, description, actions, className, children }: { id: string; icon: typeof Queue; eyebrow: string; title: string; description?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Panel id={id} className={cn("scroll-mt-20 overflow-hidden", className)}>
      <PanelHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <I size={13} weight="duotone" /> {eyebrow}
          </span>
        }
        title={title}
        description={description}
        actions={actions}
      />
      {children}
    </Panel>
  );
}

function Queues({ d, onOpen }: { d: SystemHealth; onOpen: (q: string) => void }) {
  return (
    <Section id="queues" icon={Queue} eyebrow="BullMQ" title="Queues" className="lg:col-span-7">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <Th className="pl-5">Queue</Th>
              <Th className="text-right">Waiting</Th>
              <Th className="text-right">Active</Th>
              <Th className="text-right">Delayed</Th>
              <Th className="text-right">Done</Th>
              <Th className="text-right">Failed</Th>
              <Th className="pr-5" />
            </tr>
          </thead>
          <tbody>
            {d.queues.map((q: QueueStat) => (
              <tr key={q.name} className="border-b border-line last:border-b-0" data-testid={`queue-${q.name}`}>
                <td className="py-3 pl-5">
                  <span className="font-mono text-[13px] text-ink">{q.name}</span>
                  {q.paused && <Badge tone="ochre" className="ml-2">Paused</Badge>}
                </td>
                <td className="py-3 text-right font-mono text-ink">{number(q.waiting)}</td>
                <td className="py-3 text-right font-mono text-ink">{q.active ? <span className="text-adire">{q.active}</span> : 0}</td>
                <td className="py-3 text-right font-mono text-ink-muted">{number(q.delayed)}</td>
                <td className="py-3 text-right font-mono text-ink-muted">{number(q.completed)}</td>
                <td className={cn("py-3 text-right font-mono", q.failed ? "text-laterite" : "text-ink-faint")}>{number(q.failed)}</td>
                <td className="py-3 pr-5 text-right">
                  <Button size="sm" variant={q.failed ? "secondary" : "ghost"} disabled={!q.failed} onClick={() => onOpen(q.name)}>
                    Failed jobs
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Crons({ d }: { d: SystemHealth }) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: (name: string) => systemApi.runJob(name),
    onSuccess: (_r, name) => {
      toast.success("Job ran", name);
      void qc.invalidateQueries({ queryKey: qk.health });
    },
    meta: { errorTitle: "Job did not run" },
  });
  const runnable = new Set(["dunning", "holds-sweep", "guest-notifications", "webhooks-deliver", "announcements-email", "offboarding", "dedicated-purge", "public-listings", "api-usage-flush", "mirror-sync", "exports-cleanup", "white-label-checks", "provisioning-reconcile"]);
  return (
    <Section id="crons" icon={Clock} eyebrow="Scheduler" title="Scheduled jobs" description="Last run of every repeatable job" className="lg:col-span-5">
      <ul className="divide-y divide-line">
        {d.crons.map((c) => (
          <li key={c.job} className="flex items-center gap-3 px-5 py-2.5">
            {c.lastStatus === "FAILED" ? (
              <XCircle size={16} weight="fill" className="shrink-0 text-laterite" aria-label="Failed" />
            ) : c.overdue ? (
              <WarningCircle size={16} weight="fill" className="shrink-0 text-ochre" aria-label="Overdue" />
            ) : (
              <CheckCircle size={16} weight="fill" className="shrink-0 text-palm" aria-label="OK" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[12.5px] text-ink">{c.job}</span>
              <span className="block truncate text-[11.5px] text-ink-muted">
                {c.schedule} &middot; {c.lastRunAt ? relativeTime(c.lastRunAt) : "never"} {c.lastDurationMs != null && `in ${duration(c.lastDurationMs)}`}
                {c.overdue && <span className="text-ochre"> &middot; overdue</span>}
              </span>
              {c.lastError && <span className="block truncate text-[11.5px] text-laterite">{c.lastError}</span>}
            </span>
            {runnable.has(c.job) && (
              <Button size="icon-sm" variant="ghost" aria-label={`Run ${c.job} now`} title="Run now (asks for your code)" loading={run.isPending && run.variables === c.job} onClick={() => run.mutate(c.job)}>
                <Play size={13} weight="fill" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Notifications({ d }: { d: SystemHealth }) {
  return (
    <Section id="notifications" icon={ChatCircleDots} eyebrow="Deliveries" title="Email, SMS and WhatsApp" description="Sent and failed in the last 24 hours, by provider" className="lg:col-span-6">
      <ul className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3">
        {d.notifications.byChannel.map((c) => (
          <li key={`${c.channel}-${c.provider}`} className="bg-surface px-5 py-4">
            <p className="eyebrow text-[9.5px]">
              {titleCase(c.channel)} <span className="normal-case tracking-normal text-ink-faint">{c.provider}</span>
            </p>
            <p className="mt-1 font-mono text-[18px] text-ink">{number(c.sent24h)}</p>
            <p className={cn("font-mono text-[11.5px]", c.failed24h ? "text-laterite" : "text-ink-faint")}>{c.failed24h} failed</p>
          </li>
        ))}
      </ul>
      <FailureList
        empty="No failed deliveries"
        rows={d.notifications.recentFailures.map((f) => ({
          key: f.id,
          title: `${titleCase(f.template)} by ${titleCase(f.channel)}`,
          meta: `${f.tenant?.name ?? "Platform"} · ${f.recipient}`,
          error: f.error,
          at: f.createdAt,
          href: f.tenant ? `/tenants/${f.tenant.id}` : undefined,
        }))}
      />
    </Section>
  );
}

function Webhooks({ d }: { d: SystemHealth }) {
  return (
    <Section id="webhooks" icon={Plugs} eyebrow="Outbound webhooks" title="Delivery failures" description={`${d.webhooks.failed24h} in 24 hours, ${d.webhooks.disabledEndpoints} endpoints disabled`} className="lg:col-span-6">
      <FailureList
        empty="Every delivery succeeded"
        rows={d.webhooks.recentFailures.map((f) => ({
          key: f.deliveryId,
          title: f.eventType,
          mono: true,
          meta: `${f.tenant.name} · ${f.endpointUrl.replace(/^https?:\/\//, "")}`,
          error: `${f.responseStatus ? `HTTP ${f.responseStatus}: ` : ""}${f.error ?? ""} (${f.attempts} ${f.attempts === 1 ? "attempt" : "attempts"})`,
          at: f.at,
          href: `/tenants/${f.tenant.id}`,
        }))}
      />
    </Section>
  );
}

function Channels({ d }: { d: SystemHealth }) {
  return (
    <Section id="channels" icon={ArrowsClockwise} eyebrow="Channel manager" title="Sync errors" description="iCal imports and Channex pushes, 24 hours" className="lg:col-span-6">
      <FailureList
        empty="All channels in sync"
        rows={d.channelSync.recent.map((f, i) => ({ key: `${f.tenant.id}-${i}`, title: `${f.propertyName}`, meta: titleCase(f.kind), error: f.message, at: f.at, href: `/tenants/${f.tenant.id}` }))}
      />
    </Section>
  );
}

function Paystack({ d }: { d: SystemHealth }) {
  return (
    <Section id="paystack" icon={CreditCard} eyebrow="Paystack" title="Webhook log" description={`${number(d.paystack.events24h)} events in 24 hours`} className="lg:col-span-6">
      <ul className="divide-y divide-line">
        {d.paystack.recent.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[12.5px]">
            <span className="font-mono text-ink">{e.eventType}</span>
            <span className="min-w-0 flex-1 truncate text-ink-muted">{e.tenant?.name ?? "Platform"}</span>
            {e.processed ? <Badge tone="palm">Processed</Badge> : <Badge tone="ochre">Pending</Badge>}
            <span className="w-20 shrink-0 text-right text-ink-faint" suppressHydrationWarning>
              {relativeTime(e.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Storage({ d }: { d: SystemHealth }) {
  const rows = d.database.tenants.slice(0, 12);
  const max = Math.max(1, ...rows.map((r) => r.sizeBytes ?? r.estimatedBytes));
  return (
    <Section
      id="database"
      icon={Database}
      eyebrow="Postgres"
      title="Database size by tenant"
      description={`Shared database ${bytes(d.database.sharedSizeBytes)}. Dedicated sizes are measured; shared ones estimated from rows.`}
      className="lg:col-span-12"
      actions={
        <Link href="/databases" className="text-[13px] text-adire hover:underline">
          Dedicated databases
        </Link>
      }
    >
      <ul className="grid gap-x-10 gap-y-3 px-5 py-5 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.tenant.id} className="grid grid-cols-[minmax(0,1fr)_80px] items-center gap-x-4 gap-y-1.5">
            <span className="flex min-w-0 items-center gap-2 text-[13px]">
              <Link href={`/tenants/${r.tenant.id}`} className="truncate text-ink hover:underline">
                {r.tenant.name}
              </Link>
              {r.mode === "DEDICATED" && <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-adire">dedicated</span>}
            </span>
            <span className="text-right font-mono text-[12px] text-ink">
              {r.mode === "DEDICATED" ? bytes(r.sizeBytes) : `~${bytes(r.estimatedBytes)}`}
            </span>
            <span className="col-span-2">
              <RankBar value={r.sizeBytes ?? r.estimatedBytes} max={max} color={r.mode === "DEDICATED" ? "var(--series-1)" : "var(--series-3)"} hatch={r.mode !== "DEDICATED"} />
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-[12px] text-ink-muted">
        <span className="mr-4 inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-xs" style={{ background: "var(--series-1)" }} /> Dedicated, measured
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="hatch h-2 w-3 rounded-xs border" style={{ color: "var(--series-3)", borderColor: "var(--series-3)" }} /> Shared, estimated
        </span>
      </p>
    </Section>
  );
}

function FailureList({ rows, empty }: { rows: { key: string; title: string; meta: string; error: string | null; at: string; href?: string; mono?: boolean }[]; empty: string }) {
  if (!rows.length) return <EmptyState compact glyph="frond" title={empty} />;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.key} className="px-5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("min-w-0 truncate text-[13px] text-ink", r.mono && "font-mono text-[12.5px]")}>{r.title}</span>
            <span className="shrink-0 font-mono text-[11px] text-ink-faint" title={formatDateTime(r.at)} suppressHydrationWarning>
              {relativeTime(r.at)}
            </span>
          </div>
          <p className="truncate text-[12px] text-ink-muted">{r.href ? <Link href={r.href} className="hover:underline">{r.meta}</Link> : r.meta}</p>
          {r.error && <p className="mt-0.5 line-clamp-2 font-mono text-[11.5px] text-laterite">{r.error}</p>}
        </li>
      ))}
    </ul>
  );
}

function FailedSheet({ queue, onClose }: { queue: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const jobs = useFailedJobs(queue);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const done = () => {
    setSel(new Set());
    void qc.invalidateQueries({ queryKey: qk.health });
    void qc.invalidateQueries({ queryKey: qk.failed(queue ?? "") });
  };
  const retry = useMutation({
    mutationFn: (ids?: string[]) => systemApi.retry(queue!, ids),
    onSuccess: (r) => {
      toast.success(`${r.retried} ${r.retried === 1 ? "job" : "jobs"} back in the queue`, queue ?? undefined);
      done();
    },
    meta: { errorTitle: "Not retried" },
  });
  const clean = useMutation({
    mutationFn: (ids?: string[]) => systemApi.clean(queue!, ids),
    onSuccess: (r) => {
      toast.success(`${r.removed} failed ${r.removed === 1 ? "job" : "jobs"} cleared`, queue ?? undefined);
      done();
    },
    meta: { errorTitle: "Not cleared" },
  });
  const list = jobs.data ?? [];
  const ids = sel.size ? [...sel] : undefined;
  return (
    <Sheet
      open={!!queue}
      onOpenChange={(o) => {
        if (!o) {
          setSel(new Set());
          onClose();
        }
      }}
      width="max-w-[620px]"
      eyebrow={<span className="font-mono normal-case tracking-normal">queue: {queue}</span>}
      title="Failed jobs"
      description="Retrying puts jobs back at the front of the queue. Clearing removes them for good. Both ask for your code."
      footer={
        <>
          <Button variant="ghost" className="text-laterite" disabled={!list.length} loading={clean.isPending} onClick={() => clean.mutate(ids)}>
            <Trash size={14} /> {sel.size ? `Clear ${sel.size}` : "Clear all"}
          </Button>
          <Button className="ml-auto" disabled={!list.length} loading={retry.isPending} onClick={() => retry.mutate(ids)} data-testid="retry-jobs">
            <ArrowClockwise size={14} /> {sel.size ? `Retry ${sel.size}` : `Retry all ${list.length}`}
          </Button>
        </>
      }
    >
      {jobs.isLoading ? (
        <Skeleton className="h-40" />
      ) : !list.length ? (
        <EmptyState compact glyph="frond" title="No failed jobs" />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((j) => (
            <li key={j.id} className="rounded-md border border-line bg-surface">
              <div className="flex items-start gap-3 px-3 py-2.5">
                <div className="pt-0.5">
                  <Checkbox
                    checked={sel.has(j.id)}
                    onChange={(v) =>
                      setSel((s) => {
                        const n = new Set(s);
                        if (v) n.add(j.id);
                        else n.delete(j.id);
                        return n;
                      })
                    }
                    label={<span className="sr-only">Select job {j.id}</span>}
                  />
                </div>
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === j.id ? null : j.id)} aria-expanded={open === j.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px] text-ink">{j.name}</span>
                    <span className="font-mono text-[11px] text-ink-faint">#{j.id}</span>
                    <span className="ml-auto text-[11.5px] text-ink-muted">
                      {j.attemptsMade} {j.attemptsMade === 1 ? "try" : "tries"} &middot; {relativeTime(j.timestamp)}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block break-words text-[12.5px] text-laterite" title={j.failedReason}>
                    {j.failedReason.split("\n")[0]}
                  </span>
                </button>
              </div>
              {open === j.id && (
                <pre className="scrollbar-thin max-h-60 overflow-auto whitespace-pre-wrap break-words border-t border-line bg-surface-2/60 px-3 py-2 font-mono text-[11.5px] text-ink-muted">
                  {j.failedReason}
                  {"\n\n"}
                  {JSON.stringify(j.data, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

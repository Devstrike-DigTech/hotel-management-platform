"use client";

import Link from "next/link";
import { ArrowRight, Database, DownloadSimple, Globe, Key, Plugs, SignIn } from "@phosphor-icons/react";
import { useTenantExports, useTenantUsage } from "@/lib/api/hooks";
import type { TenantDetailM6 } from "@/lib/api/types-m6";
import { bytes, formatDate, formatDateTime, number, relativeTime, titleCase } from "@/lib/format";
import { useCan } from "@/lib/session";
import { AreaChart } from "@/components/charts/trend";
import { Badge, EmptyState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { KV } from "@/components/ui/kit";
import { DbStatusBadge } from "@/components/databases/db-bits";

export function InfrastructureTab({ tenant }: { tenant: TenantDetailM6 }) {
  const can = useCan();
  const db = tenant.dedicatedDb;
  const usage = useTenantUsage(tenant.id, (tenant.apiUsage?.keys ?? 0) > 0);
  const exports = useTenantExports(tenant.id);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Panel className="lg:col-span-6">
        <PanelHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <Database size={13} weight="duotone" /> Database
            </span>
          }
          title={db?.mode === "DEDICATED" ? "Dedicated database" : "Shared database"}
          actions={db && <DbStatusBadge mode={db.mode} status={db.status} />}
        />
        <div className="px-5 py-5">
          {db?.mode === "DEDICATED" ? (
            <KV
              rows={[
                ["Database", <span key="d" className="font-mono text-[12.5px]">{db.dbName}</span>],
                ["Host", <span key="h" className="font-mono text-[12.5px]">{db.host ?? "-"}</span>],
                ["Schema version", <span key="v" className="font-mono text-[12px]">{db.version ?? "-"}</span>],
                ["Active since", formatDate(db.activatedAt)],
                ["Size", bytes(db.sizeBytes)],
                ["Shared copy", db.sharedCopyPurgedAt ? `purged ${formatDate(db.sharedCopyPurgedAt)}` : db.sharedCopyPurgeAfter ? `kept until ${formatDate(db.sharedCopyPurgeAfter)}` : "-"],
              ]}
            />
          ) : (
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              This hotel&rsquo;s rows live in the shared database, separated by row-level security.
              {db?.currentProvisioning ? " A move to a dedicated database is running." : ""}
            </p>
          )}
          {can("dedicated_db.manage") && (
            <Link href={`/databases/${tenant.id}`} className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-adire hover:underline">
              {db?.currentProvisioning ? "Watch the provisioning" : db?.mode === "DEDICATED" ? "Manage the database" : "Move to a dedicated database"} <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </Panel>

      <Panel className="lg:col-span-6">
        <PanelHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <Globe size={13} weight="duotone" /> Domains and brand
            </span>
          }
          title="White-label"
          actions={<Badge tone={tenant.whiteLabel?.enabled ? "brass" : "neutral"}>{tenant.whiteLabel?.enabled ? "On" : "Off"}</Badge>}
        />
        <div className="px-5 py-4">
          {tenant.domains?.length ? (
            <ul className="mb-4 flex flex-col gap-2">
              {tenant.domains.map((d) => (
                <li key={d.domain + d.kind} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate font-mono text-[12.5px] text-ink">{d.domain}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[11.5px] text-ink-muted">{d.kind === "STAFF_PORTAL" ? "Staff portal" : "Booking site"}</span>
                    <Badge tone={d.status === "VERIFIED" ? "palm" : d.status === "FAILED" ? "danger" : "ochre"}>{titleCase(d.status)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-[13px] text-ink-muted">No custom domains.</p>
          )}
          <KV
            rows={[
              ["Email sending domain", tenant.whiteLabel?.emailDomain ? `${tenant.whiteLabel.emailDomain} (${titleCase(tenant.whiteLabel.emailDomainStatus ?? "")})` : "-"],
              ["SMS sender ID", tenant.whiteLabel?.smsSenderId ? `${tenant.whiteLabel.smsSenderId} (${titleCase(tenant.whiteLabel.smsSenderStatus ?? "")})` : "-"],
              [
                <span key="s" className="inline-flex items-center gap-1.5">
                  <SignIn size={13} /> Single sign-on
                </span>,
                tenant.sso?.enabled ? `${tenant.sso.provider ?? "OIDC"}${tenant.sso.enforced ? ", enforced" : ""}` : "Off",
              ],
            ]}
          />
        </div>
      </Panel>

      <Panel className="lg:col-span-8">
        <PanelHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <Plugs size={13} weight="duotone" /> Partner API
            </span>
          }
          title="Requests, 30 days"
          description={tenant.apiUsage?.lastUsedAt ? `Last call ${relativeTime(tenant.apiUsage.lastUsedAt)}` : "No calls recorded"}
        />
        {!tenant.apiUsage?.keys ? (
          <EmptyState compact glyph="ladder" title="No API keys" body="The hotel has not created partner API keys." />
        ) : usage.data ? (
          <>
            <div className="px-3 pb-2 pt-4 sm:px-5">
              <AreaChart
                label="Partner API requests per day"
                height={170}
                data={usage.data.byDay.map((d) => ({ x: d.date, y: d.requests }))}
                formatY={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
                formatX={(s) => formatDate(s, { day: "numeric", month: "short", year: undefined })}
              />
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {usage.data.keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13px]">
                  <Key size={14} className="text-ink-muted" />
                  <span className="text-ink">{k.name}</span>
                  <span className="font-mono text-[11.5px] text-ink-muted">{k.prefix}</span>
                  <Badge tone={k.environment === "LIVE" ? "adire" : "neutral"}>{k.environment === "LIVE" ? "Live" : "Test"}</Badge>
                  <span className="ml-auto font-mono text-[12px] text-ink">{number(k.requests)} req</span>
                  <span className="font-mono text-[12px] text-laterite">{number(k.errors)} err</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Skeleton className="m-5 h-40" />
        )}
      </Panel>

      <Panel className="lg:col-span-4">
        <PanelHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <DownloadSimple size={13} weight="duotone" /> Exports
            </span>
          }
          title="Full data exports"
        />
        {exports.data?.length ? (
          <ul className="divide-y divide-line">
            {exports.data.map((e) => (
              <li key={e.id} className="px-5 py-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink">{e.reason === "OFFBOARDING" ? "Offboarding export" : "Export"}</span>
                  <Badge tone={e.status === "READY" ? "palm" : e.status === "FAILED" ? "danger" : e.status === "EXPIRED" ? "neutral" : "adire"}>
                    {e.status === "RUNNING" ? `${e.progressPct}%` : titleCase(e.status)}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {formatDateTime(e.createdAt)}
                  {e.sizeBytes ? ` · ${bytes(e.sizeBytes)}` : ""}
                </p>
                {e.downloadUrl && e.status === "READY" && (
                  <a href={e.downloadUrl} className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] text-adire hover:underline" rel="noopener noreferrer">
                    <DownloadSimple size={13} /> {e.fileName ?? "Download"}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact glyph="dots" title="No exports yet" body="Actions, then Export all data." />
        )}
      </Panel>
    </div>
  );
}

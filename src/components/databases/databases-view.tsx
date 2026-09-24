"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle, Database, Stack, XCircle } from "@phosphor-icons/react";
import { databasesApi } from "@/lib/api/endpoints";
import { qk, useDatabases, useTenants } from "@/lib/api/hooks";
import { bytes, formatDate, formatDateTime } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { Gate } from "@/components/ui/kit";
import { DbStatusBadge } from "./db-bits";

export function DatabasesView() {
  return (
    <Gate perm="dedicated_db.manage">
      <View />
    </Gate>
  );
}

function View() {
  const me = useMe().data;
  const dbs = useDatabases();
  const candidates = useTenants({ plan: "enterprise", dbMode: "SHARED", pageSize: 50 });
  const [results, setResults] = useState<Awaited<ReturnType<typeof databasesApi.migrateAll>>["results"] | null>(null);
  const qc = useQueryClient();
  const migrate = useMutation({
    mutationFn: databasesApi.migrateAll,
    onSuccess: (r) => {
      setResults(r.results);
      void qc.invalidateQueries({ queryKey: qk.databases });
    },
    meta: { errorTitle: "Migrations not run" },
  });
  const list = dbs.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Database size={14} weight="duotone" /> Dedicated databases
          </>
        }
        title={
          <>
            A database <em>of their own</em>.
          </>
        }
        description="Enterprise hotels can move off the shared database. Provisioning copies every row, verifies counts and checksums, then flips routing after a read-only window of a few seconds."
        actions={
          me?.role === "SUPER_ADMIN" && (
            <Button variant="secondary" loading={migrate.isPending} onClick={() => migrate.mutate()}>
              <Stack size={15} /> Migrate every database
            </Button>
          )
        }
      />

      <Panel className="mb-6 overflow-hidden">
        <PanelHeader eyebrow="Registry" title="Tenant databases" description="Connection strings are encrypted at rest and never shown" />
        {dbs.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : dbs.isError ? (
          <ErrorState error={dbs.error} onRetry={() => dbs.refetch()} />
        ) : !list.length ? (
          <EmptyState compact glyph="cross" title="No dedicated databases yet" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((d) => (
              <li key={d.tenantId}>
                <Link href={`/databases/${d.tenantId}`} className="grid gap-x-6 gap-y-1 px-5 py-4 hover:bg-surface-2/50 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <span>
                    <span className="block text-[14px] font-medium text-ink">{d.tenant.name}</span>
                    <span className="block font-mono text-[12px] text-ink-muted">{d.dbName ?? "provisioning"}</span>
                  </span>
                  <span className="text-[12.5px] text-ink-muted">
                    <span className="block font-mono text-ink">{d.version ?? "-"}</span>
                    migrated {formatDate(d.lastMigratedAt)}
                  </span>
                  <span className="text-[12.5px] text-ink-muted">
                    <span className="block font-mono text-ink">{bytes(d.sizeBytes)}</span>
                    {d.sharedCopyPurgedAt ? "shared copy purged" : d.sharedCopyPurgeAfter ? `shared copy until ${formatDate(d.sharedCopyPurgeAfter)}` : ""}
                  </span>
                  <span className="flex items-center gap-3 md:justify-end">
                    <DbStatusBadge mode={d.mode} status={d.currentProvisioning?.status ?? d.status} />
                    <ArrowRight size={14} className="text-ink-faint" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Candidates" title="Enterprise hotels on the shared database" />
        {candidates.isLoading ? (
          <Skeleton className="m-5 h-10" />
        ) : !candidates.data?.items.length ? (
          <EmptyState compact glyph="dots" title="Every Enterprise hotel has its own database" />
        ) : (
          <ul className="divide-y divide-line">
            {candidates.data.items.map((t) => (
              <li key={t.id} className="flex items-center gap-4 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{t.name}</span>
                  <span className="text-[12px] text-ink-muted">
                    {t.city} &middot; {t.rooms} rooms
                  </span>
                </span>
                <Link href={`/databases/${t.id}`} className="text-[13px] text-adire hover:underline">
                  Provision
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={!!results} onOpenChange={(o) => !o && setResults(null)} title="Migrations applied" eyebrow={formatDateTime(new Date().toISOString())}>
        <ul className="flex flex-col gap-2">
          {results?.map((r) => (
            <li key={r.target} className="flex items-start gap-3 text-[13px]">
              {r.ok ? <CheckCircle size={16} weight="fill" className="mt-0.5 text-palm" /> : <XCircle size={16} weight="fill" className="mt-0.5 text-laterite" />}
              <span className="min-w-0">
                <span className="font-mono text-ink">{r.target}</span>
                <span className="block text-[12px] text-ink-muted">{r.error ?? (r.applied.length ? r.applied.join(", ") : "already up to date")}</span>
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

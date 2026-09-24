"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Buildings, Database, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useTenants } from "@/lib/api/hooks";
import type { TenantRowM6 } from "@/lib/api/types-m6";
import { PLAN_ORDER, SUB_STATUS, SUB_STATUS_ORDER, planName } from "@/lib/catalog";
import { daysUntil, formatDate, nairaCompact } from "@/lib/format";
import { useCan } from "@/lib/session";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { Th } from "@/components/ui/table";
import { Gate, Pager, Toolbar } from "@/components/ui/kit";

export function TenantsView() {
  return (
    <Gate perm="tenants.view">
      <Tenants />
    </Gate>
  );
}

function Tenants() {
  const params = useSearchParams();
  const router = useRouter();
  const can = useCan();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const [plan, setPlan] = useState(params.get("plan") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [dbMode, setDbMode] = useState(params.get("dbMode") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "name");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  // keep filters in the URL so a view can be shared
  useEffect(() => {
    const sp = new URLSearchParams();
    if (debounced) sp.set("q", debounced);
    if (plan) sp.set("plan", plan);
    if (status) sp.set("status", status);
    if (dbMode) sp.set("dbMode", dbMode);
    if (sort !== "name") sp.set("sort", sort);
    const qs = sp.toString();
    router.replace(qs ? `/tenants?${qs}` : "/tenants", { scroll: false });
  }, [debounced, plan, status, dbMode, sort, router]);

  const pageSize = 20;
  const tenants = useTenants({ q: debounced || undefined, plan: plan || undefined, status: status || undefined, dbMode: dbMode || undefined, sort, page, pageSize });
  const items = tenants.data?.items ?? [];
  const total = tenants.data?.total ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Buildings size={14} weight="duotone" /> Tenants
          </>
        }
        title={
          <>
            Every hotel, <em>every plan</em>.
          </>
        }
        description="Search by name, slug or city. Open a tenant for its subscription, people, usage, databases and support history."
        actions={
          can("tenants.manage") && (
            <ButtonLink href="/tenants/new">
              <Plus size={15} weight="bold" /> New enterprise tenant
            </ButtonLink>
          )
        }
      />

      <Toolbar>
        <div className="relative flex-1 sm:min-w-[240px]">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hotels" className="pl-9" aria-label="Search tenants" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:[&>*]:w-[150px]">
          <Select aria-label="Plan" value={plan} onChange={(e) => (setPlan(e.target.value), setPage(1))}>
            <option value="">All plans</option>
            {PLAN_ORDER.map((p) => (
              <option key={p} value={p}>
                {planName(p)}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">All statuses</option>
            {SUB_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {SUB_STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select aria-label="Database" value={dbMode} onChange={(e) => (setDbMode(e.target.value), setPage(1))}>
            <option value="">Any database</option>
            <option value="SHARED">Shared</option>
            <option value="DEDICATED">Dedicated</option>
          </Select>
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Sort: name</option>
            <option value="created">Sort: newest</option>
            <option value="mrr">Sort: MRR</option>
          </Select>
        </div>
      </Toolbar>

      <Panel className="overflow-hidden">
        {tenants.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : tenants.isError ? (
          <ErrorState error={tenants.error} onRetry={() => tenants.refetch()} />
        ) : !items.length ? (
          <EmptyState glyph="dots" title="No hotels match" body="Try a different name, plan or status." />
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {items.map((t) => (
                <li key={t.id}>
                  <Link href={`/tenants/${t.id}`} className="flex flex-col gap-2 px-4 py-3.5 active:bg-surface-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-medium text-ink">{t.name}</span>
                        <span className="block truncate text-[12px] text-ink-muted">
                          {t.city ?? "-"} &middot; <span className="font-mono">{t.slug}</span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[13px] text-ink">{t.mrrKobo ? nairaCompact(t.mrrKobo) : "-"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PlanPlate name={planName(t.planCode)} code={t.planCode} />
                      <StatusBadge t={t} />
                      {t.dbMode === "DEDICATED" && <DbTag />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th className="pl-5">Hotel</Th>
                    <Th>City</Th>
                    <Th>Plan</Th>
                    <Th>Status</Th>
                    <Th className="text-right">MRR</Th>
                    <Th className="text-right">Rooms</Th>
                    <Th className="text-right">Staff</Th>
                    <Th className="pl-5">Database</Th>
                    <Th className="pr-5">Joined</Th>
                  </tr>
                </thead>
                <tbody className={cn(tenants.isFetching && "opacity-70 transition-opacity")}>
                  {items.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/tenants/${t.id}`)}
                      className={cn("cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2/60", t.lifecycle === "DELETED" && "opacity-55")}
                    >
                      <td className="py-3 pl-5">
                        <Link href={`/tenants/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:underline">
                          {t.name}
                        </Link>
                        <span className="block font-mono text-[11.5px] text-ink-faint">
                          {t.slug}
                          {t.properties > 1 && <span className="ml-2 text-ink-muted">{t.properties} properties</span>}
                        </span>
                      </td>
                      <td className="py-3 text-ink-muted">{t.city ?? "-"}</td>
                      <td className="py-3">
                        <PlanPlate name={planName(t.planCode)} code={t.planCode} />
                      </td>
                      <td className="py-3">
                        <StatusBadge t={t} />
                      </td>
                      <td className="py-3 text-right font-mono text-ink">{t.mrrKobo ? nairaCompact(t.mrrKobo) : <span className="text-ink-faint">-</span>}</td>
                      <td className="py-3 text-right font-mono text-ink">{t.rooms}</td>
                      <td className="py-3 text-right font-mono text-ink">{t.staff}</td>
                      <td className="py-3 pl-5">{t.dbMode === "DEDICATED" ? <DbTag /> : <span className="text-[12.5px] text-ink-faint">Shared</span>}</td>
                      <td className="py-3 pr-5 text-ink-muted">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {total > 0 && <Pager page={page} pageSize={tenants.data?.pageSize ?? pageSize} total={total} onPage={setPage} noun={total === 1 ? "hotel" : "hotels"} />}
      </Panel>
    </>
  );
}

function StatusBadge({ t }: { t: TenantRowM6 }) {
  if (t.lifecycle === "OFFBOARDING")
    return (
      <Badge tone="danger" dot>
        Offboarding
      </Badge>
    );
  if (t.lifecycle === "DELETED") return <Badge tone="neutral">Deleted</Badge>;
  const left = t.status === "TRIALING" ? daysUntil(t.trialEndsAt) : null;
  return (
    <Badge tone={SUB_STATUS[t.status]?.tone ?? "neutral"} dot>
      {SUB_STATUS[t.status]?.label ?? t.status}
      {left !== null && <span className="font-mono opacity-80">{left}d</span>}
    </Badge>
  );
}

function DbTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-xs border border-[color-mix(in_oklab,var(--adire)_30%,transparent)] bg-adire-wash px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-adire">
      <Database size={11} weight="bold" /> Dedicated
    </span>
  );
}

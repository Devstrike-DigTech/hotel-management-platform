"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { CaretDown, CaretRight, ClockCounterClockwise, DownloadSimple, MagnifyingGlass, X } from "@phosphor-icons/react";
import { auditApi } from "@/lib/api/endpoints";
import { useAudit, useUsers } from "@/lib/api/hooks";
import type { PlatformAuditItem } from "@/lib/api/types-m6";
import { PLATFORM_ROLES } from "@/lib/catalog";
import { addDays, todayKey } from "@/lib/dates";
import { deviceName, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { useCan } from "@/lib/session";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { Gate, Pager, Toolbar } from "@/components/ui/kit";

const PREFIXES = [
  ["", "Every action"],
  ["auth.", "Sign-ins and step-ups"],
  ["tenant.", "Tenants"],
  ["impersonation.", "Impersonation"],
  ["announcement.", "Announcements"],
  ["support.", "Support"],
  ["concierge.", "Concierge review"],
  ["coupon.", "Coupons"],
  ["plan.", "Plans"],
  ["commission.", "Commission"],
  ["system.", "System"],
  ["dedicated_db.", "Dedicated databases"],
  ["platform_user.", "Console users"],
  ["request.", "Raw requests"],
];

export function AuditView() {
  return (
    <Gate perm="audit.view">
      <View />
    </Gate>
  );
}

function View() {
  const params = useSearchParams();
  const can = useCan();
  const users = useUsers(can("platform_users.manage"));
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [action, setAction] = useState(params.get("action") ?? "");
  const [actorId, setActorId] = useState("");
  const [tenantId, setTenantId] = useState(params.get("tenantId") ?? "");
  const [from, setFrom] = useState(addDays(todayKey(), -29));
  const [to, setTo] = useState(todayKey());
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  useEffect(() => {
    const t = setTimeout(() => (setDeb(q.trim()), setPage(1)), 250);
    return () => clearTimeout(t);
  }, [q]);
  const query = { q: deb || undefined, action: action || undefined, actorId: actorId || undefined, tenantId: tenantId || undefined, from, to, page, pageSize: 30 };
  const list = useAudit(query);
  const items = list.data?.items ?? [];

  const doExport = async (format: "csv" | "json") => {
    setExporting(format);
    try {
      await auditApi.export({ from, to }, format);
      toast.success("Export downloaded", "The export itself is on the audit log.");
    } catch (e) {
      toast.error("Export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ClockCounterClockwise size={14} weight="duotone" /> Audit log
          </>
        }
        title={
          <>
            Every console action, <em>on the record</em>.
          </>
        }
        description="Append-only: the database refuses edits and deletes. Request bodies are stored with secrets removed."
        actions={
          <>
            <Button variant="secondary" size="sm" loading={exporting === "csv"} onClick={() => void doExport("csv")}>
              <DownloadSimple size={14} /> CSV
            </Button>
            <Button variant="secondary" size="sm" loading={exporting === "json"} onClick={() => void doExport("json")}>
              <DownloadSimple size={14} /> JSON
            </Button>
          </>
        }
      />
      <Toolbar>
        <div className="relative flex-1 sm:min-w-[220px]">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions, paths, reasons" className="pl-9" aria-label="Search the audit log" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select aria-label="Action" value={action} onChange={(e) => (setAction(e.target.value), setPage(1))} className="sm:w-[190px]">
            {PREFIXES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          {users.data && (
            <Select aria-label="Person" value={actorId} onChange={(e) => (setActorId(e.target.value), setPage(1))} className="sm:w-[170px]">
              <option value="">Everyone</option>
              {users.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          )}
          <Input type="date" aria-label="From" className="font-mono sm:w-[150px]" value={from} max={to} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
          <Input type="date" aria-label="To" className="font-mono sm:w-[150px]" value={to} min={from} onChange={(e) => (setTo(e.target.value), setPage(1))} />
        </div>
      </Toolbar>
      {tenantId && (
        <button onClick={() => setTenantId("")} className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-adire hover:underline">
          <X size={12} /> Showing one tenant only
        </button>
      )}
      <Panel className="overflow-hidden">
        {list.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !items.length ? (
          <EmptyState glyph="ladder" title="Nothing recorded" body="No actions match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow w-8 py-3 pl-4 text-[10px] font-normal" />
                  <th className="eyebrow py-3 text-[10px] font-normal">When</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Who</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Action</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Target</th>
                  <th className="eyebrow py-3 pr-5 text-right text-[10px] font-normal">Result</th>
                </tr>
              </thead>
              <tbody className={cn(list.isFetching && "opacity-70")}>
                {items.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="cursor-pointer border-b border-line hover:bg-surface-2/50" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                      <td className="py-2.5 pl-4 text-ink-faint">{open === a.id ? <CaretDown size={12} /> : <CaretRight size={12} />}</td>
                      <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-[11.5px] text-ink-muted">{formatDateTime(a.createdAt)}</td>
                      <td className="py-2.5 pr-4">
                        {a.actor ? (
                          <>
                            <span className="text-ink">{a.actor.fullName}</span>
                            <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{PLATFORM_ROLES[a.actor.role]?.label ?? a.actor.role}</span>
                          </>
                        ) : (
                          <span className="text-ink-muted">Anonymous</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[12px] text-ink">{a.action}</td>
                      <td className="py-2.5 pr-4 text-ink-muted">
                        {a.tenant ? (
                          <Link href={`/tenants/${a.tenant.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-ink hover:underline">
                            {a.tenant.name}
                          </Link>
                        ) : (
                          a.targetType ?? "-"
                        )}
                      </td>
                      <td className="py-2.5 pr-5 text-right font-mono text-[11.5px]">
                        {a.statusCode != null && <span className={a.statusCode >= 400 ? "text-laterite" : "text-palm"}>{a.statusCode}</span>}
                      </td>
                    </tr>
                    {open === a.id && (
                      <tr className="border-b border-line bg-surface-2/40">
                        <td />
                        <td colSpan={5} className="py-3 pr-5">
                          <Detail a={a} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!!list.data?.total && <Pager page={page} pageSize={30} total={list.data.total} onPage={setPage} noun="entries" />}
      </Panel>
    </>
  );
}

function Detail({ a }: { a: PlatformAuditItem }) {
  return (
    <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      <dl className="grid grid-cols-[70px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-ink-muted">Request</dt>
        <dd className="truncate font-mono text-ink">{a.method ? `${a.method} ${a.path}` : "-"}</dd>
        <dt className="text-ink-muted">IP</dt>
        <dd className="font-mono text-ink">{a.ip ?? "-"}</dd>
        <dt className="text-ink-muted">Device</dt>
        <dd className="text-ink">{deviceName(a.userAgent)}</dd>
        <dt className="text-ink-muted">Session</dt>
        <dd className="truncate font-mono text-ink">{a.sessionId ?? "-"}</dd>
        <dt className="text-ink-muted">Target</dt>
        <dd className="truncate font-mono text-ink">{a.targetType ? `${a.targetType} ${a.targetId ?? ""}` : "-"}</dd>
      </dl>
      <pre className="scrollbar-thin max-h-60 overflow-auto rounded-md border border-line bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-muted">
        {Object.keys(a.metadata ?? {}).length ? JSON.stringify(a.metadata, null, 2) : "No details recorded."}
      </pre>
    </div>
  );
}

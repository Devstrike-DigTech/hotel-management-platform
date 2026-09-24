"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowCounterClockwise, ArrowLeft, Check, CircleNotch, Database, Lock, Play, Trash, Warning, X } from "@phosphor-icons/react";
import { databasesApi } from "@/lib/api/endpoints";
import { qk, useProvisioning, useTenant } from "@/lib/api/hooks";
import type { Provisioning, ProvisioningStep, TenantDatabaseView } from "@/lib/api/types-m6";
import { bytes, duration, formatDate, formatDateTime, number } from "@/lib/format";
import { toast } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ErrorState, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Gate, KV } from "@/components/ui/kit";
import { DbStatusBadge } from "./db-bits";

const STEPS: { key: ProvisioningStep; label: string; hint: string }[] = [
  { key: "CREATE_DATABASE", label: "Create", hint: "An empty database" },
  { key: "MIGRATE", label: "Migrate", hint: "Every migration" },
  { key: "COPY", label: "Copy", hint: "Rows in FK order" },
  { key: "READ_ONLY_DELTA", label: "Delta", hint: "Brief read-only" },
  { key: "VERIFY", label: "Verify", hint: "Counts, checksums" },
  { key: "CUTOVER", label: "Cut over", hint: "Flip routing" },
];

export function ProvisioningView({ tenantId }: { tenantId: string }) {
  return (
    <Gate perm="dedicated_db.manage">
      <View tenantId={tenantId} />
    </Gate>
  );
}

function View({ tenantId }: { tenantId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const tenant = useTenant(tenantId);
  const db = useQuery({ queryKey: ["platform", "tenant", tenantId, "database"], queryFn: () => databasesApi.get(tenantId), refetchInterval: 5000 });
  const [chosen, setPid] = useState<string | null>(params.get("p"));
  const pid = db.data?.currentProvisioning?.id ?? chosen;
  const running = (p?: Provisioning) => !!p && !p.finishedAt && !["ACTIVE", "FAILED", "ROLLED_BACK"].includes(p.status);
  const prov = useProvisioning(pid, true);
  const live = running(prov.data);
  useEffect(() => {
    if (prov.data?.finishedAt) void db.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prov.data?.finishedAt]);

  const name = tenant.data?.name ?? "Tenant";
  return (
    <>
      <Link href="/databases" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Databases
      </Link>
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-3 flex items-center gap-2">
            <Database size={14} weight="duotone" /> Dedicated database
          </p>
          <h1 className="display text-[34px] leading-[1.04] text-ink md:text-[42px]">{tenant.isLoading ? <Skeleton className="h-10 w-72" /> : name}</h1>
        </div>
        {db.data && <DbStatusBadge mode={db.data.mode} status={prov.data && live ? prov.data.status : db.data.status} />}
      </div>

      {db.isError ? (
        <Panel>
          <ErrorState error={db.error} onRetry={() => db.refetch()} />
        </Panel>
      ) : !db.data ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : prov.data ? (
        <Live p={prov.data} db={db.data} tenantId={tenantId} onDone={() => router.replace(`/databases/${tenantId}?p=${prov.data!.id}`)} />
      ) : db.data.mode === "DEDICATED" ? (
        <Active db={db.data} tenantId={tenantId} onProvisioning={setPid} />
      ) : (
        <Start tenantId={tenantId} name={name} plan={tenant.data?.planCode} onStarted={setPid} />
      )}
    </>
  );
}

function Start({ tenantId, name, plan, onStarted }: { tenantId: string; name: string; plan?: string; onStarted: (id: string) => void }) {
  const qc = useQueryClient();
  const [source, setSource] = useState<"AUTO" | "URL">("AUTO");
  const [url, setUrl] = useState("");
  const start = useMutation({
    mutationFn: () => databasesApi.provision(tenantId, source === "URL" ? { source, url: url.trim() } : { source }),
    onSuccess: (p) => {
      toast.info("Provisioning started", name);
      onStarted(p.id);
      void qc.invalidateQueries({ queryKey: qk.databases });
    },
    meta: { errorTitle: "Provisioning not started" },
  });
  const urlOk = /^postgres(ql)?:\/\/.+/.test(url.trim());
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel>
        <PanelHeader eyebrow="Plan" title="What happens" description="Hotels keep working throughout; writes pause for a few seconds during the delta copy." />
        <ol className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.key} className="bg-surface px-5 py-4">
              <p className="font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</p>
              <p className="display-sm mt-1 text-[16px] text-ink">{s.label}</p>
              <p className="text-[12.5px] text-ink-muted">{s.hint}</p>
            </li>
          ))}
        </ol>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-muted">
          If verification fails, the new database is dropped and the hotel stays on the shared one. After cutover the shared copy is kept 7 days for rollback.
        </p>
      </Panel>
      <Panel className="h-fit">
        <div className="flex flex-col gap-5 p-5">
          <Segmented
            label="Where the database comes from"
            value={source}
            onChange={setSource}
            options={[
              { value: "AUTO", label: "Create it for me" },
              { value: "URL", label: "Use an empty one" },
            ]}
          />
          {source === "AUTO" ? (
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Creates <span className="font-mono text-ink">hotel_t_&lt;slug&gt;</span> on the configured database server with the admin role.
            </p>
          ) : (
            <Field label="Owner-role connection string" htmlFor="db-url" hint="An empty database. Stored encrypted; never shown again.">
              <Input id="db-url" type="password" autoComplete="off" className="font-mono text-[13px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="postgresql://owner:...@host:5432/dbname" />
            </Field>
          )}
          {plan && plan !== "enterprise" && (
            <p className="flex items-start gap-2 rounded-md bg-ochre-wash px-3 py-2 text-[12.5px] text-ochre">
              <Warning size={15} className="mt-0.5 shrink-0" /> This hotel is not on Enterprise; the API will refuse unless it has the dedicated database add-on.
            </p>
          )}
          <Button size="lg" disabled={source === "URL" && !urlOk} loading={start.isPending} onClick={() => start.mutate()} data-testid="provision">
            <Play size={15} weight="fill" /> Start provisioning
          </Button>
          <p className="text-[11.5px] text-ink-muted">Asks for your authenticator code.</p>
        </div>
      </Panel>
    </div>
  );
}

function Live({ p, db, tenantId, onDone }: { p: Provisioning; db: TenantDatabaseView; tenantId: string; onDone: () => void }) {
  const now = useNow(500);
  const finished = !!p.finishedAt || ["ACTIVE", "FAILED", "ROLLED_BACK"].includes(p.status);
  const currentIdx = p.step === "DONE" ? STEPS.length : p.step === "ROLLBACK" ? -1 : STEPS.findIndex((s) => s.key === p.step);
  const elapsed = (p.finishedAt ? new Date(p.finishedAt).getTime() : now) - new Date(p.startedAt).getTime();
  const inWindow = p.readOnlyWindow && !p.readOnlyWindow.endedAt;
  const rollback = p.kind === "ROLLBACK";
  const failed = p.status === "FAILED" || (p.status === "ROLLED_BACK" && !rollback);
  useEffect(() => {
    if (finished) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return (
    <div className="flex flex-col gap-6" data-testid="provisioning-live" data-status={p.status}>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-[10px]">
              {p.kind === "ROLLBACK" ? "Rollback to the shared database · " : ""}
              {finished ? (p.status === "FAILED" ? "Failed" : p.status === "ROLLED_BACK" ? "Rolled back" : "Complete") : "In progress"}
            </p>
            <p className="mt-1 flex items-baseline gap-3">
              <span className={cn("figure text-[44px] leading-none", failed ? "text-laterite" : finished ? "text-palm" : "text-adire")}>{p.progressPct}%</span>
              <span className="font-mono text-[13px] text-ink-muted">{duration(elapsed)} elapsed</span>
            </p>
          </div>
          <div className="text-[12.5px] text-ink-muted md:text-right">
            Started {formatDateTime(p.startedAt)}
            {p.requestedBy && <span className="block">by {p.requestedBy.fullName}</span>}
          </div>
        </div>
        <div className="relative h-1.5 overflow-hidden bg-surface-2" role="progressbar" aria-valuenow={p.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Provisioning progress">
          <div className={cn("absolute inset-y-0 left-0 transition-[width] duration-700 ease-out", failed ? "bg-laterite" : finished ? "bg-palm" : "bg-adire")} style={{ width: `${p.progressPct}%` }} />
          {!finished && <div className="absolute inset-y-0 w-1/4 animate-[sweep_1.8s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/40 to-transparent" />}
        </div>
        <ol className={cn("grid grid-cols-3 border-t border-line md:grid-cols-6", rollback && "hidden")} aria-label="Steps">
          {STEPS.map((s, i) => {
            const done = i < currentIdx || (finished && !failed);
            const cur = i === currentIdx && !finished;
            const bad = failed && i === Math.max(0, currentIdx);
            return (
              <li key={s.key} className={cn("relative border-line px-4 py-3.5 [&:not(:first-child)]:border-l max-md:[&:nth-child(4)]:border-l-0 max-md:[&:nth-child(-n+3)]:border-b", cur && "bg-adire-wash/50")}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border text-[10px]",
                      bad ? "border-laterite bg-laterite text-laterite-ink" : done ? "border-palm bg-palm text-white" : cur ? "border-adire text-adire" : "border-line-strong text-ink-faint",
                    )}
                  >
                    {bad ? <X size={11} weight="bold" /> : done ? <Check size={11} weight="bold" /> : cur ? <CircleNotch size={12} weight="bold" className="animate-spin" /> : <span className="font-mono">{i + 1}</span>}
                  </span>
                  <span className={cn("text-[13px]", cur ? "font-medium text-ink" : done ? "text-ink" : "text-ink-muted")}>{s.label}</span>
                </span>
                <span className="mt-1 block pl-7 text-[11.5px] text-ink-faint">{s.key === "READ_ONLY_DELTA" && p.readOnlyWindow?.durationMs ? `${duration(p.readOnlyWindow.durationMs)} read-only` : s.hint}</span>
              </li>
            );
          })}
        </ol>
      </Panel>

      {inWindow && (
        <div className="flex items-center gap-3 rounded-lg border border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash px-4 py-3 text-[13px] text-ochre" role="status">
          <Lock size={17} weight="duotone" />
          Hotel writes are paused for the delta copy:{" "}
          <span className="font-mono">{duration(now - new Date(p.readOnlyWindow!.startedAt).getTime())}</span>
          <span className="text-ink-muted">Staff see &ldquo;one moment&rdquo; and retry automatically.</span>
        </div>
      )}
      {p.error && (
        <p className="rounded-lg border border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] bg-laterite-wash px-4 py-3 text-[13px] text-laterite">{p.error}</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Tables" title="Copied and verified" description={`${p.tables.filter((t) => t.ok).length} of ${p.tables.length} verified`} />
          <ul className="scrollbar-thin max-h-[440px] divide-y divide-line overflow-y-auto">
            {p.tables.map((t) => {
              const pct = t.sourceRows ? (t.copiedRows / t.sourceRows) * 100 : 100;
              return (
                <li key={t.table} className="grid grid-cols-[minmax(0,1fr)_110px_22px] items-center gap-3 px-5 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[12.5px] text-ink">{t.table}</span>
                    <span className="relative mt-1 block h-1 overflow-hidden rounded-full bg-surface-2">
                      <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", t.ok === false ? "bg-laterite" : t.ok ? "bg-palm" : "bg-adire")} style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span className="text-right font-mono text-[11.5px] text-ink-muted">
                    {number(t.copiedRows)}
                    <span className="text-ink-faint">/{number(t.sourceRows)}</span>
                  </span>
                  <span title={t.ok ? `checksum ${t.targetChecksum}` : t.ok === false ? "mismatch" : "not verified yet"}>
                    {t.ok ? <Check size={14} weight="bold" className="text-palm" /> : t.ok === false ? <X size={14} weight="bold" className="text-laterite" /> : <span className="block h-1.5 w-1.5 rounded-full bg-line-strong" />}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
        <LogConsole logs={p.logs} live={!finished} />
      </div>

      {finished && !failed && db.mode === "DEDICATED" && <Active db={db} tenantId={tenantId} compact />}
    </div>
  );
}

function LogConsole({ logs, live }: { logs: Provisioning["logs"]; live: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-night-line bg-night text-night-ink">
      <div className="flex items-center justify-between border-b border-night-line px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-night-muted">Log</span>
        {live && (
          <span className="flex items-center gap-2 font-mono text-[10.5px] text-night-brass">
            <span className="live-dot" style={{ width: 6, height: 6 }} aria-hidden /> live
          </span>
        )}
      </div>
      <div ref={ref} className="scrollbar-night max-h-[440px] min-h-[260px] overflow-y-auto px-4 py-3 font-mono text-[12px] leading-[1.7]" role="log" aria-live="polite">
        {logs.map((l, i) => (
          <p key={i} className="grid grid-cols-[62px_minmax(0,1fr)] gap-3">
            <span className="text-night-muted">{new Date(l.at).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour12: false })}</span>
            <span className={cn(l.level === "error" ? "text-[#e0714b]" : l.level === "warn" ? "text-night-brass" : "text-night-ink")}>{l.message}</span>
          </p>
        ))}
        {live && <span className="inline-block h-3.5 w-2 animate-[breathe_1s_steps(2)_infinite] bg-night-adire align-middle" aria-hidden />}
      </div>
    </div>
  );
}

function Active({ db, tenantId, compact, onProvisioning }: { db: TenantDatabaseView; tenantId: string; compact?: boolean; onProvisioning?: (id: string) => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<"rollback" | "purge" | null>(null);
  const canRollback = !db.sharedCopyPurgedAt;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["platform", "tenant", tenantId] });
    void qc.invalidateQueries({ queryKey: qk.databases });
  };
  return (
    <Panel>
      <PanelHeader eyebrow="Now serving" title={db.dbName ?? "Dedicated database"} description="The hotel's reads and writes go here." />
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_280px]">
        <KV
          rows={[
            ["Host", <span key="h" className="font-mono text-[12.5px]">{db.host ?? "-"}</span>],
            ["Schema version", <span key="v" className="font-mono text-[12px]">{db.version ?? "-"}</span>],
            ["Last migrated", formatDateTime(db.lastMigratedAt)],
            ["Active since", formatDateTime(db.activatedAt)],
            ["Size", bytes(db.sizeBytes)],
            ["Shared copy", db.sharedCopyPurgedAt ? `purged ${formatDate(db.sharedCopyPurgedAt)}` : `kept until ${formatDate(db.sharedCopyPurgeAfter)}`],
          ]}
        />
        {!compact || canRollback ? (
          <div className="flex flex-col gap-2 border-line md:border-l md:pl-6">
            <p className="text-[12.5px] text-ink-muted">
              {canRollback ? "Until the shared copy is purged you can move the hotel back; rows changed since cutover are copied back first." : "The shared copy is gone, so there is no rollback. Back up before any change."}
            </p>
            <Button variant="secondary" disabled={!canRollback} onClick={() => setConfirm("rollback")}>
              <ArrowCounterClockwise size={14} /> Roll back to shared
            </Button>
            <Button variant="ghost" className="text-laterite" disabled={!canRollback} onClick={() => setConfirm("purge")}>
              <Trash size={14} /> Purge the shared copy now
            </Button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm === "rollback"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Roll back to the shared database?"
        body="Rows changed since cutover are copied back, then routing returns to the shared database. The hotel sees a short read-only window."
        confirmLabel="Roll back"
        danger
        onConfirm={async () => {
          const p = await databasesApi.rollback(tenantId);
          toast.info("Rollback started");
          onProvisioning?.(p.id);
          refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "purge"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Purge the shared copy now?"
        body="The hotel's rows are removed from the shared database today instead of after 7 days. Rollback will no longer be possible."
        confirmLabel="Purge now"
        danger
        onConfirm={async () => {
          await databasesApi.purgeShared(tenantId);
          toast.success("Shared copy purged");
          refresh();
        }}
      />
    </Panel>
  );
}

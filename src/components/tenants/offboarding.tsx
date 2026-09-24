"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, DownloadSimple, HourglassMedium, Lock, Scales, Trash, WarningDiamond, FileZip, Archive } from "@phosphor-icons/react";
import { tenantsApi } from "@/lib/api/endpoints";
import { qk, useTenant } from "@/lib/api/hooks";
import type { Offboarding } from "@/lib/api/types-m6";
import { bytes, daysUntil, formatDate, formatDateTime, titleCase } from "@/lib/format";
import { toast } from "@/lib/store";
import { useCan, useMe } from "@/lib/session";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/form";
import { ErrorState, Panel, Skeleton } from "@/components/ui/primitives";
import { Gate, ReasonDialog, TypedConfirm } from "@/components/ui/kit";

const GRACE_DAYS = 30;

/* ---------- the strip on the tenant page while an offboarding runs ---------- */
export function OffboardingBanner({ o: initial, tenantId }: { o: Offboarding; tenantId: string }) {
  const qc = useQueryClient();
  const can = useCan();
  const me = useMe().data;
  const [cancel, setCancel] = useState(false);
  const live = useQuery({
    queryKey: ["platform", "tenant", tenantId, "offboarding"],
    queryFn: () => tenantsApi.offboarding(tenantId),
    initialData: initial,
    refetchInterval: (q) => (q.state.data?.status === "EXPORTING" || q.state.data?.status === "DELETING" ? 2000 : false),
  });
  const o = live.data ?? initial;
  const left = daysUntil(o.deleteAfter);
  const deleteNow = useMutation({
    mutationFn: () => tenantsApi.deleteNow(o.id),
    onSuccess: () => {
      toast.success("Deletion started");
      void qc.invalidateQueries({ queryKey: qk.tenant(tenantId) });
    },
    meta: { errorTitle: "Deletion not started" },
  });
  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] bg-laterite-wash" data-testid="offboarding-banner">
      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center">
        <span className="flex items-center gap-2.5 text-laterite">
          <WarningDiamond size={20} weight="duotone" />
          <span className="text-[14px] font-medium">
            {o.status === "DELETED" ? "Deleted" : o.status === "FAILED" ? "Offboarding failed" : "Offboarding"}
          </span>
        </span>
        <div className="min-w-0 flex-1 text-[13px] text-ink">
          {o.status === "EXPORTING" && (
            <>
              Exporting everything the hotel holds: <span className="font-mono">{o.export?.progressPct ?? 0}%</span>
            </>
          )}
          {o.status === "GRACE" && (
            <>
              Deletion on <strong className="font-medium">{formatDate(o.deleteAfter)}</strong>{" "}
              <span className="font-mono text-laterite">({left} {left === 1 ? "day" : "days"})</span>. The hotel is suspended until then.
            </>
          )}
          {o.status === "DELETING" && "Deleting the hotel's rows, files and exports now."}
          {o.status === "DELETED" && (
            <>
              Deleted {formatDateTime(o.deletedAt)}
              {o.summary ? `: ${o.summary.rowsDeleted.toLocaleString("en-NG")} rows in ${o.summary.tables} tables` : ""}.
            </>
          )}
          {o.status === "FAILED" && (o.error ?? "See the platform audit log.")}
          <span className="block text-[12px] text-ink-muted">
            Requested by {o.requestedBy.fullName}, {formatDateTime(o.requestedAt)}. Reason: {o.reason}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {o.export?.downloadUrl && o.export.status === "READY" && (
            <a
              href={o.export.downloadUrl}
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[13px] text-ink hover:bg-surface-2"
            >
              <DownloadSimple size={14} /> Export {o.export.sizeBytes ? `(${bytes(o.export.sizeBytes)})` : ""}
            </a>
          )}
          {can("tenants.manage") && (o.status === "EXPORTING" || o.status === "GRACE") && (
            <Button size="sm" variant="secondary" onClick={() => setCancel(true)}>
              Cancel offboarding
            </Button>
          )}
          {me?.role === "SUPER_ADMIN" && o.status === "GRACE" && (
            <Button size="sm" variant="danger" loading={deleteNow.isPending} onClick={() => deleteNow.mutate()} title="Only after the grace period, or outside production">
              <Trash size={14} /> Delete now
            </Button>
          )}
        </div>
      </div>
      <ReasonDialog
        open={cancel}
        onOpenChange={setCancel}
        title="Cancel the offboarding"
        eyebrow={o.tenant.name}
        description="The hotel goes back to the status it had before. The export stays available until its link expires."
        confirmLabel="Cancel offboarding"
        onConfirm={async (reason) => {
          await tenantsApi.cancelOffboarding(o.id, reason);
          toast.success("Offboarding cancelled", o.tenant.name);
          void qc.invalidateQueries({ queryKey: qk.tenant(tenantId) });
          void qc.invalidateQueries({ queryKey: qk.tenantsAll });
        }}
      />
    </div>
  );
}

/* ---------- the offboarding page ---------- */
export function OffboardView({ id }: { id: string }) {
  const t = useTenant(id);
  return (
    <Gate perm="tenants.manage">
      {t.isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : t.isError || !t.data ? (
        <Panel>
          <ErrorState error={t.error} onRetry={() => t.refetch()} />
        </Panel>
      ) : (
        <Flow tenantId={t.data.id} name={t.data.name} slug={t.data.slug} rooms={t.data.rooms} staff={t.data.staff.length} dedicated={t.data.dedicatedDb?.mode === "DEDICATED"} existing={t.data.offboarding} />
      )}
    </Gate>
  );
}

function Flow({ tenantId, name, slug, rooms, staff, dedicated, existing }: { tenantId: string; name: string; slug: string; rooms: number; staff: number; dedicated: boolean; existing: Offboarding | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [acks, setAcks] = useState([false, false, false]);
  const [typed, setTyped] = useState("");
  const today = new Date();
  const deleteOn = new Date(today.getTime() + GRACE_DAYS * 864e5);
  const ready = reason.trim().length >= 10 && acks.every(Boolean) && typed === name;

  const start = useMutation({
    mutationFn: () => tenantsApi.offboard(tenantId, typed, reason.trim()),
    onSuccess: () => {
      toast.success("Offboarding started", `${name} is suspended and its export is running.`);
      void qc.invalidateQueries({ queryKey: qk.tenant(tenantId) });
      void qc.invalidateQueries({ queryKey: qk.tenantsAll });
      router.push(`/tenants/${tenantId}`);
    },
    meta: { errorTitle: "Offboarding not started" },
  });

  const active = existing && !["CANCELLED", "FAILED"].includes(existing.status);

  const stages = [
    { icon: Lock, when: "Now", title: "Suspend", body: "Staff lose write access, the booking site and marketplace listing go offline. Guests with bookings are not contacted automatically." },
    { icon: FileZip, when: "Minutes", title: "Full export", body: "Every entity as JSON and CSV in one zip with a README, for the hotel to keep. A signed link, valid 24 hours, can be re-issued." },
    { icon: HourglassMedium, when: `${GRACE_DAYS} days`, title: "Grace period", body: `Until ${formatDate(deleteOn.toISOString())}, anyone with tenants.manage can cancel and restore the hotel exactly as it was.` },
    {
      icon: Trash,
      when: formatDate(deleteOn.toISOString(), { day: "numeric", month: "short", year: undefined }),
      title: "Deletion",
      body: `Every row in every table${dedicated ? ", the dedicated database itself," : ""} stored files and exports. A tombstone with the name and the platform's own invoices remains.`,
      danger: true,
    },
  ];

  return (
    <>
      <Link href={`/tenants/${tenantId}`} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {name}
      </Link>
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow mb-3 flex items-center gap-2 text-laterite">
          <Scales size={14} weight="duotone" /> NDPA offboarding
        </p>
        <h1 className="display text-[34px] leading-[1.04] text-ink md:text-[44px]">
          Offboard <em>{name}</em>
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">
          For a hotel that has left and asked for its data to be erased, or that we are required to remove. Nothing is deleted today: the hotel is
          suspended, exported, and erased after {GRACE_DAYS} days unless someone cancels.
        </p>
      </div>

      {active ? (
        <Panel className="p-6">
          <p className="text-[14px] text-ink">
            An offboarding is already {titleCase(existing!.status).toLowerCase()} for this hotel.{" "}
            <Link href={`/tenants/${tenantId}`} className="text-adire hover:underline">
              See it on the tenant page
            </Link>
            .
          </p>
        </Panel>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <ol className="relative flex flex-col" aria-label="What happens">
            {stages.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-7 last:pb-0">
                {i < stages.length - 1 && <span aria-hidden className="absolute left-[19px] top-10 bottom-0 w-px bg-line-strong" />}
                <span
                  className={cn(
                    "relative z-[1] grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-surface",
                    s.danger ? "border-laterite text-laterite" : "border-line-strong text-ink",
                  )}
                >
                  <s.icon size={18} weight="duotone" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="flex items-baseline gap-3">
                    <span className={cn("display-sm text-[18px]", s.danger ? "text-laterite" : "text-ink")}>{s.title}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">{s.when}</span>
                  </p>
                  <p className="mt-1 max-w-lg text-[13.5px] leading-relaxed text-ink-muted">{s.body}</p>
                </div>
              </li>
            ))}
            <li className="mt-6 rounded-md border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
              <Archive size={14} className="mb-1 text-ink" />
              In scope: <span className="font-mono text-ink">{rooms}</span> rooms, <span className="font-mono text-ink">{staff}</span> staff accounts, every guest, booking, folio,
              payment and audit row under <span className="font-mono text-ink">{slug}</span>
              {dedicated ? ", and the dedicated database" : ""}.
            </li>
          </ol>

          <Panel className="h-fit border-[color-mix(in_oklab,var(--laterite)_35%,transparent)]">
            <div className="border-b border-line px-5 py-4">
              <h2 className="display-sm text-[19px] text-ink">Confirm</h2>
              <p className="mt-1 text-[12.5px] text-ink-muted">You will be asked for an authenticator code.</p>
            </div>
            <div className="flex flex-col gap-5 px-5 py-5">
              <Field label="Reason, for the record" htmlFor="off-reason" hint="Recorded on the platform audit log and in the export's README.">
                <Textarea
                  id="off-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Owner's written erasure request of 20 Sep 2026 (NDPA s.34)"
                  maxLength={500}
                />
              </Field>
              <div className="flex flex-col gap-2.5">
                {[
                  "The owner has been told, in writing, what will happen and when",
                  "Unpaid invoices and commission are settled or written off",
                  "I understand the deletion cannot be undone after the grace period",
                ].map((l, i) => (
                  <Checkbox key={l} checked={acks[i]} onChange={(v) => setAcks((a) => a.map((x, j) => (j === i ? v : x)))} label={<span className="text-[13px]">{l}</span>} />
                ))}
              </div>
              <TypedConfirm expected={name} value={typed} onChange={setTyped} />
              <Button variant="danger" size="lg" disabled={!ready} loading={start.isPending} onClick={() => start.mutate()} data-testid="begin-offboarding">
                Begin offboarding
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

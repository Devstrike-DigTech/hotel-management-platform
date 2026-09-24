"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, PencilSimpleLine, Plus, Stop, UserSwitch } from "@phosphor-icons/react";
import { impersonationApi } from "@/lib/api/endpoints";
import { useImpersonation, useImpersonations } from "@/lib/api/hooks";
import type { ImpersonationSession } from "@/lib/api/types-m6";
import { clock, duration, formatDateTime, relativeTime, titleCase } from "@/lib/format";
import { toast } from "@/lib/store";
import { useMe } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { Gate, Pager, ReasonDialog } from "@/components/ui/kit";
import { ImpersonationLauncher } from "./launcher";

export function ImpersonationView() {
  return (
    <Gate perm="impersonate">
      <View />
    </Gate>
  );
}

const ENDED_BY: Record<string, string> = { PLATFORM: "ended by Devstrike", HOTEL_OWNER: "ended by the hotel owner", EXPIRED: "timed out", SELF: "ended" };

function View() {
  const params = useSearchParams();
  const router = useRouter();
  const [launch, setLaunch] = useState(() => !!params.get("new"));
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const active = useImpersonations({ active: "true", pageSize: 50 }, true);
  const past = useImpersonations({ active: "false", page, pageSize: 15 });

  useEffect(() => {
    if (params.get("new")) router.replace("/impersonation");
  }, [params, router]);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <UserSwitch size={14} weight="duotone" /> Impersonation
          </>
        }
        title={
          <>
            See what the hotel <em>sees</em>.
          </>
        }
        description="Time-boxed, read-only by default, and written on both audit logs. Hotel owners can see every session and end one."
        actions={
          <Button onClick={() => setLaunch(true)} data-testid="new-session">
            <Plus size={15} weight="bold" /> New session
          </Button>
        }
      />

      <section className="mb-8">
        <h2 className="eyebrow mb-3">Running now</h2>
        {active.isLoading ? (
          <Skeleton className="h-28 w-full rounded-lg" />
        ) : active.isError ? (
          <Panel>
            <ErrorState error={active.error} onRetry={() => active.refetch()} />
          </Panel>
        ) : !active.data?.items.length ? (
          <Panel>
            <EmptyState compact glyph="eye" title="No sessions running" body="Start one from here, a tenant's page, or a support request." />
          </Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.data.items.map((s) => (
              <ActiveCard key={s.id} s={s} onOpen={() => setOpen(s.id)} />
            ))}
          </div>
        )}
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="History" title="Past sessions" />
        {past.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : !past.data?.items.length ? (
          <EmptyState compact glyph="ladder" title="No past sessions" />
        ) : (
          <ul className="divide-y divide-line">
            {past.data.items.map((s) => (
              <li key={s.id}>
                <button onClick={() => setOpen(s.id)} className="grid w-full gap-x-6 gap-y-1 px-5 py-3.5 text-left hover:bg-surface-2/50 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto]">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] text-ink">
                      {s.tenant.name} <span className="text-ink-muted">as</span> {s.staff.fullName}
                    </span>
                    <span className="block text-[12px] text-ink-muted">
                      by {s.platformUser.fullName} &middot; {titleCase(s.staff.role)}
                    </span>
                  </span>
                  <span className="line-clamp-2 min-w-0 text-[12.5px] text-ink-muted">{s.reason}</span>
                  <span className="flex items-center gap-3 md:justify-end">
                    <Badge tone={s.writes > 0 ? "danger" : s.mode === "WRITE" ? "ochre" : "adire"}>{s.writes > 0 ? `${s.writes} writes` : s.mode === "WRITE" ? "Write" : "Read-only"}</Badge>
                    <span className="font-mono text-[11.5px] text-ink-faint">{formatDateTime(s.startedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!!past.data?.total && <Pager page={page} pageSize={15} total={past.data.total} onPage={setPage} noun="sessions" />}
      </Panel>

      <ImpersonationLauncher open={launch} onOpenChange={setLaunch} target={{}} />
      <SessionSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function ActiveCard({ s, onOpen }: { s: ImpersonationSession; onOpen: () => void }) {
  const qc = useQueryClient();
  const me = useMe().data;
  const now = useNow(1000);
  const [write, setWrite] = useState(false);
  const total = new Date(s.expiresAt).getTime() - new Date(s.startedAt).getTime();
  const left = new Date(s.expiresAt).getTime() - now;
  const mine = s.platformUser.id === me?.id;
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["platform", "impersonations"] });
  const end = useMutation({
    mutationFn: () => impersonationApi.end(s.id),
    onSuccess: () => {
      toast.success("Session ended", `${s.tenant.name} no longer shows the banner.`);
      invalidate();
    },
    meta: { errorTitle: "Session not ended" },
  });
  const readOnly = useMutation({
    mutationFn: () => impersonationApi.writeMode(s.id, false),
    onSuccess: () => {
      toast.success("Back to read-only");
      invalidate();
    },
  });
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-surface", s.mode === "WRITE" ? "border-laterite" : "border-line")} data-testid="active-session">
      <div className="relative h-1 bg-surface-2">
        <div className={cn("absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear", s.mode === "WRITE" ? "bg-laterite" : "bg-adire")} style={{ width: `${Math.max(0, (left / total) * 100)}%` }} />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span className="live-dot text-palm" aria-hidden />
              <span className="truncate text-[15px] font-medium text-ink">{s.tenant.name}</span>
            </p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              as <span className="text-ink">{s.staff.fullName}</span> ({titleCase(s.staff.role)}) &middot; by {mine ? "you" : s.platformUser.fullName}
            </p>
          </div>
          <span className="text-right">
            <span className="block font-mono text-[20px] leading-none text-ink">{clock(left)}</span>
            <span className="text-[11px] text-ink-muted">left</span>
          </span>
        </div>
        <p className="mt-3 line-clamp-2 text-[13px] text-ink-muted">{s.reason}</p>
        {s.mode === "WRITE" && (
          <p className="mt-2 rounded-sm bg-laterite-wash px-2.5 py-1.5 text-[12.5px] text-laterite">
            <PencilSimpleLine size={13} className="mr-1 inline" /> Write access: {s.writeReason}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-auto font-mono text-[11.5px] text-ink-faint">
            {s.requests} requests &middot; {s.writes} writes
          </span>
          <Button size="sm" variant="ghost" onClick={onOpen}>
            <Eye size={14} /> Activity
          </Button>
          {s.mode === "READ_ONLY" ? (
            <Button size="sm" variant="secondary" onClick={() => setWrite(true)}>
              <PencilSimpleLine size={14} /> Allow writes
            </Button>
          ) : (
            <Button size="sm" variant="secondary" loading={readOnly.isPending} onClick={() => readOnly.mutate()}>
              Back to read-only
            </Button>
          )}
          <Button size="sm" variant="danger" loading={end.isPending} onClick={() => end.mutate()} data-testid="end-session">
            <Stop size={13} weight="fill" /> End
          </Button>
        </div>
      </div>
      <ReasonDialog
        open={write}
        onOpenChange={setWrite}
        title="Allow changes in this session"
        eyebrow={`${s.tenant.name} as ${s.staff.fullName}`}
        description="Anything you change is saved under the staff member's name with a Devstrike support mark, on both audit logs. The hotel's banner switches to 'with write access'."
        label="What do you need to change, and why?"
        placeholder="e.g. Re-posting the folio payment the hotel entered twice, agreed with the owner on the phone"
        min={10}
        danger
        confirmLabel="Allow writes"
        onConfirm={async (reason) => {
          await impersonationApi.writeMode(s.id, true, reason);
          toast.warning("Write access on", "Every change is recorded.");
          invalidate();
        }}
      />
    </div>
  );
}

function SessionSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const s = useImpersonation(id);
  const d = s.data;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()} width="max-w-[560px]" eyebrow="Support session" title={d ? `${d.tenant.name} as ${d.staff.fullName}` : "Session"}>
      {!d ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-ink-muted">By</dt>
            <dd className="text-ink">{d.platformUser.fullName}</dd>
            <dt className="text-ink-muted">Started</dt>
            <dd className="font-mono text-ink">{formatDateTime(d.startedAt)}</dd>
            <dt className="text-ink-muted">{d.endedAt ? "Ended" : "Ends"}</dt>
            <dd className="font-mono text-ink">
              {formatDateTime(d.endedAt ?? d.expiresAt)}
              {d.endedBy && <span className="ml-2 font-sans text-ink-muted">{ENDED_BY[d.endedBy]}</span>}
            </dd>
            <dt className="text-ink-muted">Length</dt>
            <dd className="font-mono text-ink">{duration(new Date(d.endedAt ?? d.expiresAt).getTime() - new Date(d.startedAt).getTime())}</dd>
            <dt className="text-ink-muted">Mode</dt>
            <dd>
              <Badge tone={d.mode === "WRITE" ? "danger" : "adire"}>{d.mode === "WRITE" ? "Write" : "Read-only"}</Badge>
            </dd>
            {d.supportRequestId && (
              <>
                <dt className="text-ink-muted">Support request</dt>
                <dd>
                  <Link href={`/support?open=${d.supportRequestId}`} className="text-adire hover:underline">
                    Open
                  </Link>
                </dd>
              </>
            )}
          </dl>
          <div>
            <p className="eyebrow mb-1.5 text-[10px]">Reason</p>
            <p className="text-[13.5px] leading-relaxed text-ink">{d.reason}</p>
            {d.writeReason && <p className="mt-2 text-[13px] text-laterite">Write access: {d.writeReason}</p>}
          </div>
          <div>
            <p className="eyebrow mb-2 text-[10px]">What was opened or changed</p>
            {d.activity?.length ? (
              <ol className="relative border-l border-line pl-4">
                {d.activity.map((a) => (
                  <li key={a.id} className="relative pb-3 last:pb-0">
                    <span className="absolute -left-[20.5px] top-1.5 h-2 w-2 rounded-full border border-surface bg-adire" aria-hidden />
                    <p className="font-mono text-[12px] text-ink">{a.action}</p>
                    <p className="text-[11.5px] text-ink-muted">
                      {relativeTime(a.createdAt)} &middot; {a.actor?.fullName}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-ink-muted">Nothing recorded.</p>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

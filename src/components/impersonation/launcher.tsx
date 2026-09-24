"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, Crown, Eye, MagnifyingGlass, ShieldWarning, Timer, UserSwitch } from "@phosphor-icons/react";
import { impersonationApi, tenantsApi } from "@/lib/api/endpoints";
import { useTenants } from "@/lib/api/hooks";
import type { ImpersonationSession, TenantStaff } from "@/lib/api/types-m6";
import { useMe } from "@/lib/session";
import { clock, titleCase } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/primitives";

export interface LaunchTarget {
  tenantId?: string;
  tenantName?: string;
  staffId?: string;
  supportRequestId?: string;
  supportNumber?: string;
  defaultReason?: string;
}

/**
 * The impersonation launcher: pick the hotel and the staff member, write why,
 * pick how long. Sessions start read-only; write access is a separate,
 * audited switch on the running session. The API asks for a fresh code first
 * (step-up), then returns a one-time handoff link into the hotel admin that is
 * good for two minutes.
 */
export function ImpersonationLauncher({ open, onOpenChange, target }: { open: boolean; onOpenChange: (o: boolean) => void; target: LaunchTarget }) {
  // A fresh body per opening, so nothing from the last session lingers.
  const [opened, setOpened] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpened((n) => n + 1);
  }
  return <LauncherBody key={opened} open={open} onOpenChange={onOpenChange} target={target} />;
}

function LauncherBody({ open, onOpenChange, target }: { open: boolean; onOpenChange: (o: boolean) => void; target: LaunchTarget }) {
  const qc = useQueryClient();
  const me = useMe().data;
  const [tenantId, setTenantId] = useState(target.tenantId ?? "");
  const [tenantLabel, setTenantLabel] = useState(target.tenantName ?? "");
  const [staffId, setStaffId] = useState(target.staffId ?? "");
  const [reason, setReason] = useState(target.defaultReason ?? (target.supportNumber ? `Investigating ${target.supportNumber}: ` : ""));
  const [minutes, setMinutes] = useState(30);
  const [started, setStarted] = useState<{ session: ImpersonationSession; handoffUrl: string; at: number } | null>(null);

  const tenant = useQuery({ queryKey: ["platform", "tenant", tenantId], queryFn: () => tenantsApi.get(tenantId), enabled: open && !!tenantId });
  const staff = (tenant.data?.staff ?? []).filter((s) => s.isActive);
  const chosen = staff.find((s) => s.id === staffId);
  const superAdmin = me?.role === "SUPER_ADMIN";
  const reasonOk = reason.trim().length >= 10 && reason.trim().length <= 500;

  const start = useMutation({
    mutationFn: () =>
      impersonationApi.start({ tenantId, userId: staffId, reason: reason.trim(), durationMinutes: minutes, supportRequestId: target.supportRequestId }),
    onSuccess: (res) => {
      setStarted({ ...res, at: Date.now() });
      void qc.invalidateQueries({ queryKey: ["platform", "impersonations"] });
      void qc.invalidateQueries({ queryKey: ["platform", "tenant", tenantId] });
      if (target.supportRequestId) void qc.invalidateQueries({ queryKey: ["platform", "support-item", target.supportRequestId] });
      try {
        window.open(res.handoffUrl, "_blank", "noopener,noreferrer");
      } catch {
        /* the link below still works */
      }
    },
    meta: { errorTitle: "Session not started" },
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="max-w-[520px]"
      eyebrow={
        <span className="flex items-center gap-2">
          <UserSwitch size={13} weight="duotone" /> Impersonation
        </span>
      }
      title={started ? "Session started" : "View the hotel as a staff member"}
      description={started ? undefined : "Read-only by default. Everything you open is recorded on the platform and the hotel's audit logs, and the hotel sees a banner."}
      footer={
        started ? (
          <Button variant="secondary" className="ml-auto" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="ml-auto"
              disabled={!tenantId || !staffId || !reasonOk || (chosen?.role === "OWNER" && !superAdmin)}
              loading={start.isPending}
              onClick={() => start.mutate()}
              data-testid="start-impersonation"
            >
              <Eye size={15} /> Start read-only session
            </Button>
          </>
        )
      }
    >
      {started ? (
        <Started s={started} />
      ) : (
        <div className="flex flex-col gap-5">
          {!target.tenantId && (
            <TenantPicker
              value={tenantId}
              label={tenantLabel}
              onPick={(id, name) => {
                setTenantId(id);
                setTenantLabel(name);
                setStaffId("");
              }}
            />
          )}
          {tenantId && (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink">
                View as <span className="font-normal text-ink-muted">at {tenant.data?.name ?? tenantLabel}</span>
              </legend>
              {tenant.isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : (
                <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto" role="radiogroup" aria-label="Staff member">
                  {staff.map((s) => (
                    <StaffOption key={s.id} s={s} checked={staffId === s.id} onPick={() => setStaffId(s.id)} disabled={s.role === "OWNER" && !superAdmin} />
                  ))}
                  {!staff.length && <li className="text-[13px] text-ink-muted">No active staff to view as.</li>}
                </ul>
              )}
            </fieldset>
          )}
          <Field
            label="Why are you viewing their account?"
            htmlFor="imp-reason"
            hint={`${reason.trim().length} of 10 to 500 characters. The hotel owner can read this.`}
          >
            <Textarea
              id="imp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reproducing the check-out error reported in SR-001042"
              maxLength={500}
            />
          </Field>
          <Field label="Duration" htmlFor="imp-min" hint="The session ends by itself; you can end it sooner.">
            <div className="flex items-center gap-4">
              <input
                id="imp-min"
                type="range"
                min={5}
                max={60}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer accent-[var(--adire)]"
              />
              <span className="w-16 text-right font-mono text-[14px] text-ink">{minutes} min</span>
            </div>
          </Field>
          <p className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <ShieldWarning size={16} weight="duotone" className="mt-0.5 shrink-0 text-brass-text" />
            You will be asked for an authenticator code. Write access, if you need it, is turned on from the running session with a second reason.
          </p>
        </div>
      )}
    </Sheet>
  );
}

function StaffOption({ s, checked, onPick, disabled }: { s: TenantStaff; checked: boolean; onPick: () => void; disabled: boolean }) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        disabled={disabled}
        onClick={onPick}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55",
          checked ? "border-adire bg-adire-wash/60" : "border-line bg-surface hover:border-line-strong",
        )}
      >
        <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", checked ? "border-adire" : "border-line-strong")}>
          {checked && <span className="h-2 w-2 rounded-full bg-adire" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13.5px] text-ink">
            {s.fullName}
            {s.role === "OWNER" && <Crown size={13} weight="duotone" className="text-brass-text" />}
          </span>
          <span className="block truncate text-[12px] text-ink-muted">{s.email}</span>
        </span>
        <span className="text-right">
          <span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{titleCase(s.role)}</span>
          {disabled && <span className="block text-[11px] text-ink-faint">super admin only</span>}
        </span>
      </button>
    </li>
  );
}

function TenantPicker({ value, label, onPick }: { value: string; label: string; onPick: (id: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDeb(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  const list = useTenants({ q: deb || undefined, pageSize: 6 }, deb.length > 0 || !value);
  if (value)
    return (
      <div className="flex items-center justify-between rounded-md border border-line bg-surface-2/50 px-3 py-2.5">
        <span className="text-[13.5px] text-ink">{label}</span>
        <button type="button" className="text-[12.5px] text-adire hover:underline" onClick={() => onPick("", "")}>
          Change hotel
        </button>
      </div>
    );
  return (
    <Field label="Hotel" htmlFor="imp-tenant">
      <div className="relative">
        <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <Input id="imp-tenant" className="pl-9" placeholder="Search by hotel name" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {(list.data?.items ?? []).map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => onPick(t.id, t.name)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13.5px] hover:bg-surface-2">
              <span className="text-ink">{t.name}</span>
              <span className="text-[12px] text-ink-muted">{t.city}</span>
            </button>
          </li>
        ))}
      </ul>
    </Field>
  );
}

function Started({ s }: { s: { session: ImpersonationSession; handoffUrl: string; at: number } }) {
  const now = useNow(1000);
  const codeLeft = s.at + 120_000 - now;
  const sessionLeft = new Date(s.session.expiresAt).getTime() - now;
  const expired = codeLeft <= 0;
  const host = useMemo(() => {
    try {
      return new URL(s.handoffUrl).host;
    } catch {
      return "the hotel admin";
    }
  }, [s.handoffUrl]);
  return (
    <div className="flex flex-col gap-5" data-testid="impersonation-started">
      <div className="rounded-lg border border-line bg-night p-5 text-night-ink">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-night-brass">Read-only session</p>
        <p className="display-sm mt-2 text-[20px] leading-snug">
          Viewing <em>{s.session.tenant.name}</em> as {s.session.staff.fullName}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-night-muted">
          <span className="inline-flex items-center gap-1.5">
            <Timer size={14} /> ends in <span className="font-mono text-night-ink">{clock(sessionLeft)}</span>
          </span>
          <span>{titleCase(s.session.staff.role)}</span>
        </div>
      </div>
      <div>
        <a
          href={expired ? undefined : s.handoffUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={expired}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-md text-[14.5px] font-medium",
            expired ? "pointer-events-none bg-surface-2 text-ink-faint" : "bg-adire text-adire-ink hover:bg-adire-hover",
          )}
          data-testid="handoff-link"
        >
          Open {host} <ArrowSquareOut size={16} />
        </a>
        <p className="mt-2 text-center text-[12px] text-ink-muted">
          {expired ? (
            "The one-time link has expired. End this session and start a new one if you still need it."
          ) : (
            <>
              A new tab should have opened. The one-time link works once, for another <span className="font-mono text-ink">{clock(codeLeft)}</span>.
            </>
          )}
        </p>
      </div>
      <p className="text-[12.5px] text-ink-muted">Manage write access or end the session from Impersonation.</p>
    </div>
  );
}

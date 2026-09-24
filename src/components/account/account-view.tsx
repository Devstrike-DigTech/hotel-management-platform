"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Desktop, DeviceMobile, Globe, Key, Password, ShieldCheck, SignOut } from "@phosphor-icons/react";
import { authApi } from "@/lib/api/endpoints";
import { qk, useMySessions } from "@/lib/api/hooks";
import { PLATFORM_ROLES, PERMISSION_LABEL, type Permission } from "@/lib/catalog";
import { deviceName, formatDateTime, relativeTime } from "@/lib/format";
import { meKey, permissionsOf, useMe } from "@/lib/session";
import { toast } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { RecoveryCodesSheet } from "@/components/security/recovery-codes";

export function AccountView() {
  const me = useMe().data;
  const qc = useQueryClient();
  const sessions = useMySessions();
  const now = useNow(60_000);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pw, setPw] = useState(false);
  const [ips, setIps] = useState<string | null>(null);
  const inv = () => {
    void qc.invalidateQueries({ queryKey: qk.sessions });
    void qc.invalidateQueries({ queryKey: meKey });
  };
  const revoke = useMutation({ mutationFn: authApi.revokeSession, onSuccess: () => (toast.success("Signed out there"), inv()) });
  const others = useMutation({ mutationFn: authApi.revokeOthers, onSuccess: (r) => (toast.success(`${r.revoked} other ${r.revoked === 1 ? "session" : "sessions"} ended`), inv()) });
  const regen = useMutation({ mutationFn: authApi.regenerateCodes, onSuccess: (r) => (setCodes(r.recoveryCodes), inv()), meta: { errorTitle: "Codes not replaced" } });
  const allow = useMutation({
    mutationFn: (cidrs: string[]) => authApi.setIpAllowlist(cidrs),
    onSuccess: (m) => {
      qc.setQueryData(meKey, m);
      setIps(null);
      toast.success("Allowlist saved");
    },
    meta: { errorTitle: "Allowlist not saved" },
  });
  if (!me) return <Skeleton className="h-96" />;
  const perms = [...permissionsOf(me)] as Permission[];
  const live = (sessions.data ?? []).filter((s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now);
  const past = (sessions.data ?? []).filter((s) => !live.includes(s)).slice(0, 8);
  const cidrs = ips ?? me.ipAllowlist.join("\n");
  const cidrList = cidrs.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ShieldCheck size={14} weight="duotone" /> Account and security
          </>
        }
        title={
          <>
            {me.fullName.split(" ")[0]}, <em>signed in safely</em>.
          </>
        }
        description="Your sessions, second factor, recovery codes and the addresses you can sign in from."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="overflow-hidden lg:col-span-8">
          <PanelHeader
            eyebrow="Sessions"
            title="Where you are signed in"
            description="Sessions last 12 hours and end after an hour of inactivity."
            actions={
              live.length > 1 && (
                <Button size="sm" variant="secondary" loading={others.isPending} onClick={() => others.mutate()}>
                  <SignOut size={14} /> Sign out everywhere else
                </Button>
              )
            }
          />
          {!sessions.data ? (
            <Skeleton className="m-5 h-24" />
          ) : (
            <ul className="divide-y divide-line">
              {live.map((s) => {
                const phone = /Android|iPhone|iOS/i.test(s.userAgent ?? "");
                const I = phone ? DeviceMobile : Desktop;
                return (
                  <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md border", s.current ? "border-adire bg-adire-wash text-adire" : "border-line text-ink-muted")}>
                      <I size={19} weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink">
                        {deviceName(s.userAgent)} {s.current && <Badge tone="adire">This device</Badge>}
                        {s.mfaMethod === "recovery_code" && <Badge tone="ochre">Recovery code</Badge>}
                      </span>
                      <span className="font-mono text-[11.5px] text-ink-muted">
                        {s.ip ?? "unknown IP"} &middot; signed in {formatDateTime(s.createdAt)} &middot; active {relativeTime(s.lastSeenAt)}
                      </span>
                    </span>
                    {!s.current && (
                      <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                        Sign out
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!!past.length && (
            <details className="border-t border-line">
              <summary className="px-5 py-3 text-[12.5px] text-ink-muted hover:text-ink">Ended sessions, last 30 days</summary>
              <ul className="divide-y divide-line">
                {past.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[12.5px] text-ink-muted">
                    <span>{deviceName(s.userAgent)}</span>
                    <span className="font-mono text-[11.5px]">
                      {s.ip} &middot; {formatDateTime(s.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <Panel className="p-5">
            <p className="eyebrow mb-3">You</p>
            <p className="display-sm text-[19px] text-ink">{me.fullName}</p>
            <p className="text-[13px] text-ink-muted">{me.email}</p>
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-adire">{PLATFORM_ROLES[me.role]?.label}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {perms.map((p) => (
                <li key={p} className="rounded-xs border border-line bg-surface-2/60 px-1.5 py-0.5 text-[11px] text-ink-muted">
                  {PERMISSION_LABEL[p] ?? p}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow mb-3 flex items-center gap-2">
              <Key size={13} weight="duotone" /> Second factor
            </p>
            <p className="flex items-center gap-2 text-[13.5px] text-ink">
              <ShieldCheck size={16} weight="fill" className="text-palm" /> Authenticator app on
            </p>
            <p className={cn("mt-2 text-[13px]", me.recoveryCodesRemaining <= 3 ? "text-laterite" : "text-ink-muted")}>
              <span className="font-mono">{me.recoveryCodesRemaining}</span> of 10 recovery codes left
            </p>
            <Button size="sm" variant="secondary" className="mt-3" loading={regen.isPending} onClick={() => regen.mutate()}>
              New recovery codes
            </Button>
            <p className="mt-2 text-[11.5px] text-ink-muted">Replaces all ten. Asks for your code.</p>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow mb-3 flex items-center gap-2">
              <Password size={13} weight="duotone" /> Password
            </p>
            <Button size="sm" variant="secondary" onClick={() => setPw(true)}>
              Change password
            </Button>
            <p className="mt-2 text-[11.5px] text-ink-muted">Signs you out on every other device.</p>
          </Panel>
        </div>

        <Panel className="lg:col-span-8">
          <PanelHeader
            eyebrow={
              <span className="flex items-center gap-2">
                <Globe size={13} weight="duotone" /> IP allowlist
              </span>
            }
            title="Where you can sign in from"
            description={`Your address now: ${me.session?.ip ?? "unknown"}. The list must include it, so you can't lock yourself out.`}
          />
          <div className="p-5">
            <Field label="Addresses and ranges, one per line" htmlFor="my-ips" hint="Empty allows any address.">
              <Textarea id="my-ips" className="min-h-24 font-mono text-[12.5px]" value={cidrs} onChange={(e) => setIps(e.target.value)} placeholder={`${me.session?.ip ?? "102.89.34.17"}/32`} />
            </Field>
            {ips !== null && ips !== me.ipAllowlist.join("\n") && (
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIps(null)}>
                  Reset
                </Button>
                <Button size="sm" loading={allow.isPending} onClick={() => allow.mutate(cidrList)}>
                  Save allowlist
                </Button>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Dialog open={!!codes} onOpenChange={(o) => !o && setCodes(null)} title="New recovery codes" eyebrow="Shown once" description="Your old codes stopped working just now.">
        {codes && <RecoveryCodesSheet codes={codes} email={me.email} onDone={() => setCodes(null)} doneLabel="Done" />}
      </Dialog>
      <PasswordDialog open={pw} onOpenChange={setPw} />
    </>
  );
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const change = useMutation({
    mutationFn: () => authApi.changePassword(cur, next),
    onSuccess: () => {
      toast.success("Password changed", "Other sessions have been signed out.");
      setCur("");
      setNext("");
      setAgain("");
      onOpenChange(false);
    },
    meta: { errorTitle: "Password not changed" },
  });
  const ok = cur && next.length >= 10 && next === again && next !== cur;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change your password"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!ok} loading={change.isPending} onClick={() => change.mutate()}>
            Change password
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Current password" htmlFor="pw-cur">
          <PasswordInput id="pw-cur" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field label="New password" htmlFor="pw-new" hint="At least 10 characters.">
          <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="New password again" htmlFor="pw-again" error={again && again !== next ? "The two don't match." : null}>
          <PasswordInput id="pw-again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Key, LockOpen, PaperPlaneTilt, Plus, ShieldCheck, ShieldWarning, UserCircleGear, UserMinus, Globe } from "@phosphor-icons/react";
import { usersApi } from "@/lib/api/endpoints";
import { qk, useUserSessions, useUsers } from "@/lib/api/hooks";
import type { PlatformRole, PlatformUserRow } from "@/lib/api/types-m6";
import { PLATFORM_ROLES, PLATFORM_ROLE_ORDER, ROLE_PERMISSIONS, PERMISSION_LABEL } from "@/lib/catalog";
import { deviceName, formatDate, initials, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/overlay";
import { Badge, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { Gate } from "@/components/ui/kit";

export function UsersView() {
  return (
    <Gate perm="platform_users.manage">
      <View />
    </Gate>
  );
}

function View() {
  const users = useUsers();
  const [invite, setInvite] = useState(false);
  const [open, setOpen] = useState<PlatformUserRow | null>(null);
  const list = users.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <UserCircleGear size={14} weight="duotone" /> Console users
          </>
        }
        title={
          <>
            Who can <em>open this console</em>.
          </>
        }
        description="Devstrike staff only. Everyone signs in with a password and an authenticator; roles decide what each person can see and change."
        actions={
          <Button onClick={() => setInvite(true)}>
            <Plus size={15} weight="bold" /> Invite someone
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="overflow-hidden">
          {users.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={() => users.refetch()} />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((u) => (
                <UserRow key={u.id} u={u} onOpen={() => setOpen(u)} />
              ))}
            </ul>
          )}
        </Panel>
        <RoleGuide />
      </div>
      <InviteDialog open={invite} onOpenChange={setInvite} />
      <UserSheet u={open ? (list.find((x) => x.id === open.id) ?? open) : null} onClose={() => setOpen(null)} />
    </>
  );
}

function UserRow({ u, onOpen }: { u: PlatformUserRow; onOpen: () => void }) {
  const now = useNow(60_000);
  const locked = u.lockedUntil && new Date(u.lockedUntil).getTime() > now;
  return (
    <li>
      <button onClick={onOpen} className={cn("grid w-full gap-x-5 gap-y-1 px-5 py-3.5 text-left hover:bg-surface-2/50 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]", !u.isActive && "opacity-55")}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-[11px] text-ink-muted">{initials(u.fullName)}</span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] text-ink">{u.fullName}</span>
            <span className="block truncate text-[12px] text-ink-muted">{u.email}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 md:justify-start">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-adire">{PLATFORM_ROLES[u.role]?.label ?? u.role}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 md:justify-end">
          {u.invitePending ? (
            <Badge tone="brass">Invited</Badge>
          ) : !u.isActive ? (
            <Badge tone="neutral">Deactivated</Badge>
          ) : locked ? (
            <Badge tone="danger">Locked</Badge>
          ) : !u.mfaEnabled ? (
            <Badge tone="ochre">No 2FA yet</Badge>
          ) : (
            <Badge tone="palm" icon={<ShieldCheck size={12} weight="fill" />}>
              2FA
            </Badge>
          )}
          {!!u.ipAllowlist.length && <Badge tone="neutral" icon={<Globe size={12} />}>{u.ipAllowlist.length} IP rules</Badge>}
          <span className="text-[11.5px] text-ink-faint" suppressHydrationWarning>
            {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "never signed in"}
          </span>
        </span>
      </button>
    </li>
  );
}

function RoleGuide() {
  return (
    <Panel className="h-fit p-5">
      <p className="eyebrow mb-3">Roles</p>
      <ul className="flex flex-col gap-4">
        {PLATFORM_ROLE_ORDER.map((r) => (
          <li key={r}>
            <p className="text-[13.5px] text-ink">{PLATFORM_ROLES[r].label}</p>
            <p className="text-[12px] leading-snug text-ink-muted">{PLATFORM_ROLES[r].description}</p>
            <p className="mt-1 font-mono text-[10.5px] text-ink-faint">{ROLE_PERMISSIONS[r].length} permissions</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ email: "", fullName: "", role: "SUPPORT" as PlatformRole });
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inviteM = useMutation({
    mutationFn: () => usersApi.invite({ email: f.email.trim().toLowerCase(), fullName: f.fullName.trim(), role: f.role }),
    onSuccess: (r) => {
      setUrl(r.inviteUrl);
      void qc.invalidateQueries({ queryKey: qk.users });
    },
    meta: { errorTitle: "Invitation not sent" },
  });
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && f.fullName.trim().length > 1;
  const close = (o: boolean) => {
    if (!o) {
      setUrl(null);
      setF({ email: "", fullName: "", role: "SUPPORT" });
      setCopied(false);
    }
    onOpenChange(o);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      eyebrow="Console users"
      title={url ? "Invitation sent" : "Invite someone"}
      description={url ? `${f.fullName} has an email with this link. It works once, for seven days.` : "They choose a password and set up their authenticator when they accept."}
      footer={
        url ? (
          <Button onClick={() => close(false)}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button disabled={!valid} loading={inviteM.isPending} onClick={() => inviteM.mutate()}>
              <PaperPlaneTilt size={14} /> Send invitation
            </Button>
          </>
        )
      }
    >
      {url ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-sm bg-surface-2 px-2 py-1.5 font-mono text-[12px]">{url}</code>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                /* blocked */
              }
            }}
          >
            {copied ? <Check size={14} className="text-palm" /> : <Copy size={14} />}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="inv-name">
            <Input id="inv-name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoFocus />
          </Field>
          <Field label="Work email" htmlFor="inv-email">
            <Input id="inv-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@devstrike.ng" />
          </Field>
          <Field label="Role" htmlFor="inv-role" hint={PLATFORM_ROLES[f.role].description}>
            <Select id="inv-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as PlatformRole })}>
              {PLATFORM_ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {PLATFORM_ROLES[r].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </Dialog>
  );
}

function UserSheet({ u, onClose }: { u: PlatformUserRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const me = useMe().data;
  const sessions = useUserSessions(u?.id ?? null);
  const [confirm, setConfirm] = useState<"mfa" | "deactivate" | null>(null);
  const [ips, setIps] = useState<string | null>(null);
  const self = u?.id === me?.id;
  const now = useNow(30_000);
  const inv = () => {
    void qc.invalidateQueries({ queryKey: qk.users });
    if (u) void qc.invalidateQueries({ queryKey: qk.userSessions(u.id) });
  };
  const update = useMutation({
    mutationFn: (body: Parameters<typeof usersApi.update>[1]) => usersApi.update(u!.id, body),
    onSuccess: () => (toast.success("Saved", u?.fullName), inv()),
    meta: { errorTitle: "Not saved" },
  });
  const unlock = useMutation({ mutationFn: () => usersApi.unlock(u!.id), onSuccess: () => (toast.success("Unlocked"), inv()) });
  const resend = useMutation({
    mutationFn: () => usersApi.resendInvite(u!.id),
    onSuccess: async (r) => {
      try {
        await navigator.clipboard.writeText(r.inviteUrl);
        toast.success("Invitation sent again", "The link is also on your clipboard.");
      } catch {
        toast.success("Invitation sent again");
      }
    },
  });
  const revoke = useMutation({ mutationFn: (sid: string) => usersApi.revokeSession(u!.id, sid), onSuccess: () => (toast.success("Session ended"), inv()) });
  if (!u) return <Sheet open={false} onOpenChange={() => undefined} title="" />;
  const locked = u.lockedUntil && new Date(u.lockedUntil).getTime() > now;
  const cidrs = ips ?? u.ipAllowlist.join("\n");
  const cidrList = cidrs.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const cidrOk = cidrList.every((c) => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-f:]+(\/\d{1,3})?$/i.test(c));
  return (
    <Sheet open={!!u} onOpenChange={(o) => !o && (setIps(null), onClose())} eyebrow={u.email} title={u.fullName} width="max-w-[540px]">
      <div className="flex flex-col gap-6">
        <section>
          <Field label="Role" htmlFor="u-role" hint={self ? "You can't change your own role." : "Changing a role asks for your code."}>
            <Select id="u-role" value={u.role} disabled={self || update.isPending} onChange={(e) => update.mutate({ role: e.target.value as PlatformRole })}>
              {PLATFORM_ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {PLATFORM_ROLES[r].label}
                </option>
              ))}
            </Select>
          </Field>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {ROLE_PERMISSIONS[u.role].map((p) => (
              <li key={p} className="rounded-xs border border-line bg-surface-2/60 px-1.5 py-0.5 text-[11px] text-ink-muted">
                {PERMISSION_LABEL[p]}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-line p-4">
          <p className="eyebrow mb-3 text-[10px]">Sign-in</p>
          <div className="flex flex-col gap-2 text-[13px]">
            <p className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-ink">
                {u.mfaEnabled ? <ShieldCheck size={15} weight="duotone" className="text-palm" /> : <ShieldWarning size={15} weight="duotone" className="text-ochre" />}
                {u.mfaEnabled ? "Authenticator set up" : u.invitePending ? "Will set up on accepting" : "Will set up at next sign-in"}
              </span>
              {u.mfaEnabled && (
                <Button size="sm" variant="secondary" onClick={() => setConfirm("mfa")}>
                  <Key size={13} /> Reset 2FA
                </Button>
              )}
            </p>
            {locked && (
              <p className="flex items-center justify-between gap-3 text-laterite">
                Locked until {new Date(u.lockedUntil!).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })}
                <Button size="sm" variant="secondary" loading={unlock.isPending} onClick={() => unlock.mutate()}>
                  <LockOpen size={13} /> Unlock
                </Button>
              </p>
            )}
            {u.invitePending && (
              <p className="flex items-center justify-between gap-3 text-ink-muted">
                Invited, expires {formatDate(u.inviteExpiresAt)}
                <Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>
                  <PaperPlaneTilt size={13} /> Resend
                </Button>
              </p>
            )}
          </div>
        </section>

        <section>
          <Field label="IP allowlist" htmlFor="u-ips" hint="One CIDR per line, e.g. 102.89.0.0/16. Empty allows any address. Asks for your code." error={!cidrOk ? "One of these isn't a valid address or range." : null}>
            <Textarea id="u-ips" className="min-h-20 font-mono text-[12.5px]" value={cidrs} onChange={(e) => setIps(e.target.value)} placeholder="41.58.10.4/32" />
          </Field>
          {ips !== null && ips !== u.ipAllowlist.join("\n") && (
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIps(null)}>
                Reset
              </Button>
              <Button size="sm" disabled={!cidrOk} loading={update.isPending} onClick={() => update.mutate({ ipAllowlist: cidrList }, { onSuccess: () => setIps(null) })}>
                Save allowlist
              </Button>
            </div>
          )}
        </section>

        <section>
          <p className="eyebrow mb-2 text-[10px]">Sessions</p>
          {!sessions.data ? (
            <Skeleton className="h-16" />
          ) : !sessions.data.filter((s) => !s.revokedAt).length ? (
            <p className="text-[13px] text-ink-muted">No active sessions.</p>
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line">
              {sessions.data
                .filter((s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now)
                .map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                    <span className="min-w-0">
                      <span className="block text-ink">{deviceName(s.userAgent)}</span>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {s.ip} &middot; seen {relativeTime(s.lastSeenAt)}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                      End
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {!self && (
          <section className="border-t border-line pt-5">
            {u.isActive ? (
              <Button variant="ghost" className="text-laterite" onClick={() => setConfirm("deactivate")}>
                <UserMinus size={14} /> Deactivate {u.fullName.split(" ")[0]}
              </Button>
            ) : (
              <Button variant="secondary" loading={update.isPending} onClick={() => update.mutate({ isActive: true })}>
                Reactivate
              </Button>
            )}
          </section>
        )}
      </div>
      <ConfirmDialog
        open={confirm === "mfa"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Reset ${u.fullName.split(" ")[0]}'s two-factor?`}
        body="Their authenticator and recovery codes are cleared and every session ends. They set up a new authenticator at their next sign-in. Do this only after confirming who they are, by voice."
        confirmLabel="Reset 2FA"
        danger
        onConfirm={async () => {
          await usersApi.resetMfa(u.id);
          toast.success("Two-factor reset", u.fullName);
          inv();
        }}
      />
      <ConfirmDialog
        open={confirm === "deactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Deactivate ${u.fullName}?`}
        body="They are signed out everywhere and can't sign in. Their name stays on the audit log."
        confirmLabel="Deactivate"
        danger
        onConfirm={async () => {
          await usersApi.update(u.id, { isActive: false });
          toast.success("Deactivated", u.fullName);
          inv();
        }}
      />
    </Sheet>
  );
}


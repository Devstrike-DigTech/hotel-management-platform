"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowSquareOut,
  Browser,
  Buildings,
  ChatCircleText,
  Eye,
  Lifebuoy,
  LockSimple,
  MagnifyingGlass,
  Paperclip,
  PaperPlaneRight,
  Tray,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { supportApi } from "@/lib/api/endpoints";
import { qk, useSupport, useSupportItem, useSupportSummary, useUsers } from "@/lib/api/hooks";
import type { Attachment, SupportCategory, SupportPriority, SupportRequest, SupportRequestDetail, SupportStatus } from "@/lib/api/types-m6";
import { planName } from "@/lib/catalog";
import { bytes, deviceName, formatDateTime, initials, relativeTime, titleCase } from "@/lib/format";
import { toast } from "@/lib/store";
import { useCan, useMe } from "@/lib/session";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { Gate, SlaClock } from "@/components/ui/kit";
import { ImpersonationLauncher, type LaunchTarget } from "@/components/impersonation/launcher";

type View = "needs" | "open" | "mine" | "unassigned" | "due" | "overdue" | "waiting" | "resolved";
const VIEWS: { key: View; label: string; query: Record<string, string>; count?: (s: NonNullable<ReturnType<typeof useSupportSummary>["data"]>) => number }[] = [
  { key: "needs", label: "New", query: { status: "NEW" }, count: (s) => s.new },
  { key: "open", label: "All open", query: {}, count: (s) => s.open + s.waitingOnHotel },
  { key: "mine", label: "Assigned to me", query: { assigneeId: "me" }, count: (s) => s.mine },
  { key: "unassigned", label: "Unassigned", query: { assigneeId: "none" } },
  { key: "due", label: "Due soon", query: { sla: "DUE_SOON" }, count: (s) => s.dueSoon },
  { key: "overdue", label: "Overdue", query: { sla: "BREACHED" }, count: (s) => s.overdue },
  { key: "waiting", label: "Waiting on hotel", query: { status: "WAITING_ON_HOTEL" }, count: (s) => s.waitingOnHotel },
  { key: "resolved", label: "Resolved", query: { status: "RESOLVED,CLOSED" } },
];
const STATUS_TONE: Record<SupportStatus, "adire" | "brass" | "neutral" | "palm" | "ochre"> = {
  NEW: "brass",
  OPEN: "adire",
  WAITING_ON_HOTEL: "neutral",
  RESOLVED: "palm",
  CLOSED: "neutral",
};
const PRIORITY_TONE: Record<SupportPriority, string> = { LOW: "text-ink-faint", NORMAL: "text-ink-muted", HIGH: "text-ochre", URGENT: "text-laterite" };
const CATEGORIES: SupportCategory[] = ["BILLING", "TECHNICAL", "ACCOUNT", "BOOKINGS", "PAYMENTS", "FEATURE_REQUEST", "DATA_PRIVACY", "OTHER"];

export function SupportView() {
  return (
    <Gate perm="support.handle">
      <Desk />
    </Gate>
  );
}

function Desk() {
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<View>((params.get("view") as View) || "open");
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("open"));
  const tenantId = params.get("tenantId") ?? undefined;
  useEffect(() => {
    const t = setTimeout(() => setDeb(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);
  const summary = useSupportSummary();
  const def = VIEWS.find((v) => v.key === view)!;
  const list = useSupport({ ...def.query, q: deb || undefined, tenantId, pageSize: 50 });
  const items = list.data?.items ?? [];
  const wide = useWide();
  const current = selected ?? (wide ? (items[0]?.id ?? null) : null);

  return (
    <div className="-mx-4 -mb-20 -mt-6 sm:-mx-6 md:-mt-8 lg:-mx-8 xl:-mx-10">
      <div className="flex h-[calc(100dvh-56px)] min-h-[560px]">
        {/* views */}
        <aside className="hidden w-[208px] shrink-0 flex-col border-r border-line bg-surface/60 xl:flex">
          <div className="px-5 pb-3 pt-6">
            <p className="eyebrow flex items-center gap-2">
              <Lifebuoy size={13} weight="duotone" /> Support desk
            </p>
          </div>
          <nav className="flex flex-col gap-px px-2" aria-label="Support views">
            {VIEWS.map((v) => {
              const n = summary.data && v.count ? v.count(summary.data) : null;
              const on = v.key === view;
              return (
                <button
                  key={v.key}
                  onClick={() => (setView(v.key), setSelected(null))}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "flex h-9 items-center justify-between rounded-md px-3 text-left text-[13px] transition-colors",
                    on ? "bg-surface-2 text-ink" : "text-ink-muted hover:bg-surface-2/60 hover:text-ink",
                  )}
                >
                  {v.label}
                  {n !== null && n > 0 && (
                    <span className={cn("font-mono text-[11px]", v.key === "overdue" ? "text-laterite" : v.key === "needs" ? "text-brass-text" : "text-ink-muted")}>{n}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-line px-5 py-4 text-[11.5px] leading-relaxed text-ink-muted">
            First response SLA: Starter 48h, Growth 24h, Pro 8h, Enterprise 2h.
          </div>
        </aside>

        {/* list */}
        <section className={cn("flex w-full min-w-0 flex-col border-r border-line lg:w-[380px] lg:shrink-0", current && "max-lg:hidden")} aria-label="Requests">
          <div className="flex flex-col gap-2 border-b border-line px-4 pb-3 pt-5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="display-sm text-[22px] text-ink">{def.label}</h1>
              {summary.data && (
                <span className="flex gap-3 font-mono text-[11px]">
                  {summary.data.overdue > 0 && <span className="text-laterite">{summary.data.overdue} overdue</span>}
                  {summary.data.dueSoon > 0 && <span className="text-ochre">{summary.data.dueSoon} due soon</span>}
                </span>
              )}
            </div>
            <Select aria-label="View" value={view} onChange={(e) => (setView(e.target.value as View), setSelected(null))} className="xl:hidden">
              {VIEWS.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </Select>
            <div className="relative">
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, hotel or SR number" className="h-9 pl-9" aria-label="Search requests" />
            </div>
            {tenantId && (
              <button onClick={() => router.replace("/support")} className="inline-flex items-center gap-1 self-start text-[12px] text-adire hover:underline">
                <X size={12} /> Showing one hotel only
              </button>
            )}
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {list.isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : !items.length ? (
              <EmptyState compact glyph="frond" title="Nothing here" body="No requests in this view." />
            ) : (
              <ul className="divide-y divide-line">
                {items.map((r) => (
                  <RequestRow key={r.id} r={r} active={r.id === current} onClick={() => setSelected(r.id)} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* thread */}
        <section className={cn("min-w-0 flex-1 flex-col", current ? "flex" : "hidden lg:flex")} aria-label="Request">
          {current ? (
            <Thread key={current} id={current} onBack={() => setSelected(null)} />
          ) : (
            <div className="grid flex-1 place-items-center">
              <EmptyState glyph="rings" title="Pick a request" body="The thread, the hotel's context and your internal notes appear here." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RequestRow({ r, active, onClick }: { r: SupportRequest; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn("relative flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors", active ? "bg-adire-wash/60" : "hover:bg-surface-2/60")}
        data-testid="support-row"
      >
        {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-adire" />}
        <span className="flex items-center gap-2">
          {r.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brass" aria-label="Unread" />}
          <span className="font-mono text-[11px] text-ink-muted">{r.number}</span>
          <span className={cn("font-mono text-[10px] uppercase tracking-[0.1em]", PRIORITY_TONE[r.priority])}>{r.priority !== "NORMAL" ? r.priority : ""}</span>
          <span className="ml-auto">
            <SlaClock dueAt={r.firstResponseDueAt} respondedAt={r.firstRespondedAt} sla={r.sla} compact />
          </span>
        </span>
        <span className={cn("line-clamp-2 text-[13.5px] leading-snug", r.unread ? "font-medium text-ink" : "text-ink")}>{r.subject}</span>
        <span className="flex items-center gap-2 text-[12px] text-ink-muted">
          <span className="truncate">{r.tenant.name}</span>
          <PlanPlate name={planName(r.planCode)} code={r.planCode} className="h-4 px-1 text-[9px]" />
          <span className="ml-auto shrink-0" suppressHydrationWarning>
            {relativeTime(r.lastMessageAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const can = useCan();
  const me = useMe().data;
  const item = useSupportItem(id);
  const users = useUsers(can("platform_users.manage"));
  const [launch, setLaunch] = useState<LaunchTarget | null>(null);
  const r = item.data;
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [r?.messages.length, id]);

  const update = useMutation({
    mutationFn: (body: Parameters<typeof supportApi.update>[1]) => supportApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.supportItem(id) });
      void qc.invalidateQueries({ queryKey: qk.supportAll });
      void qc.invalidateQueries({ queryKey: qk.supportSummary });
    },
    meta: { errorTitle: "Request not updated" },
  });

  const assignees = (users.data ?? [])
    .filter((u) => u.isActive && !u.invitePending && ["SUPER_ADMIN", "OPERATIONS", "SUPPORT"].includes(u.role))
    .map((u) => ({ id: u.id, name: u.fullName }));
  if (me && !assignees.some((u) => u.id === me.id)) assignees.unshift({ id: me.id, name: me.fullName });
  if (r?.assignee && !assignees.some((u) => u.id === r.assignee!.id)) assignees.push({ id: r.assignee.id, name: r.assignee.fullName });

  if (item.isLoading || !r)
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );

  return (
    <>
      <header className="border-b border-line px-5 pb-4 pt-5 lg:px-6">
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink lg:hidden">
          <ArrowLeft size={14} /> Requests
        </button>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
              <span className="font-mono">{r.number}</span>
              <Badge tone={STATUS_TONE[r.status]}>{titleCase(r.status)}</Badge>
              <SlaClock dueAt={r.firstResponseDueAt} respondedAt={r.firstRespondedAt} sla={r.sla} />
              <span>
                {r.slaHours}h SLA on {planName(r.planCode)}
              </span>
            </p>
            <h2 className="display-sm mt-2 text-[21px] leading-snug text-ink">{r.subject}</h2>
          </div>
          {can("impersonate") && (
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 self-start"
              onClick={() => setLaunch({ tenantId: r.tenant.id, tenantName: r.tenant.name, staffId: r.openedBy.id, supportRequestId: r.id, supportNumber: r.number })}
              data-testid="support-view-as"
            >
              <Eye size={14} /> View as {r.openedBy.fullName.split(" ")[0]}
            </Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select aria-label="Status" className="h-8 text-[13px]" value={r.status} onChange={(e) => update.mutate({ status: e.target.value })}>
            {(["NEW", "OPEN", "WAITING_ON_HOTEL", "RESOLVED", "CLOSED"] as SupportStatus[]).map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
          <Select aria-label="Priority" className="h-8 text-[13px]" value={r.priority} onChange={(e) => update.mutate({ priority: e.target.value })}>
            {(["LOW", "NORMAL", "HIGH", "URGENT"] as SupportPriority[]).map((p) => (
              <option key={p} value={p}>
                {titleCase(p)} priority
              </option>
            ))}
          </Select>
          <Select aria-label="Category" className="h-8 text-[13px]" value={r.category} onChange={(e) => update.mutate({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </Select>
          <Select aria-label="Assignee" className="h-8 text-[13px]" value={r.assignee?.id ?? ""} onChange={(e) => update.mutate({ assigneeId: e.target.value || null })}>
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === me?.id ? `${u.name} (me)` : u.name}
              </option>
            ))}
          </Select>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col 2xl:flex-row">
        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ol className="flex flex-col gap-4 px-5 py-5 lg:px-6" aria-label="Messages">
            {r.messages.map((m) => (
              <Message key={m.id} m={m} />
            ))}
            <div ref={bottom} />
          </ol>
        </div>
        <Context r={r} />
      </div>
      <Composer r={r} />
      <ImpersonationLauncher open={!!launch} onOpenChange={(o) => !o && setLaunch(null)} target={launch ?? {}} />
    </>
  );
}

function Message({ m }: { m: SupportRequestDetail["messages"][number] }) {
  const platform = m.author.kind === "PLATFORM";
  return (
    <li className={cn("flex gap-3", platform && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[10.5px]",
          m.internal ? "border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-brass-wash text-brass-text" : platform ? "border-adire/40 bg-adire-wash text-adire" : "border-line-strong bg-surface text-ink-muted",
        )}
        aria-hidden
      >
        {initials(m.author.fullName)}
      </span>
      <div className={cn("min-w-0 max-w-[min(560px,85%)]", platform && "text-right")}>
        <p className="mb-1 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-muted" style={{ justifyContent: platform ? "flex-end" : undefined }}>
          <span className="text-ink">{m.author.fullName}</span>
          {m.internal && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-brass-text">
              <LockSimple size={10} weight="bold" /> Internal note
            </span>
          )}
          <span className="font-mono" title={formatDateTime(m.createdAt)} suppressHydrationWarning>
            {relativeTime(m.createdAt)}
          </span>
        </p>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-lg border px-4 py-3 text-left text-[13.5px] leading-relaxed",
            m.internal
              ? "border-dashed border-[color-mix(in_oklab,var(--brass)_50%,transparent)] bg-brass-wash/60 text-ink"
              : platform
                ? "border-transparent bg-adire text-adire-ink"
                : "border-line bg-surface text-ink",
          )}
        >
          {m.body}
          {!!m.attachments.length && <Attachments list={m.attachments} inverted={platform && !m.internal} />}
        </div>
      </div>
    </li>
  );
}

function Attachments({ list, inverted }: { list: Attachment[]; inverted?: boolean }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {list.map((a) => (
        <li key={a.key}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[12px]", inverted ? "border-white/25 hover:bg-white/10" : "border-line-strong bg-surface-2/60 hover:bg-surface-2")}
          >
            <Paperclip size={12} /> {a.name} <span className="font-mono opacity-70">{bytes(a.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Context({ r }: { r: SupportRequestDetail }) {
  return (
    <aside className="shrink-0 border-t border-line bg-surface/50 px-5 py-4 text-[12.5px] 2xl:w-[260px] 2xl:border-l 2xl:border-t-0" aria-label="Context">
      <p className="eyebrow mb-3 text-[10px]">Context, attached by the admin</p>
      <dl className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 gap-y-2.5 sm:grid-cols-[18px_minmax(0,1fr)_18px_minmax(0,1fr)] 2xl:grid-cols-[18px_minmax(0,1fr)]">
        <Buildings size={14} className="mt-0.5 text-ink-muted" aria-hidden />
        <dd className="min-w-0">
          <Link href={`/tenants/${r.tenant.id}`} className="text-ink hover:underline">
            {r.tenant.name}
          </Link>
          <span className="block text-ink-muted">{r.context.propertyName ?? r.property?.name}</span>
        </dd>
        <UserCircle size={14} className="mt-0.5 text-ink-muted" aria-hidden />
        <dd className="min-w-0">
          <span className="text-ink">{r.openedBy.fullName}</span>
          <span className="block truncate text-ink-muted">
            {titleCase(r.context.userRole ?? r.openedBy.role)} &middot; {r.openedBy.email}
          </span>
        </dd>
        <Browser size={14} className="mt-0.5 text-ink-muted" aria-hidden />
        <dd className="min-w-0">
          {r.context.pageUrl ? (
            <a href={r.context.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[11.5px] text-adire hover:underline">
              <span className="truncate">{r.context.pageUrl.replace(/^https?:\/\//, "")}</span> <ArrowSquareOut size={11} className="shrink-0" />
            </a>
          ) : (
            <span className="text-ink-muted">No page</span>
          )}
          <span className="block text-ink-muted">
            {deviceName(r.context.userAgent)}
            {r.context.appVersion ? ` · v${r.context.appVersion}` : ""}
          </span>
        </dd>
        <ChatCircleText size={14} className="mt-0.5 text-ink-muted" aria-hidden />
        <dd className="min-w-0 text-ink-muted">
          Opened {formatDateTime(r.createdAt)}
          <span className="block">{titleCase(r.category)}</span>
        </dd>
      </dl>
    </aside>
  );
}

function Composer({ r }: { r: SupportRequestDetail }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const note = mode === "note";
  const send = useMutation({
    mutationFn: () => supportApi.reply(r.id, { body: body.trim(), internal: note, attachmentKeys: files.map((f) => f.key) }),
    onSuccess: () => {
      setBody("");
      setFiles([]);
      toast.success(note ? "Note added" : "Reply sent", note ? "Only Devstrike can see it." : `${r.openedBy.fullName} gets it in the admin and by email.`);
      void qc.invalidateQueries({ queryKey: qk.supportItem(r.id) });
      void qc.invalidateQueries({ queryKey: qk.supportAll });
      void qc.invalidateQueries({ queryKey: qk.supportSummary });
    },
    meta: { errorTitle: "Not sent" },
  });
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list).slice(0, 5)) {
        if (f.size > 10 * 1024 * 1024) {
          toast.error("Too large", `${f.name} is over 10 MB.`);
          continue;
        }
        const a = await supportApi.attach(f);
        setFiles((x) => [...x, a]);
      }
    } catch (e) {
      toast.error("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <form
      className={cn("border-t px-5 pb-4 pt-3 lg:px-6", note ? "border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-brass-wash/35" : "border-line bg-surface")}
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) send.mutate();
      }}
    >
      <div className="mb-2 flex items-center gap-1" role="tablist" aria-label="Message type">
        {(["reply", "note"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[12.5px] transition-colors",
              mode === k ? (k === "note" ? "bg-brass-wash text-brass-text" : "bg-adire-wash text-adire") : "text-ink-muted hover:text-ink",
            )}
          >
            {k === "note" ? <LockSimple size={13} /> : <Tray size={13} />} {k === "note" ? "Internal note" : `Reply to ${r.openedBy.fullName.split(" ")[0]}`}
          </button>
        ))}
        <span className="ml-auto hidden text-[11.5px] text-ink-faint sm:inline">Ctrl Enter to send</span>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
            e.preventDefault();
            send.mutate();
          }
        }}
        placeholder={note ? "Only Devstrike staff see notes." : "Write a reply. It goes to the hotel admin and by email."}
        className={cn("min-h-[84px] resize-y", note && "border-[color-mix(in_oklab,var(--brass)_45%,transparent)]")}
        aria-label={note ? "Internal note" : "Reply"}
        data-testid="support-composer"
      />
      {!!files.length && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.key} className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface-2 px-2 py-1 text-[12px]">
              <Paperclip size={12} /> {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.key !== f.key))} className="text-ink-faint hover:text-ink">
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <input ref={fileRef} type="file" multiple className="sr-only" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv" onChange={(e) => void upload(e.target.files)} id="support-files" />
        <Button type="button" variant="ghost" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
          <Paperclip size={14} /> Attach
        </Button>
        <Button type="submit" size="sm" variant={note ? "brass" : "primary"} className="ml-auto" disabled={!body.trim()} loading={send.isPending} data-testid="support-send">
          {note ? <LockSimple size={13} /> : <PaperPlaneRight size={13} weight="fill" />} {note ? "Add note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}

/** true on screens wide enough to show the list and the thread side by side */
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

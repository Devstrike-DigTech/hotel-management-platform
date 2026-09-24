"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Bell, ChartBar, EnvelopeSimple, Megaphone, PencilSimple, Plus, Stop } from "@phosphor-icons/react";
import { announcementsApi } from "@/lib/api/endpoints";
import { useAnnouncementStats, useAnnouncements } from "@/lib/api/hooks";
import type { Announcement, AnnouncementState } from "@/lib/api/types-m6";
import { planName } from "@/lib/catalog";
import { formatDateTime, number } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { Gate } from "@/components/ui/kit";
import { SEVERITY } from "./severity";

type Filter = "live" | "DRAFT" | "ENDED";
const STATE_TONE: Record<AnnouncementState, "palm" | "adire" | "neutral" | "brass"> = { ACTIVE: "palm", SCHEDULED: "adire", DRAFT: "neutral", ENDED: "neutral", ARCHIVED: "neutral" };

export function AnnouncementsView() {
  return (
    <Gate perm="announcements.manage">
      <View />
    </Gate>
  );
}

function View() {
  const [filter, setFilter] = useState<Filter>("live");
  const [stats, setStats] = useState<Announcement | null>(null);
  const list = useAnnouncements();
  const items = (list.data ?? []).filter((a) => (filter === "live" ? a.state === "ACTIVE" || a.state === "SCHEDULED" : a.state === filter));
  const count = (f: Filter) => (list.data ?? []).filter((a) => (f === "live" ? a.state === "ACTIVE" || a.state === "SCHEDULED" : a.state === f)).length;
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Megaphone size={14} weight="duotone" /> Announcements
          </>
        }
        title={
          <>
            One message, <em>every desk</em>.
          </>
        }
        description="Banners in the hotel admin and emails to owners, targeted by plan, city or hotel, inside a time window."
        actions={
          <ButtonLink href="/announcements/new" data-testid="new-announcement">
            <Plus size={15} weight="bold" /> New announcement
          </ButtonLink>
        }
      />
      <Segmented<Filter>
        label="Filter announcements"
        value={filter}
        onChange={setFilter}
        className="mb-5"
        options={[
          { value: "live", label: `Live and scheduled ${count("live") || ""}` },
          { value: "DRAFT", label: `Drafts ${count("DRAFT") || ""}` },
          { value: "ENDED", label: "Ended" },
        ]}
      />
      {list.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
      ) : list.isError ? (
        <Panel>
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        </Panel>
      ) : !items.length ? (
        <Panel>
          <EmptyState glyph="arcs" title={filter === "live" ? "Nothing on the air" : filter === "DRAFT" ? "No drafts" : "Nothing has ended yet"} />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((a) => (
            <Card key={a.id} a={a} onStats={() => setStats(a)} />
          ))}
        </div>
      )}
      <StatsSheet a={stats} onClose={() => setStats(null)} />
    </>
  );
}

function audienceText(a: Announcement) {
  const x = a.audience;
  if (x.kind === "ALL") return "Every hotel";
  if (x.kind === "PLANS") return x.planCodes.map(planName).join(", ");
  if (x.kind === "CITIES") return x.cities.join(", ");
  return `${x.tenantIds.length} ${x.tenantIds.length === 1 ? "hotel" : "hotels"}`;
}

function Card({ a, onStats }: { a: Announcement; onStats: () => void }) {
  const qc = useQueryClient();
  const m = SEVERITY[a.severity];
  const inv = () => void qc.invalidateQueries({ queryKey: ["platform", "announcements"] });
  const end = useMutation({ mutationFn: () => announcementsApi.end(a.id), onSuccess: () => (toast.success("Announcement ended"), inv()) });
  const archive = useMutation({ mutationFn: () => announcementsApi.archive(a.id), onSuccess: () => (toast.success("Archived"), inv()) });
  const publish = useMutation({ mutationFn: () => announcementsApi.publish(a.id), onSuccess: () => (toast.success("Published"), inv()), meta: { errorTitle: "Not published" } });
  const seenPct = a.stats.targetedTenants ? Math.min(100, (a.stats.dismissedUsers / Math.max(1, a.stats.seenUsers)) * 100) : 0;
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-surface" data-testid="announcement-card">
      <div className="flex">
        <span aria-hidden className="w-1 shrink-0" style={{ background: m.color }} />
        <div className="min-w-0 flex-1 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <m.icon size={16} weight="duotone" style={{ color: m.color }} />
            <span className="text-[12px] text-ink-muted">{m.label}</span>
            <Badge tone={STATE_TONE[a.state]} dot={a.state === "ACTIVE"}>
              {a.state === "ACTIVE" ? "Live" : a.state.charAt(0) + a.state.slice(1).toLowerCase()}
            </Badge>
            {!a.dismissible && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">not dismissible</span>}
          </div>
          <h3 className="display-sm mt-2 text-[18px] text-ink">{a.title}</h3>
          <p className="mt-1 line-clamp-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">{a.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-ink-muted">
            <span>{audienceText(a)}</span>
            <span className="font-mono">
              {formatDateTime(a.startsAt)}
              {a.endsAt ? ` to ${formatDateTime(a.endsAt)}` : ", open-ended"}
            </span>
            <span className="inline-flex items-center gap-3">
              {a.channels.inApp && (
                <span className="inline-flex items-center gap-1">
                  <Bell size={13} /> Banner
                </span>
              )}
              {a.channels.email && (
                <span className="inline-flex items-center gap-1">
                  <EnvelopeSimple size={13} /> Email
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="hidden w-[230px] shrink-0 flex-col justify-between border-l border-line px-5 py-4 md:flex">
          {a.state === "DRAFT" ? (
            <p className="text-[12.5px] text-ink-muted">Not published.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-y-1.5 text-[12px]">
              <dt className="text-ink-muted">Hotels</dt>
              <dd className="text-right font-mono text-ink">{number(a.stats.targetedTenants)}</dd>
              <dt className="text-ink-muted">Emails</dt>
              <dd className="text-right font-mono text-ink">{number(a.stats.emailsSent)}</dd>
              <dt className="text-ink-muted">Seen by</dt>
              <dd className="text-right font-mono text-ink">{number(a.stats.seenUsers)}</dd>
              <dt className="text-ink-muted">Dismissed</dt>
              <dd className="text-right font-mono text-ink">{number(a.stats.dismissedUsers)}</dd>
            </dl>
          )}
          {a.state !== "DRAFT" && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2" title="Dismissed of seen" aria-hidden>
              <div className="h-full rounded-full bg-adire-soft" style={{ width: `${seenPct}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/35 px-4 py-2">
        {a.state !== "DRAFT" && (
          <Button size="sm" variant="ghost" onClick={onStats}>
            <ChartBar size={14} /> Stats
          </Button>
        )}
        {(a.state === "DRAFT" || a.state === "SCHEDULED") && (
          <ButtonLink href={`/announcements/new?id=${a.id}`} size="sm" variant="ghost">
            <PencilSimple size={14} /> Edit
          </ButtonLink>
        )}
        <span className="ml-auto" />
        {a.state === "DRAFT" && (
          <Button size="sm" loading={publish.isPending} onClick={() => publish.mutate()}>
            Publish
          </Button>
        )}
        {(a.state === "ACTIVE" || a.state === "SCHEDULED") && (
          <Button size="sm" variant="secondary" loading={end.isPending} onClick={() => end.mutate()}>
            <Stop size={13} weight="fill" /> End now
          </Button>
        )}
        {(a.state === "DRAFT" || a.state === "ENDED") && (
          <Button size="sm" variant="ghost" loading={archive.isPending} onClick={() => archive.mutate()}>
            <Archive size={14} /> Archive
          </Button>
        )}
      </div>
    </article>
  );
}

function StatsSheet({ a, onClose }: { a: Announcement | null; onClose: () => void }) {
  const s = useAnnouncementStats(a?.id ?? null);
  const max = Math.max(1, ...(s.data?.byTenant ?? []).map((r) => r.seen));
  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()} title={a?.title ?? ""} eyebrow="Announcement stats" width="max-w-[520px]">
      {!s.data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-4 gap-3">
            {[
              ["Hotels", s.data.targetedTenants],
              ["Emails", s.data.emailsSent],
              ["Seen", s.data.seenUsers],
              ["Dismissed", s.data.dismissedUsers],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="eyebrow text-[9.5px]">{k}</p>
                <p className="figure mt-1 text-[22px] text-ink">{number(v as number)}</p>
              </div>
            ))}
          </div>
          <p className="eyebrow mb-2 text-[10px]">By hotel: staff who saw it, and dismissed it</p>
          <ul className="flex flex-col gap-2.5">
            {s.data.byTenant.map((r) => (
              <li key={r.tenant.id} className="grid grid-cols-[minmax(0,1fr)_120px_48px] items-center gap-3 text-[12.5px]">
                <span className="truncate text-ink">{r.tenant.name}</span>
                <span className="relative h-2 rounded-xs bg-surface-2" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-xs" style={{ width: `${(r.seen / max) * 100}%`, background: "var(--series-1)" }} />
                  <span className={cn("hatch absolute inset-y-0 left-0 rounded-xs")} style={{ width: `${(r.dismissed / max) * 100}%`, color: "var(--surface)" }} />
                </span>
                <span className="text-right font-mono text-ink-muted">
                  {r.seen}/{r.dismissed}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}


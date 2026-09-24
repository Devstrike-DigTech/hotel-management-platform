"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, EnvelopeSimple, Link as LinkIcon, MagnifyingGlass, Megaphone, UsersThree, X } from "@phosphor-icons/react";
import { announcementsApi } from "@/lib/api/endpoints";
import { useAnnouncements, useTenants } from "@/lib/api/hooks";
import type { AnnouncementAudience, AnnouncementInput, AnnouncementSeverity, TenantRef } from "@/lib/api/types-m6";
import { PLAN_ORDER, planName, planTone } from "@/lib/catalog";
import { config } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { ShareBar } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Switch, Textarea } from "@/components/ui/form";
import { PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { Gate } from "@/components/ui/kit";
import { SEVERITY, SEVERITY_ORDER } from "./severity";

const localInput = (d: Date) => {
  const lagos = new Date(d.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${lagos.getFullYear()}-${p(lagos.getMonth() + 1)}-${p(lagos.getDate())}T${p(lagos.getHours())}:${p(lagos.getMinutes())}`;
};
const fromLocal = (s: string) => (s ? new Date(`${s}:00+01:00`).toISOString() : null);

export function AnnouncementComposerPage() {
  return (
    <Gate perm="announcements.manage">
      <Composer />
    </Gate>
  );
}

function Composer() {
  const params = useSearchParams();
  const editId = params.get("id");
  const all = useAnnouncements();
  const existing = editId ? all.data?.find((a) => a.id === editId) : undefined;
  if (editId && !existing) return all.isLoading ? <Skeleton className="h-96 w-full rounded-lg" /> : <p className="text-[14px] text-ink-muted">That announcement no longer exists.</p>;
  const initial: AnnouncementInput = existing
    ? { title: existing.title, body: existing.body, severity: existing.severity, audience: existing.audience, channels: existing.channels, startsAt: existing.startsAt, endsAt: existing.endsAt, dismissible: existing.dismissible, link: existing.link }
    : { title: "", body: "", severity: "INFO", audience: { kind: "ALL" }, channels: { inApp: true, email: false }, startsAt: new Date().toISOString(), endsAt: null, dismissible: true, link: null };
  return <ComposerForm key={editId ?? "new"} editId={editId} initial={initial} />;
}

function ComposerForm({ editId, initial }: { editId: string | null; initial: AnnouncementInput }) {
  const router = useRouter();
  const qc = useQueryClient();
  const now = useNow(30_000);
  const [f, setF] = useState<AnnouncementInput>(initial);
  const set = <K extends keyof AnnouncementInput>(k: K, v: AnnouncementInput[K]) => setF((x) => ({ ...x, [k]: v }));

  // audience preview, debounced
  const [aud, setAud] = useState<AnnouncementAudience>(f.audience);
  useEffect(() => {
    const t = setTimeout(() => setAud(f.audience), 300);
    return () => clearTimeout(t);
  }, [f.audience]);
  const preview = useQuery({ queryKey: ["platform", "audience-preview", aud], queryFn: () => announcementsApi.preview(aud), placeholderData: (p) => p });

  const startsNow = new Date(f.startsAt).getTime() <= now + 60_000;
  const valid = f.title.trim().length >= 3 && f.body.trim().length >= 1 && (f.channels.inApp || f.channels.email) && (!f.link || (f.link.label.trim() && /^https:\/\//.test(f.link.url)));
  const audienceEmpty = (f.audience.kind === "PLANS" && !f.audience.planCodes.length) || (f.audience.kind === "CITIES" && !f.audience.cities.length) || (f.audience.kind === "TENANTS" && !f.audience.tenantIds.length);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const body = { ...f, title: f.title.trim(), body: f.body.trim() };
      const a = editId ? await announcementsApi.update(editId, body) : await announcementsApi.create(body);
      return publish ? announcementsApi.publish(a.id) : a;
    },
    onSuccess: (a, publish) => {
      toast.success(publish ? (a.state === "SCHEDULED" ? "Announcement scheduled" : "Announcement is live") : "Draft saved", a.title);
      void qc.invalidateQueries({ queryKey: ["platform", "announcements"] });
      router.push("/announcements");
    },
    meta: { errorTitle: "Announcement not saved" },
  });

  return (
    <>
      <Link href="/announcements" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Announcements
      </Link>
      <PageHeader
        eyebrow={
          <>
            <Megaphone size={14} weight="duotone" /> {editId ? "Edit announcement" : "New announcement"}
          </>
        }
        title={
          <>
            Say it <em>once</em>, to the right hotels.
          </>
        }
        description="A banner inside the hotel admin, and optionally an email to owners and managers. Plain text; line breaks are kept."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex flex-col gap-6">
          <Panel className="p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <Field label="Severity" htmlFor="sev">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Severity" id="sev">
                  {SEVERITY_ORDER.map((s) => {
                    const m = SEVERITY[s];
                    const on = f.severity === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set("severity", s)}
                        className={cn("inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] transition-colors", on ? "text-ink" : "border-line text-ink-muted hover:border-line-strong")}
                        style={on ? { borderColor: m.color, background: m.wash } : undefined}
                      >
                        <m.icon size={16} weight={on ? "fill" : "regular"} style={{ color: m.color }} /> {m.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Title" htmlFor="a-title" hint={`${f.title.length} / 120`}>
                <Input id="a-title" value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="Scheduled maintenance: Sunday 02:00 to 03:00" />
              </Field>
              <Field label="Message" htmlFor="a-body" hint={`${f.body.length} / 2000`}>
                <Textarea id="a-body" value={f.body} maxLength={2000} onChange={(e) => set("body", e.target.value)} className="min-h-32" placeholder="What is happening, when, and what (if anything) the hotel should do." />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Link label" htmlFor="a-ll" optional>
                  <Input id="a-ll" value={f.link?.label ?? ""} onChange={(e) => set("link", e.target.value || f.link?.url ? { label: e.target.value, url: f.link?.url ?? "" } : null)} placeholder="Read more" />
                </Field>
                <Field label="Link address" htmlFor="a-lu" optional error={f.link?.url && !/^https:\/\//.test(f.link.url) ? "Use an https:// address." : null}>
                  <Input id="a-lu" value={f.link?.url ?? ""} onChange={(e) => set("link", e.target.value || f.link?.label ? { label: f.link?.label ?? "", url: e.target.value } : null)} placeholder="https://" className="font-mono text-[13px]" />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="display-sm mb-4 flex items-center gap-2 text-[17px] text-ink">
              <UsersThree size={17} weight="duotone" className="text-adire" /> Audience
            </h2>
            <Segmented
              label="Audience"
              value={f.audience.kind}
              onChange={(k) =>
                set("audience", k === "ALL" ? { kind: "ALL" } : k === "PLANS" ? { kind: "PLANS", planCodes: [] } : k === "CITIES" ? { kind: "CITIES", cities: [] } : { kind: "TENANTS", tenantIds: [] })
              }
              options={[
                { value: "ALL", label: "Every hotel" },
                { value: "PLANS", label: "By plan" },
                { value: "CITIES", label: "By city" },
                { value: "TENANTS", label: "Specific hotels" },
              ]}
            />
            <div className="mt-4">
              <AudiencePicker audience={f.audience} onChange={(a) => set("audience", a)} />
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Starts" htmlFor="a-start" hint={startsNow ? "Goes live as soon as you publish." : "Scheduled; email goes out at this time."}>
                <Input id="a-start" type="datetime-local" className="font-mono" value={localInput(new Date(f.startsAt))} onChange={(e) => set("startsAt", fromLocal(e.target.value) ?? new Date().toISOString())} />
              </Field>
              <Field label="Ends" htmlFor="a-end" optional hint="Empty keeps it up until you end it.">
                <Input id="a-end" type="datetime-local" className="font-mono" value={f.endsAt ? localInput(new Date(f.endsAt)) : ""} onChange={(e) => set("endsAt", fromLocal(e.target.value))} />
              </Field>
              <div className="flex flex-col gap-3 sm:col-span-2">
                <p className="text-[13px] font-medium text-ink">Channels</p>
                <Checkbox checked={f.channels.inApp} onChange={(v) => set("channels", { ...f.channels, inApp: v })} label={<span className="inline-flex items-center gap-1.5"><Bell size={14} /> Banner in the hotel admin</span>} />
                <Checkbox checked={f.channels.email} onChange={(v) => set("channels", { ...f.channels, email: v })} label={<span className="inline-flex items-center gap-1.5"><EnvelopeSimple size={14} /> Email to owners and managers</span>} />
              </div>
              <div className="sm:col-span-2">
                <Switch checked={f.dismissible} onChange={(v) => set("dismissible", v)} label="Staff can dismiss it" description="Turn off for outages and anything everyone must see until it ends." />
              </div>
            </div>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-20 xl:self-start">
          <Preview f={f} />
          <Panel>
            <div className="border-b border-line px-5 py-4">
              <p className="eyebrow text-[10px]">Who receives it</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="figure text-[34px] leading-none text-adire" data-testid="audience-count">
                  {preview.data ? preview.data.tenantCount : "-"}
                </span>
                <span className="text-[13px] text-ink-muted">{preview.data?.tenantCount === 1 ? "hotel" : "hotels"}</span>
                {preview.isFetching && <span className="live-dot ml-auto text-adire" aria-hidden />}
              </p>
            </div>
            <div className="px-5 py-4">
              {preview.data && preview.data.tenantCount > 0 ? (
                <>
                  <ShareBar
                    label="Audience by plan"
                    items={PLAN_ORDER.filter((p) => preview.data!.byPlan[p]).map((p) => ({ key: p, label: planName(p), value: preview.data!.byPlan[p] ?? 0, color: planTone(p), ink: "#fff" }))}
                  />
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {preview.data.sample.map((t) => (
                      <li key={t.id} className="rounded-sm border border-line bg-surface-2/60 px-2 py-0.5 text-[12px] text-ink">
                        {t.name}
                      </li>
                    ))}
                    {preview.data.tenantCount > preview.data.sample.length && (
                      <li className="px-1 py-0.5 text-[12px] text-ink-muted">and {preview.data.tenantCount - preview.data.sample.length} more</li>
                    )}
                  </ul>
                </>
              ) : (
                <p className="text-[13px] text-ink-muted">{audienceEmpty ? "Choose who should receive it." : "No hotel matches this audience."}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-line bg-surface-2/40 px-5 py-4 sm:flex-row">
              <Button variant="secondary" disabled={!valid} loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>
                Save draft
              </Button>
              <Button className="sm:ml-auto" disabled={!valid || audienceEmpty || !preview.data?.tenantCount} loading={save.isPending && save.variables === true} onClick={() => save.mutate(true)} data-testid="publish-announcement">
                {startsNow ? "Publish now" : `Schedule for ${formatDateTime(f.startsAt)}`}
              </Button>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

/** A sketch of the hotel admin with the banner as staff will see it. */
function Preview({ f }: { f: AnnouncementInput }) {
  const m = SEVERITY[f.severity];
  return (
    <div>
      <p className="eyebrow mb-2 text-[10px]">In the hotel admin</p>
      <div className="overflow-hidden rounded-lg border border-line bg-paper shadow-float" aria-label="Banner preview">
        <div className="flex h-8 items-center gap-2 border-b border-line bg-surface px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="ml-3 truncate font-mono text-[10.5px] text-ink-faint">admin.{config.appDomain}/today</span>
        </div>
        <div className="flex items-start gap-3 border-b px-4 py-3" style={{ background: m.wash, borderColor: `color-mix(in oklab, ${m.color} 30%, transparent)` }}>
          <m.icon size={18} weight="duotone" style={{ color: m.color }} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-ink">{f.title || "Your title"}</p>
            <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-muted">{f.body || "Your message appears here."}</p>
            {f.link?.label && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium underline underline-offset-4" style={{ color: m.color }}>
                <LinkIcon size={12} /> {f.link.label}
              </span>
            )}
          </div>
          {f.dismissible && <X size={14} className="mt-1 shrink-0 text-ink-faint" aria-label="Dismiss (preview)" />}
        </div>
        <div className="grid grid-cols-3 gap-3 p-4" aria-hidden>
          <Skeleton className="h-14 animate-none" />
          <Skeleton className="h-14 animate-none" />
          <Skeleton className="h-14 animate-none" />
          <Skeleton className="col-span-3 h-20 animate-none" />
        </div>
      </div>
    </div>
  );
}

function AudiencePicker({ audience, onChange }: { audience: AnnouncementAudience; onChange: (a: AnnouncementAudience) => void }) {
  const tenants = useTenants({ pageSize: 100, sort: "name" }, audience.kind === "CITIES" || audience.kind === "TENANTS");
  const cities = useMemo(() => [...new Set((tenants.data?.items ?? []).map((t) => t.city).filter(Boolean) as string[])].sort(), [tenants.data]);
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<TenantRef[]>([]);
  if (audience.kind === "ALL") return <p className="text-[13px] text-ink-muted">Every active hotel, on every plan, in every city.</p>;
  if (audience.kind === "PLANS")
    return (
      <div className="flex flex-wrap gap-4">
        {PLAN_ORDER.map((p) => (
          <Checkbox
            key={p}
            checked={audience.planCodes.includes(p)}
            onChange={(v) => onChange({ kind: "PLANS", planCodes: v ? [...audience.planCodes, p] : audience.planCodes.filter((x) => x !== p) })}
            label={planName(p)}
          />
        ))}
      </div>
    );
  if (audience.kind === "CITIES")
    return tenants.isLoading ? (
      <Skeleton className="h-10" />
    ) : (
      <div className="flex flex-wrap gap-2">
        {cities.map((c) => {
          const on = audience.cities.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ kind: "CITIES", cities: on ? audience.cities.filter((x) => x !== c) : [...audience.cities, c] })}
              className={cn("h-8 rounded-full border px-3 text-[12.5px] transition-colors", on ? "border-adire bg-adire-wash text-adire" : "border-line text-ink-muted hover:border-line-strong")}
            >
              {c}
            </button>
          );
        })}
      </div>
    );
  const all = tenants.data?.items ?? [];
  const matches = q ? all.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()) && !audience.tenantIds.includes(t.id)).slice(0, 6) : [];
  const picked = audience.tenantIds.map((id) => all.find((t) => t.id === id) ?? chosen.find((t) => t.id === id)).filter(Boolean) as TenantRef[];
  return (
    <div>
      <div className="relative">
        <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <Input className="pl-9" placeholder="Add a hotel" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search hotels to add" />
      </div>
      {!!matches.length && (
        <ul className="mt-1 rounded-md border border-line bg-surface p-1 shadow-float">
          {matches.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2"
                onClick={() => {
                  setChosen((c) => [...c, t]);
                  onChange({ kind: "TENANTS", tenantIds: [...audience.tenantIds, t.id] });
                  setQ("");
                }}
              >
                {t.name} <span className="text-[12px] text-ink-muted">{t.city}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {picked.map((t) => (
          <li key={t.id} className="inline-flex items-center gap-1.5 rounded-full border border-adire/40 bg-adire-wash px-2.5 py-1 text-[12.5px] text-adire">
            {t.name}
            <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onChange({ kind: "TENANTS", tenantIds: audience.tenantIds.filter((x) => x !== t.id) })}>
              <X size={11} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { AnnouncementSeverity };

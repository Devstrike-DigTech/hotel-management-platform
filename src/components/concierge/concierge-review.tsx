"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowCounterClockwise, CallBell, Check, ClockCounterClockwise, EyeSlash, Pause, Prohibit, ShieldWarning, WarningDiamond } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { conciergeApi, qkc, useConciergeReviews, useConciergeTenants } from "@/lib/api/concierge";
import type { ReviewItem, TenantConciergeRow } from "@/lib/api/types-m8";
import { formatDate, formatDateTime, naira, relativeTime } from "@/lib/format";
import { planName } from "@/lib/catalog";
import { useCan } from "@/lib/session";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { Figure, FigureRow, Gate, Pager, ReasonDialog } from "@/components/ui/kit";

type Tab = "PENDING_REVIEW" | "REJECTED" | "HIDDEN" | "LIVE" | "HOTELS";

const CATEGORY: Record<string, string> = {
  WELLNESS: "Wellness and spa",
  DINING: "Dining",
  ROMANCE_AND_CELEBRATION: "Celebrations",
  GROOMING: "Grooming and beauty",
  TRANSPORT: "Transport",
  SECURITY: "Security",
  TOURS_AND_EXPERIENCES: "Tours and experiences",
  FAMILY: "Family and children",
  SHOPPING: "Shopping",
  PHOTOGRAPHY: "Photography",
  EVENTS: "Events",
  NIGHTLIFE_RESERVATIONS: "Table reservations",
  BUSINESS: "Business services",
  LAUNDRY_EXPRESS: "Express laundry",
  OTHER: "Something else",
};
/** What the screen matched, in plain words (API-M8 3.1). */
const RULE: Record<string, string> = { SEXUAL_SERVICES: "Sexual services", DRUGS: "Drugs", WEAPONS: "Weapons", GAMBLING: "Gambling", ILLEGAL: "Illegal activity" };
const PRICING: Record<string, string> = { FIXED: "", FROM: "from ", PER_HOUR: "an hour", PER_PERSON: "a person", FREE: "" };

const priceText = (r: ReviewItem) => (r.pricing === "FREE" ? "Free" : r.priceKobo == null ? "On quote" : r.pricing === "FROM" ? `From ${naira(r.priceKobo)}` : `${naira(r.priceKobo)}${PRICING[r.pricing] ? ` ${PRICING[r.pricing]}` : ""}`);

/** Marks the words that were caught, wherever they appear. */
export function Marked({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return <>{text}</>;
  const re = new RegExp(`(${clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*$/, "\\w*").replace(/\s+/g, "\\s+")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((p, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-xs bg-laterite-wash px-0.5 text-ink underline decoration-laterite decoration-wavy decoration-1 underline-offset-[3px]" data-testid="matched-term">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ConciergeReviewView() {
  return (
    <Gate perm="concierge.review">
      <Review />
    </Gate>
  );
}

function Review() {
  const [tab, setTab] = useState<Tab>("PENDING_REVIEW");
  const [page, setPage] = useState(1);
  const reviews = useConciergeReviews({ status: tab === "HOTELS" ? "PENDING_REVIEW" : tab, page, pageSize: 10 });
  const suspendedQ = useConciergeTenants({ suspended: true, pageSize: 1 });
  const counts = reviews.data?.counts;
  const TABS: { value: Tab; label: string; n?: number; blurb: string }[] = [
    { value: "PENDING_REVIEW", label: "Waiting", n: counts?.pending, blurb: "Held by the content screen and hidden from guests. Oldest first. Read what the hotel wrote, then approve, or reject with a reason the hotel will see." },
    { value: "REJECTED", label: "Rejected", n: counts?.rejected, blurb: "Not approved. The hotel sees the reason; an edit sends it back here." },
    { value: "HIDDEN", label: "Hidden", n: counts?.hidden, blurb: "Taken down after going live. Approve to put one back." },
    { value: "LIVE", label: "Live", blurb: "Every service guests can see now. Hide one if it breaks the policy after all." },
    { value: "HOTELS", label: "Hotels", blurb: "Concierge per hotel: policy accepted, services by state, requests in 30 days (counts only), and suspension." },
  ];
  const current = TABS.find((t) => t.value === tab)!;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <CallBell size={14} weight="duotone" /> Concierge review
          </>
        }
        title={
          <>
            Lawful services, <em>kept that way</em>
          </>
        }
        description="Hotels offer their own concierge services under the acceptable-use policy. Anything the screen catches waits here, hidden from guests, until someone on the team has read it."
        actions={
          <Link href="/audit?action=concierge." className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-[13px] text-ink hover:bg-surface-2">
            <ClockCounterClockwise size={15} /> Decisions in the audit log
          </Link>
        }
      />

      <FigureRow cols={4} className="mb-6">
        <Figure label="Waiting for review" value={counts?.pending ?? "–"} tone={counts?.pending ? "brass" : "ink"} sub="hidden from guests" />
        <Figure label="Rejected" value={counts?.rejected ?? "–"} sub="the hotel has the reason" />
        <Figure label="Hidden after going live" value={counts?.hidden ?? "–"} />
        <Figure label="Hotels suspended" value={suspendedQ.data?.total ?? "–"} tone={suspendedQ.data?.total ? "danger" : "ink"} sub="concierge switched off" />
      </FigureRow>

      <div className="mb-4 flex flex-col gap-2">
        <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Queue">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => {
                setTab(t.value);
                setPage(1);
              }}
              className={cn("relative h-10 shrink-0 px-3 text-[13.5px] font-medium", tab === t.value ? "text-ink" : "text-ink-muted hover:text-ink")}
              data-testid={`tab-${t.value}`}
            >
              {t.label}
              {t.n != null && <span className="ml-1.5 font-mono text-[11.5px] text-ink-muted">{t.n}</span>}
              {tab === t.value && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-brass" />}
            </button>
          ))}
        </div>
        <p className="max-w-3xl text-[12.5px] text-ink-muted">{current.blurb}</p>
      </div>

      {tab === "HOTELS" ? (
        <HotelsTable />
      ) : reviews.isError ? (
        <Panel>
          <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
        </Panel>
      ) : reviews.isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : !reviews.data?.items.length ? (
        <Panel>
          <EmptyState glyph="rings" title={tab === "PENDING_REVIEW" ? "Nothing waiting" : "Nothing here"} body={tab === "PENDING_REVIEW" ? "Every hotel service that was held has been looked at." : undefined} />
        </Panel>
      ) : (
        <>
          <ol className="flex flex-col gap-4" data-testid="review-queue">
            {reviews.data.items.map((r) => (
              <ReviewCase key={r.serviceId} r={r} />
            ))}
          </ol>
          <Panel className="mt-4">
            <Pager page={page} pageSize={10} total={reviews.data.total} onPage={setPage} noun="services" />
          </Panel>
        </>
      )}
    </>
  );
}

function ReviewCase({ r }: { r: ReviewItem }) {
  const qc = useQueryClient();
  const can = useCan();
  const [dialog, setDialog] = useState<"approve" | "reject" | "hide" | "suspend" | null>(null);
  const [note, setNote] = useState("");
  const terms = [...new Set([...r.flaggedTerms, ...r.matches.map((m) => m.term)])];
  const done = async (msg: string, body?: string) => {
    await qc.invalidateQueries({ queryKey: qkc.all });
    toast.success(msg, body);
  };
  const approve = useMutation({
    mutationFn: () => conciergeApi.approve(r.tenant.id, r.serviceId, note.trim() || undefined),
    onSuccess: async () => {
      setDialog(null);
      setNote("");
      await done("Approved", `${r.name} is live for ${r.tenant.name}'s guests.`);
    },
    meta: { errorTitle: "Not approved" },
  });
  const rules = [...new Set(r.matches.map((m) => m.category))];

  return (
    <li>
      <Panel as="article" className="overflow-hidden" data-testid="review-case" data-service={r.name}>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-5 py-3">
          <Link href={`/tenants/${r.tenant.id}`} className="text-[13.5px] font-medium text-ink hover:text-adire">
            {r.tenant.name}
          </Link>
          {r.property.name !== r.tenant.name && <span className="text-[12.5px] text-ink-muted">{r.property.name}</span>}
          <span className="text-[12px] text-ink-faint">{CATEGORY[r.category] ?? r.category}</span>
          {r.tenantSuspended && (
            <Badge tone="danger" icon={<Pause size={11} weight="fill" />}>
              Concierge suspended
            </Badge>
          )}
          <span className="ml-auto text-[11.5px] text-ink-faint" title={formatDateTime(r.submittedAt ?? r.updatedAt)}>
            {r.reviewStatus === "PENDING_REVIEW" ? "sent for review" : r.reviewStatus === "LIVE" ? "updated" : "decided"} {relativeTime(r.reviewedAt && r.reviewStatus !== "PENDING_REVIEW" ? r.reviewedAt : (r.submittedAt ?? r.updatedAt))}
          </span>
        </header>
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-3 px-5 py-4">
            <div className="flex items-baseline gap-3">
              <h3 className="display-sm min-w-0 flex-1 text-[21px] leading-snug text-ink" data-testid="review-name">
                <Marked text={r.name} terms={terms} />
              </h3>
              <span className="shrink-0 font-mono text-[14px] text-ink">{priceText(r)}</span>
            </div>
            {r.description && (
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">
                <Marked text={r.description} terms={terms} />
              </p>
            )}
            {r.variants.length > 0 && (
              <div>
                <p className="eyebrow mb-1">Options</p>
                <p className="text-[13px] text-ink">
                  {r.variants.map((v, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-ink-faint"> &middot; </span>}
                      <Marked text={v} terms={terms} />
                    </span>
                  ))}
                </p>
              </div>
            )}
            {r.questions.length > 0 && (
              <div>
                <p className="eyebrow mb-1">What guests are asked</p>
                <ul className="flex flex-col gap-0.5 text-[13px] text-ink">
                  {r.questions.map((q, i) => (
                    <li key={i}>
                      <Marked text={q} terms={terms} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.reason && (
              <p className="flex items-start gap-1.5 rounded-sm bg-surface-2 px-3 py-2 text-[12.5px] text-ink-muted">
                <EyeSlash size={13} className="mt-0.5 shrink-0" />
                <span>
                  {r.reviewStatus === "LIVE" ? "Note" : "Reason given"}: {r.reason}
                  {r.reviewedBy ? ` (${r.reviewedBy})` : ""}
                </span>
              </p>
            )}
          </div>
          <aside className="flex flex-col gap-3 border-t border-line bg-surface-2/40 px-5 py-4 md:border-l md:border-t-0" aria-label="Why it was held">
            <p className="eyebrow flex items-center gap-1.5">
              <ShieldWarning size={13} weight="duotone" /> Why it was held
            </p>
            {r.matches.length ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {rules.map((c) => (
                    <Badge key={c} tone="danger">
                      {RULE[c] ?? c}
                    </Badge>
                  ))}
                </div>
                <ul className="flex flex-col gap-2" data-testid="review-matches">
                  {r.matches.map((m, i) => (
                    <li key={i} className="text-[12.5px] leading-snug">
                      <span className="font-mono text-[12px] text-laterite">{m.term}</span>
                      <span className="block text-ink-muted">&hellip;<Marked text={m.excerpt} terms={[m.term]} />&hellip;</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : terms.length ? (
              <p className="text-[12.5px] text-ink-muted">
                Caught: <span className="font-mono text-laterite">{terms.join(", ")}</span>
              </p>
            ) : (
              <p className="text-[12.5px] text-ink-muted">Nothing was caught; this one was {r.reviewStatus === "LIVE" ? "clean when saved" : "sent by hand"}.</p>
            )}
            <p className="mt-auto text-[11.5px] leading-snug text-ink-faint">A word on the list isn&rsquo;t proof. A licensed security driver can trip it; so can a real problem. Read the whole service.</p>
          </aside>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          {r.reviewStatus !== "LIVE" && (
            <Button size="sm" onClick={() => setDialog("approve")} data-testid="approve-service">
              {r.reviewStatus === "HIDDEN" ? <ArrowCounterClockwise size={14} /> : <Check size={14} weight="bold" />} {r.reviewStatus === "HIDDEN" ? "Put back live" : "Approve"}
            </Button>
          )}
          {r.reviewStatus === "PENDING_REVIEW" && (
            <Button size="sm" variant="secondary" onClick={() => setDialog("reject")} data-testid="reject-service">
              <Prohibit size={14} /> Reject with a reason
            </Button>
          )}
          {r.reviewStatus === "LIVE" && (
            <Button size="sm" variant="secondary" onClick={() => setDialog("hide")} data-testid="hide-service">
              <EyeSlash size={14} /> Hide from guests
            </Button>
          )}
          {!r.tenantSuspended && can("concierge.review") && (
            <Button size="sm" variant="ghost" className="ml-auto text-laterite hover:bg-laterite-wash" onClick={() => setDialog("suspend")}>
              <Pause size={14} /> Suspend {r.tenant.name}&rsquo;s concierge
            </Button>
          )}
        </footer>
      </Panel>

      <Dialog
        open={dialog === "approve"}
        onOpenChange={(o) => !o && setDialog(null)}
        eyebrow={r.tenant.name}
        title={`Approve ${r.name}?`}
        description="It goes live for the hotel's guests straight away. The hotel sees that it was approved."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => approve.mutate()} loading={approve.isPending} data-testid="confirm-approve">
              <Check size={14} weight="bold" /> Approve
            </Button>
          </>
        }
      >
        <Field label="Note" htmlFor={`approve-${r.serviceId}`} optional hint="For the audit log.">
          <Textarea id={`approve-${r.serviceId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Licensed security firm; the wording is fine." className="min-h-16" />
        </Field>
      </Dialog>
      <ReasonDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        eyebrow={r.tenant.name}
        title={`Reject ${r.name}?`}
        description="It stays hidden from guests. The hotel sees your reason on the service and can edit it, which sends it back here."
        label="Reason for the hotel"
        placeholder="This reads as something the policy doesn't allow. If you meant a licensed security service, say so in plain words."
        confirmLabel="Reject"
        danger
        onConfirm={async (reason) => {
          await conciergeApi.reject(r.tenant.id, r.serviceId, reason);
          await done("Rejected", "The hotel sees your reason.");
        }}
      />
      <ReasonDialog
        open={dialog === "hide"}
        onOpenChange={(o) => !o && setDialog(null)}
        eyebrow={r.tenant.name}
        title={`Hide ${r.name}?`}
        description="It comes off the hotel's booking site and trip pages at once. Requests already made are kept."
        label="Reason for the hotel"
        confirmLabel="Hide from guests"
        danger
        onConfirm={async (reason) => {
          await conciergeApi.hide(r.tenant.id, r.serviceId, reason);
          await done("Hidden", "It no longer shows to guests.");
        }}
      />
      <SuspendDialog open={dialog === "suspend"} onOpenChange={(o) => !o && setDialog(null)} tenant={r.tenant} />
    </li>
  );
}

export function SuspendDialog({ open, onOpenChange, tenant }: { open: boolean; onOpenChange: (o: boolean) => void; tenant: { id: string; name: string } }) {
  const qc = useQueryClient();
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Concierge"
      title={`Suspend ${tenant.name}'s concierge?`}
      description={
        <>
          Their services disappear from guests and no new requests can be made, at once, on every property. Staff can still finish or cancel what&rsquo;s under way. The owners get an email with your reason. <span className="text-ink">This needs a fresh authenticator code.</span>
        </>
      }
      label="Reason (the hotel sees it)"
      placeholder="Services offered in breach of the acceptable-use policy after two rejections."
      confirmLabel="Suspend concierge"
      danger
      onConfirm={async (reason) => {
        await conciergeApi.suspend(tenant.id, reason);
        await qc.invalidateQueries({ queryKey: qkc.all });
        toast.success("Concierge suspended", `${tenant.name}'s guests no longer see any services.`);
      }}
    />
  );
}

function HotelsTable() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [only, setOnly] = useState<"all" | "suspended">("all");
  const list = useConciergeTenants({ q: q.trim() || undefined, suspended: only === "suspended" ? true : undefined, page, pageSize: 20 });
  const [suspending, setSuspending] = useState<TenantConciergeRow | null>(null);
  const [reinstating, setReinstating] = useState<TenantConciergeRow | null>(null);
  const qc = useQueryClient();
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <Input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="Find a hotel" aria-label="Find a hotel" className="w-full sm:w-64" />
        <div className="flex gap-1.5" role="radiogroup" aria-label="Show">
          {(["all", "suspended"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={only === v} onClick={() => (setOnly(v), setPage(1))} className={cn("h-8 rounded-full border px-3 text-[12.5px] font-medium", only === v ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
              {v === "all" ? "All" : "Suspended"}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-muted sm:ml-auto">Counts only. The console never sees what guests asked for.</p>
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="m-5 h-40" />
      ) : !list.data.items.length ? (
        <EmptyState glyph="rings" title="No hotels here" body="Hotels appear once they accept the policy or add a service." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]" data-testid="concierge-hotels">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                <th className="px-5 py-2.5 font-medium">Hotel</th>
                <th className="px-3 py-2.5 font-medium">Policy</th>
                <th className="px-3 py-2.5 font-medium">Services</th>
                <th className="px-3 py-2.5 text-right font-medium">Requests, 30 d</th>
                <th className="px-3 py-2.5 text-right font-medium">Held</th>
                <th className="px-3 py-2.5 font-medium">Concierge</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((t) => (
                <tr key={t.tenant.id} data-tenant={t.tenant.name} className="align-top">
                  <td className="px-5 py-3">
                    <Link href={`/tenants/${t.tenant.id}`} className="font-medium text-ink hover:text-adire">
                      {t.tenant.name}
                    </Link>
                    <div className="mt-1">{t.tenant.planCode && <PlanPlate name={planName(t.tenant.planCode)} code={t.tenant.planCode} />}</div>
                  </td>
                  <td className="px-3 py-3 text-ink-muted">{t.aupAcceptedAt ? <><span className="text-ink">Accepted</span> <span className="font-mono text-[11.5px]">{formatDate(t.aupAcceptedAt)}</span></> : "Not yet"}</td>
                  <td className="px-3 py-3">
                    <span className="flex flex-wrap gap-x-3 font-mono text-[12px]">
                      <span title="Live" className="text-palm">{t.services.live} live</span>
                      {t.services.pending > 0 && <span className="text-brass-text">{t.services.pending} waiting</span>}
                      {t.services.rejected > 0 && <span className="text-laterite">{t.services.rejected} rejected</span>}
                      {t.services.hidden > 0 && <span className="text-ink-muted">{t.services.hidden} hidden</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{t.requests30d}</td>
                  <td className={cn("px-3 py-3 text-right font-mono", t.flaggedRequests30d ? "text-brass-text" : "text-ink-muted")}>{t.flaggedRequests30d}</td>
                  <td className="px-3 py-3">
                    {t.suspended ? (
                      <div className="flex max-w-[240px] flex-col gap-1">
                        <Badge tone="danger" icon={<WarningDiamond size={11} weight="fill" />}>
                          Suspended {formatDate(t.suspended.since)}
                        </Badge>
                        <span className="text-[11.5px] leading-snug text-ink-muted">
                          &ldquo;{t.suspended.reason}&rdquo; &middot; {t.suspended.by}
                        </span>
                      </div>
                    ) : t.enabledProperties ? (
                      <Badge tone="palm" dot>
                        On at {t.enabledProperties} {t.enabledProperties === 1 ? "property" : "properties"}
                      </Badge>
                    ) : (
                      <Badge>Off</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {t.suspended ? (
                      <Button size="sm" variant="secondary" onClick={() => setReinstating(t)} data-testid="reinstate-concierge">
                        <ArrowCounterClockwise size={14} /> Reinstate
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-laterite hover:bg-laterite-wash" onClick={() => setSuspending(t)} data-testid="suspend-concierge">
                        <Pause size={14} /> Suspend
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pager page={page} pageSize={20} total={list.data.total} onPage={setPage} noun="hotels" />}
      {suspending && <SuspendDialog open onOpenChange={(o) => !o && setSuspending(null)} tenant={suspending.tenant} />}
      {reinstating && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setReinstating(null)}
          eyebrow="Concierge"
          title={`Reinstate ${reinstating.tenant.name}'s concierge?`}
          description="Their live services show to guests again and new requests can be made. Services that were rejected or hidden stay that way."
          label="Note"
          min={3}
          confirmLabel="Reinstate"
          onConfirm={async (note) => {
            await conciergeApi.reinstate(reinstating.tenant.id, note);
            await qc.invalidateQueries({ queryKey: qkc.all });
            toast.success("Concierge reinstated", reinstating.tenant.name);
          }}
        />
      )}
    </Panel>
  );
}

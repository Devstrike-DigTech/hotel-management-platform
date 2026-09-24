"use client";

import Link from "next/link";
import { useState } from "react";
import { CaretLeft, CaretRight, LockKey } from "@phosphor-icons/react";
import type { Permission } from "@/lib/catalog";
import { useCan } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { clock, duration } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Dialog } from "./overlay";
import { Field, Input, Textarea } from "./form";
import { EmptyState, Panel, Skeleton } from "./primitives";

/* ---------- permission gate for a whole page ---------- */
export function Gate({ perm, children }: { perm: Permission | Permission[]; children: React.ReactNode }) {
  const can = useCan();
  if (!can(perm))
    return (
      <Panel>
        <EmptyState
          glyph="cross"
          title="Not part of your role"
          body={
            <>
              This section needs{" "}
              <span className="font-mono text-[12.5px] text-ink">{Array.isArray(perm) ? perm.join(" or ") : perm}</span>. A super admin can change your
              role in Console users.
            </>
          }
          action={
            <Link href="/" className="text-[13px] text-adire underline-offset-4 hover:underline">
              Back to the overview
            </Link>
          }
        />
      </Panel>
    );
  return <>{children}</>;
}

/** A button that is shown disabled, with the reason, when the person lacks the permission. */
export function PermButton({ perm, children, ...rest }: { perm: Permission | Permission[] } & React.ComponentProps<typeof Button>) {
  const can = useCan();
  const ok = can(perm);
  return (
    <Button {...rest} disabled={!ok || rest.disabled} title={ok ? rest.title : `Needs ${Array.isArray(perm) ? perm.join(" or ") : perm}`}>
      {!ok && <LockKey size={14} />}
      {children}
    </Button>
  );
}

/* ---------- figure tile (headline numbers) ---------- */
export function Figure({
  label,
  value,
  sub,
  tone = "ink",
  loading,
  className,
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ink" | "adire" | "brass" | "danger" | "palm" | "ochre";
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const color = { ink: "text-ink", adire: "text-adire", brass: "text-brass-text", danger: "text-laterite", palm: "text-palm", ochre: "text-ochre" }[tone];
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 px-5 py-5", className)}>
      <span className="eyebrow text-[10px]">{label}</span>
      {loading ? <Skeleton className="h-9 w-28" /> : <span className={cn("figure text-[30px] leading-none md:text-[34px]", color)}>{value}</span>}
      {sub && <span className="truncate text-[12.5px] text-ink-muted">{sub}</span>}
      {children}
    </div>
  );
}

/** A row of figures separated by hairlines, 2-up on phones. */
export function FigureRow({ children, cols = 4, className }: { children: React.ReactNode; cols?: 3 | 4 | 5; className?: string }) {
  return (
    <Panel
      className={cn(
        "grid grid-cols-2 [&>*]:border-line max-md:[&>*:nth-child(odd)]:border-r max-md:[&>*:not(:nth-last-child(-n+2))]:border-b",
        cols === 3 ? "md:grid-cols-3" : cols === 5 ? "md:grid-cols-5" : "md:grid-cols-4",
        "md:[&>*:not(:first-child)]:border-l",
        className,
      )}
    >
      {children}
    </Panel>
  );
}

/* ---------- pager ---------- */
export function Pager({ page, pageSize, total, onPage, noun = "items" }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
      <span className="font-mono text-[12px] text-ink-muted">
        {total.toLocaleString("en-NG")} {noun}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            <CaretLeft size={14} />
          </Button>
          <span className="font-mono text-[12px] text-ink-muted">
            {page} / {pages}
          </span>
          <Button variant="secondary" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
            <CaretRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------- key / value list ---------- */
export function KV({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-[13px]", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- a dialog that asks for a written reason ---------- */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  placeholder,
  confirmLabel,
  danger,
  min = 5,
  max = 500,
  onConfirm,
  children,
  eyebrow,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  danger?: boolean;
  min?: number;
  max?: number;
  onConfirm: (reason: string) => Promise<unknown>;
  children?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = reason.trim().length >= min && reason.trim().length <= max;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
      title={title}
      description={description}
      eyebrow={eyebrow}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={!ok}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                setReason("");
                onOpenChange(false);
              } catch {
                /* toast from the mutation cache */
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      <Field label={label} htmlFor="reason" hint={`${reason.trim().length} of ${min} to ${max} characters. Recorded in the audit log.`}>
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} maxLength={max} autoFocus />
      </Field>
    </Dialog>
  );
}

/* ---------- typed confirmation ---------- */
export function TypedConfirm({ expected, value, onChange, id = "typed-confirm" }: { expected: string; value: string; onChange: (v: string) => void; id?: string }) {
  const match = value === expected;
  return (
    <Field
      label={
        <>
          Type <span className="rounded-xs bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-ink">{expected}</span> to confirm
        </>
      }
      htmlFor={id}
      hint={value && !match ? "Not a match yet. It is case-sensitive." : undefined}
    >
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={cn("font-mono", match && "border-laterite focus:border-laterite")}
        onPaste={(e) => e.preventDefault()}
      />
    </Field>
  );
}

/* ---------- SLA clock ---------- */
export function SlaClock({ dueAt, respondedAt, sla, compact }: { dueAt: string; respondedAt: string | null; sla: string; compact?: boolean }) {
  const now = useNow(15_000);
  const due = new Date(dueAt).getTime();
  if (respondedAt) {
    const met = sla === "MET";
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11.5px]", met ? "text-palm" : "text-laterite")} title={`First response ${met ? "within" : "after"} SLA`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {met ? "SLA met" : "SLA missed"}
      </span>
    );
  }
  const left = due - now;
  const breached = left < 0;
  const soon = !breached && sla === "DUE_SOON";
  const text = breached ? `${duration(-left)} over` : left < 3600e3 ? `${clock(left)} left` : `${duration(left)} left`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 font-mono",
        compact ? "h-[20px] text-[10.5px]" : "h-[22px] text-[11.5px]",
        breached
          ? "border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] bg-laterite-wash text-laterite"
          : soon
            ? "border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash text-ochre"
            : "border-line bg-surface-2 text-ink-muted",
      )}
      title={`First response due ${new Date(dueAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}`}
    >
      {(breached || soon) && <span className="live-dot" style={{ width: 5, height: 5 }} aria-hidden />}
      {text}
    </span>
  );
}

/* ---------- toolbar ---------- */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}

/** Monospace short id with a title showing the whole value. */
export function ShortId({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-ink-faint">-</span>;
  return (
    <span className={cn("font-mono text-[11.5px] text-ink-muted", className)} title={value}>
      {value.length > 12 ? `${value.slice(0, 8)}...` : value}
    </span>
  );
}

"use client";

import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Buildings, Megaphone, Plus, UserSwitch } from "@phosphor-icons/react";
import { api } from "@/lib/api/client";
import type { Paginated, TenantRow } from "@/lib/api/types";
import { ACCOUNT_ITEM, NAV } from "@/lib/nav";
import { planName, SUB_STATUS } from "@/lib/catalog";
import { paletteStore, useStore } from "@/lib/store";
import { useCan } from "@/lib/session";
import { PlanPlate } from "@/components/ui/primitives";

const itemCls =
  "flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-[13.5px] text-ink outline-none data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink";

export function CommandPalette() {
  const open = useStore(paletteStore);
  const router = useRouter();
  const can = useCan();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        paletteStore.set((o) => !o);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable)) {
        e.preventDefault();
        paletteStore.set(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(id);
  }, [q]);

  const tenants = useQuery({
    queryKey: ["platform", "palette-tenants", debounced],
    queryFn: () => api<Paginated<TenantRow>>("platform/tenants", { query: { q: debounced, pageSize: 6 } }),
    enabled: open && debounced.length >= 2 && can("tenants.view"),
    staleTime: 30_000,
  });

  const go = (href: string) => {
    paletteStore.set(false);
    setQ("");
    router.push(href);
  };

  const actions = [
    { label: "New enterprise tenant", href: "/tenants/new", icon: Plus, perm: "tenants.manage" as const },
    { label: "Write an announcement", href: "/announcements/new", icon: Megaphone, perm: "announcements.manage" as const },
    { label: "Start an impersonation session", href: "/impersonation?new=1", icon: UserSwitch, perm: "impersonate" as const },
  ].filter((a) => can(a.perm));

  return (
    <D.Root open={open} onOpenChange={(o) => paletteStore.set(o)}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-[rgb(8_11_17/0.45)] data-[state=open]:animate-[fade_140ms_ease-out]" />
        <D.Content className="fixed left-1/2 top-[12vh] z-[61] w-[calc(100vw-24px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-float outline-none data-[state=open]:animate-[rise_180ms_cubic-bezier(0.22,1,0.36,1)]">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search hotels, pages and actions</D.Description>
          <Command label="Console command palette" shouldFilter loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <span className="font-mono text-[11px] text-brass-text">&gt;</span>
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="Find a hotel, a page or an action"
                className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
              />
              <span className="kbd">Esc</span>
            </div>
            <Command.List className="scrollbar-thin max-h-[min(60vh,440px)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-ink-muted">Nothing matches &ldquo;{q}&rdquo;.</Command.Empty>
              {!!tenants.data?.items.length && (
                <Command.Group heading="Hotels" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px]">
                  {tenants.data.items.map((t) => (
                    <Command.Item key={t.id} value={`hotel ${t.name} ${t.slug} ${t.city ?? ""}`} onSelect={() => go(`/tenants/${t.id}`)} className={itemCls}>
                      <Buildings size={17} className="text-ink-muted" />
                      <span className="min-w-0 flex-1 truncate">
                        {t.name} <span className="font-mono text-[11.5px] text-ink-faint">{t.slug}</span>
                      </span>
                      <span className="hidden text-[12px] text-ink-muted sm:inline">{SUB_STATUS[t.status]?.label}</span>
                      <PlanPlate name={planName(t.planCode)} code={t.planCode} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!actions.length && (
                <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px]">
                  {actions.map((a) => (
                    <Command.Item key={a.href} value={`action ${a.label}`} onSelect={() => go(a.href)} className={itemCls}>
                      <a.icon size={17} className="text-adire" />
                      <span className="flex-1">{a.label}</span>
                      <ArrowRight size={14} className="text-ink-faint" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {NAV.map((g) => {
                const items = g.items.filter((i) => can(i.perm));
                if (!items.length) return null;
                return (
                  <Command.Group key={g.label} heading={g.label} className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px]">
                    {items.map((n) => (
                      <Command.Item key={n.href} value={`${n.label} ${n.keywords ?? ""}`} onSelect={() => go(n.href)} className={itemCls}>
                        <n.icon size={17} className="text-ink-muted" />
                        {n.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
              <Command.Group heading="You" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px]">
                <Command.Item value={`${ACCOUNT_ITEM.label} ${ACCOUNT_ITEM.keywords}`} onSelect={() => go(ACCOUNT_ITEM.href)} className={itemCls}>
                  <ACCOUNT_ITEM.icon size={17} className="text-ink-muted" />
                  {ACCOUNT_ITEM.label}
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

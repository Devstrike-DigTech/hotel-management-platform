"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { List, MagnifyingGlass, SignOut, X } from "@phosphor-icons/react";
import { authApi, endLocalSession } from "@/lib/api/endpoints";
import { onSessionExpired } from "@/lib/api/client";
import { useCan, useMe } from "@/lib/session";
import { ACCOUNT_ITEM, NAV, isActive } from "@/lib/nav";
import { PLATFORM_ROLES } from "@/lib/catalog";
import { initials } from "@/lib/format";
import { paletteStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Wordmark, ConsoleMark } from "@/components/brand";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { useBadgeCounts } from "./badge-counts";
import { StepUpChip } from "@/components/security/step-up";
import { EnvChip } from "./env-chip";

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (me.isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.isError, router, pathname]);
  useEffect(
    () =>
      onSessionExpired(() => {
        qc.clear();
        router.replace(`/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`);
      }),
    [router, qc],
  );

  if (!me.data)
    return (
      <div className="grid min-h-dvh place-items-center bg-night">
        <ConsoleMark size={44} className="animate-[breathe_1.6s_ease-in-out_infinite]" />
      </div>
    );

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch {
      /* the local cookies are dropped regardless */
    }
    await endLocalSession();
    qc.clear();
    router.replace("/login?signedOut=1");
  };

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 lg:block dark:border-r dark:border-night-line">
        <Sidebar onSignOut={signOut} />
      </aside>

      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-[rgb(8_11_17/0.55)] data-[state=open]:animate-[fade_160ms_ease-out] lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] outline-none data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(0.22,1,0.36,1)] lg:hidden">
            <D.Title className="sr-only">Console navigation</D.Title>
            <D.Description className="sr-only">Every section of the console</D.Description>
            <Sidebar onSignOut={signOut} onClose={() => setDrawer(false)} onNavigate={() => setDrawer(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] px-3 backdrop-blur-md sm:gap-3 sm:px-6 lg:px-8">
          <button
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <List size={20} />
          </button>
          <Link href="/" className="lg:hidden" aria-label="Console home">
            <ConsoleMark size={26} />
          </Link>
          <button
            onClick={() => paletteStore.set(true)}
            className="group ml-1 flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-line bg-surface px-3 text-left text-[13px] text-ink-faint transition-colors hover:border-line-strong sm:max-w-[420px] lg:ml-0"
            data-testid="palette-trigger"
          >
            <MagnifyingGlass size={15} className="shrink-0 text-ink-muted" />
            <span className="truncate">
              <span className="sm:hidden">Search</span>
              <span className="hidden sm:inline">Find a hotel, a page or an action</span>
            </span>
            <span className="kbd ml-auto hidden sm:inline">Ctrl K</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <StepUpChip />
            <EnvChip />
            <ThemeToggle compact className="hidden sm:inline-flex" />
          </div>
        </header>
        <main className="flex-1 px-4 pb-20 pt-6 sm:px-6 md:pt-8 lg:px-8 xl:px-10">
          <div key={pathname} className="mx-auto w-full max-w-[1280px] animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)]">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

function Sidebar({ onSignOut, onClose, onNavigate }: { onSignOut: () => void; onClose?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useMe().data!;
  const can = useCan();
  const counts = useBadgeCounts();

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-night text-night-ink">
      <SidebarCloth />
      <div className="relative flex h-16 items-center justify-between px-5">
        <Link href="/" aria-label="Console overview">
          <Wordmark tone="night" size="sm" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-night-muted hover:bg-white/5 hover:text-night-ink" aria-label="Close navigation">
            <X size={16} />
          </button>
        )}
      </div>
      <nav aria-label="Console" className="scrollbar-night relative flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {NAV.map((g) => {
          const items = g.items.filter((i) => can(i.perm));
          if (!items.length) return null;
          return (
            <div key={g.label} className="mb-4">
              <p className="mb-1.5 px-3 font-mono text-[9.5px] uppercase tracking-[0.2em] text-night-muted/80">{g.label}</p>
              <ul className="flex flex-col gap-px">
                {items.map((n) => {
                  const I = n.icon;
                  const on = isActive(pathname, n.href);
                  const count = n.badge ? (counts[n.badge] ?? 0) : 0;
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        onClick={onNavigate}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] transition-colors duration-150",
                          on ? "bg-night-2 text-night-ink" : "text-night-muted hover:bg-white/[0.035] hover:text-night-ink",
                        )}
                      >
                        {on && <span aria-hidden className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-xs bg-night-brass" />}
                        <I size={18} weight={on ? "duotone" : "regular"} className={on ? "text-night-brass" : "text-night-muted group-hover:text-night-ink"} />
                        <span className="truncate">{n.label}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              "ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 font-mono text-[10.5px] font-medium",
                              n.badge === "failedJobs" || n.badge === "orphaned" ? "bg-[#e0714b] text-[#1b0d08]" : "bg-night-brass text-night",
                            )}
                            aria-label={`${count} waiting`}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="relative border-t border-night-line p-3">
        <Link
          href={ACCOUNT_ITEM.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/[0.04]",
            isActive(pathname, ACCOUNT_ITEM.href) && "bg-night-2",
          )}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-night-brass/40 bg-night-2 font-mono text-[11.5px] text-night-brass">
            {initials(me.fullName || me.email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-night-ink">{me.fullName || me.email}</span>
            <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-night-adire">{PLATFORM_ROLES[me.role]?.label ?? me.role}</span>
          </span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <ThemeToggle compact className="border-night-line bg-night-2 sm:hidden [&_button]:text-night-muted [&_button[aria-checked=true]]:bg-night [&_button[aria-checked=true]]:text-night-ink" />
          <button
            onClick={onSignOut}
            className="flex h-8 flex-1 items-center gap-2 rounded-md px-2.5 text-[12.5px] text-night-muted transition-colors hover:bg-white/5 hover:text-night-ink"
          >
            <SignOut size={15} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** A faint field of adire rings at the foot of the sidebar: cloth, not clip-art. */
function SidebarCloth() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] w-full text-night-adire opacity-[0.07]" viewBox="0 0 248 260" preserveAspectRatio="xMidYMax slice" fill="none" stroke="currentColor" strokeWidth="1">
      {Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) => {
          const x = i * 48 + 24;
          const y = j * 48 + 24;
          const k = (i + j) % 3;
          return (
            <g key={`${i}-${j}`}>
              {k === 0 && (
                <>
                  <circle cx={x} cy={y} r="17" />
                  <circle cx={x} cy={y} r="10" />
                  <circle cx={x} cy={y} r="3" />
                </>
              )}
              {k === 1 && <path d={`M${x - 20} ${y + 6} l10 -10 l10 10 l10 -10 l10 10`} />}
              {k === 2 && (
                <>
                  <rect x={x - 16} y={y - 16} width="32" height="32" />
                  <path d={`M${x - 16} ${y - 16} L${x + 16} ${y + 16} M${x + 16} ${y - 16} L${x - 16} ${y + 16}`} />
                </>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}

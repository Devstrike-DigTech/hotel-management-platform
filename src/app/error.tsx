"use client";

import { ArrowClockwise, WarningOctagon } from "@phosphor-icons/react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative z-[1] flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full border border-[color-mix(in_oklab,var(--laterite)_30%,transparent)] bg-laterite-wash text-laterite">
        <WarningOctagon size={24} weight="duotone" />
      </span>
      <h1 className="display-sm mt-5 text-[24px] text-ink">This page stopped working</h1>
      <p className="mt-2 max-w-md text-[14px] text-ink-muted">{error.message || "Something unexpected happened."}</p>
      {error.digest && <p className="mt-1 font-mono text-[11.5px] text-ink-faint">ref {error.digest}</p>}
      <button onClick={reset} className="mt-6 inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-[13.5px] text-ink hover:bg-surface-2">
        <ArrowClockwise size={14} weight="bold" /> Try again
      </button>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Hourglass } from "@phosphor-icons/react";
import { isApiError } from "@/lib/api/client";

/** The API accepts each code once: a code already used is not a mistake, just a wait for the next one. */
export function codeAlreadyUsed(e: unknown): number | null {
  if (!isApiError(e) || e.code !== "MFA_CODE_ALREADY_USED") return null;
  const s = Number(e.details?.secondsLeft);
  return Number.isFinite(s) && s > 0 ? s : 30 - (Math.floor(Date.now() / 1000) % 30);
}

export function CodeUsedNotice({ secondsLeft, onReady, className = "" }: { secondsLeft: number; onReady?: () => void; className?: string }) {
  const [until] = useState(() => Date.now() + secondsLeft * 1000);
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(id);
        onReady?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [until, onReady]);
  return (
    <p role="status" className={`flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--adire)_25%,transparent)] bg-adire-wash px-3 py-2.5 text-[13px] text-adire ${className}`} data-testid="code-used">
      <Hourglass size={16} weight="duotone" className="mt-px shrink-0" />
      <span>
        That code has just been used. {left > 0 ? (
          <>
            Your app shows a new one in <span className="font-mono">{left}s</span>; enter that.
          </>
        ) : (
          "Enter the new code your app shows now."
        )}
      </span>
    </p>
  );
}

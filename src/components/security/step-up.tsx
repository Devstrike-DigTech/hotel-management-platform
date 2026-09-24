"use client";

import * as D from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Key, ShieldCheck, X } from "@phosphor-icons/react";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, registerStepUpHandler, type StepUpRequest } from "@/lib/api/client";
import { createStore, useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { OtpInput } from "./otp-input";
import { CodeUsedNotice, codeAlreadyUsed } from "./code-used";

/** When the current step-up lapses (ms since epoch), as the API reported it. */
export const stepUpStore = createStore<number | null>(null);
export const markSteppedUp = (expiresAt?: string | null) =>
  stepUpStore.set(expiresAt ? new Date(expiresAt).getTime() : Date.now() + 10 * 60_000);

/**
 * Mounted once. Any API call that answers STEP_UP_REQUIRED pauses, this dialog
 * asks for a fresh code, and the call is retried once it is verified. Pages
 * never have to know which actions are sensitive; the API decides.
 */
export function StepUpHost() {
  const [req, setReq] = useState<StepUpRequest | null>(null);
  useEffect(() => {
    registerStepUpHandler((r) => setReq(r));
    return () => registerStepUpHandler(null);
  }, []);
  if (!req) return null;
  return (
    <StepUpDialog
      reason={req.reason}
      onDone={(ok) => {
        req.resolve(ok);
        setReq(null);
      }}
    />
  );
}

function StepUpDialog({ reason, onDone }: { reason: string; onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState<{ n: number; s: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (value = code) => {
    const v = value.trim();
    if (recovery ? v.length < 8 : v.length !== 6) return;
    setBusy(true);
    setError(null);
    setUsed(null);
    try {
      const res = await authApi.stepUp(recovery ? { recoveryCode: v } : { code: v });
      markSteppedUp(res?.stepUpUntil ?? null);
      onDone(true);
    } catch (e) {
      const wait = codeAlreadyUsed(e);
      if (wait !== null) setUsed((u) => ({ n: (u?.n ?? 0) + 1, s: wait }));
      else setError(errorMessage(e));
      setCode("");
      setBusy(false);
    }
  };

  return (
    <D.Root open onOpenChange={(o) => !o && onDone(false)}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[80] bg-[rgb(8_11_17/0.55)] backdrop-blur-[1.5px] data-[state=open]:animate-[fade_160ms_ease-out]" />
        <D.Content
          data-testid="step-up-dialog"
          className="fixed left-1/2 top-1/2 z-[81] w-[calc(100vw-24px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-float outline-none data-[state=open]:animate-[dialog-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          <div className="relative bg-night px-6 pb-5 pt-5 text-night-ink">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-md border border-night-line bg-night-2 text-night-brass">
                <ShieldCheck size={22} weight="duotone" />
              </span>
              <D.Close className="grid h-7 w-7 place-items-center rounded-sm text-night-muted hover:bg-white/5 hover:text-night-ink" aria-label="Cancel">
                <X size={15} />
              </D.Close>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-night-brass">Step-up verification</p>
            <D.Title className="display-sm mt-1 text-[22px] leading-tight text-night-ink">Confirm it&rsquo;s you</D.Title>
            <D.Description className="mt-1.5 text-[13px] leading-relaxed text-night-muted">
              {reason && !/^step.?up/i.test(reason) ? reason.replace(/[.\s]*$/, ".") : "This action is sensitive."} One code keeps you verified for ten minutes.
            </D.Description>
          </div>
          <form
            className="px-6 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {recovery ? (
              <Input
                autoFocus
                aria-label="Recovery code"
                className="font-mono tracking-[0.08em]"
                placeholder="xxxx-xxxx"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={!!error || undefined}
              />
            ) : (
              <OtpInput idPrefix="stepup" value={code} onChange={setCode} onComplete={(v) => void submit(v)} invalid={!!error} disabled={busy} autoFocus />
            )}
            {used && <CodeUsedNotice key={used.n} secondsLeft={used.s} className="mt-3" />}
            {error && (
              <p role="alert" className="mt-3 text-[12.5px] text-laterite">
                {error}
              </p>
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setRecovery((r) => !r);
                  setCode("");
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                <Key size={13} /> {recovery ? "Use the authenticator app" : "Use a recovery code"}
              </button>
              <Button type="submit" loading={busy} disabled={recovery ? code.trim().length < 8 : code.length !== 6}>
                Verify
              </Button>
            </div>
          </form>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** A quiet chip in the top bar while a step-up is still valid, with its countdown. */
export function StepUpChip() {
  const until = useStore(stepUpStore);
  const now = useNow(1000);
  if (!until || until <= now) return null;
  const s = Math.floor((until - now) / 1000);
  return (
    <span
      className="hidden h-7 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--palm)_30%,transparent)] bg-palm-wash px-2.5 text-[11.5px] text-palm sm:inline-flex"
      title="Sensitive actions will not ask for a code until this runs out"
    >
      <ShieldCheck size={13} weight="duotone" />
      Verified
      <span className="font-mono">
        {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
      </span>
    </span>
  );
}

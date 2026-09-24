"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Copy, DeviceMobile, Key, ShieldCheck, WarningOctagon } from "@phosphor-icons/react";
import { authApi } from "@/lib/api/endpoints";
import type { MfaChallenge } from "@/lib/api/types-m6";
import { errorMessage, isApiError } from "@/lib/api/client";
import { meKey } from "@/lib/session";
import { totp, totpSecondsLeft } from "@/lib/totp";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/form";
import { OtpInput } from "@/components/security/otp-input";
import { QrCode, groupSecret, parseOtpauth } from "@/components/security/qr";
import { RecoveryCodesSheet } from "@/components/security/recovery-codes";
import { markSteppedUp } from "@/components/security/step-up";

const isDev = process.env.NODE_ENV !== "production";
const DEV_EMAIL = process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL || "admin@devstrike.ng";
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD || "Admin1234!";
const DEV_TOTP = process.env.NEXT_PUBLIC_DEV_TOTP_SECRET || "";

type Step =
  | { kind: "password" }
  | { kind: "verify"; mfaToken: string; recovery?: boolean }
  | { kind: "enrol"; mfaToken: string; otpauthUri: string; secret: string }
  | { kind: "codes"; codes: string[] };

export function SignIn({ start }: { start?: { challenge: MfaChallenge; email: string } } = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = safeNext(params.get("next"));
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState(start?.email ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Go straight in.
  useEffect(() => {
    if (start) return;
    let live = true;
    authApi
      .me()
      .then((me) => {
        if (!live) return;
        qc.setQueryData(meKey, me);
        router.replace(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [qc, router, next, start]);

  const enter = async () => {
    const me = await authApi.me();
    qc.setQueryData(meKey, me);
    markSteppedUp(); // a fresh sign-in counts as a step-up on the API side
    router.replace(next);
  };

  const afterPassword = async (res: MfaChallenge) => {
    if (res.status === "MFA_ENROLMENT_REQUIRED") {
      const e = await authApi.enrolStart(res.mfaToken);
      setStep({ kind: "enrol", mfaToken: res.mfaToken, otpauthUri: e.otpauthUri, secret: e.secret });
      return;
    }
    setStep({ kind: "verify", mfaToken: res.mfaToken });
  };

  // Coming from an accepted invitation: straight to pairing the authenticator.
  const startedFrom = useRef<MfaChallenge | null>(null);
  useEffect(() => {
    if (!start || startedFrom.current === start.challenge) return;
    startedFrom.current = start.challenge;
    authApi
      .enrolStart(start.challenge.mfaToken)
      .then((e) => setStep({ kind: "enrol", mfaToken: start.challenge.mfaToken, otpauthUri: e.otpauthUri, secret: e.secret }))
      .catch((e) => setError(signInError(e)));
  }, [start]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    setError(null);
    try {
      await afterPassword(await authApi.login(email.trim(), password));
    } catch (err) {
      setError(signInError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (value = code) => {
    if (step.kind !== "verify" && step.kind !== "enrol") return;
    const v = value.trim();
    if (step.kind === "verify" && step.recovery ? v.length < 8 : v.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      if (step.kind === "enrol") {
        const res = await authApi.enrolVerify(step.mfaToken, v);
        setCode("");
        if (res.recoveryCodes?.length) setStep({ kind: "codes", codes: res.recoveryCodes });
        else await enter();
      } else {
        await authApi.verify(step.mfaToken, step.recovery ? { recoveryCode: v } : { code: v });
        await enter();
      }
    } catch (err) {
      setError(signInError(err));
      setCode("");
      if (isApiError(err) && err.code === "MFA_TOKEN_INVALID") setStep({ kind: "password" });
    } finally {
      setBusy(false);
    }
  };

  const devFill = async () => {
    if (step.kind === "password") {
      setEmail(DEV_EMAIL);
      setPassword(DEV_PASSWORD);
    } else if (DEV_TOTP || step.kind === "enrol") {
      const secret = step.kind === "enrol" ? step.secret : DEV_TOTP;
      const c = await totp(secret);
      setCode(c);
      void submitCode(c);
    }
  };

  return (
    <div>
      {step.kind === "password" && (
        <>
          <Heading eyebrow="Platform console" title={<>Sign <em>in</em></>} body={<Notice params={params} />} />
          <form onSubmit={submitPassword} className="mt-8 flex flex-col gap-4" noValidate>
            <Field label="Work email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@devstrike.ng" autoFocus />
            </Field>
            <Field label="Password" htmlFor="password">
              <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorLine error={error} />
            <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
              Continue <ArrowRight size={16} weight="bold" />
            </Button>
          </form>
        </>
      )}

      {step.kind === "verify" && (
        <>
          <Back onClick={() => (setStep({ kind: "password" }), setCode(""), setError(null))} />
          <Heading
            eyebrow="Second factor"
            icon={step.recovery ? <Key size={14} weight="duotone" /> : <DeviceMobile size={14} weight="duotone" />}
            title={step.recovery ? <>Use a <em>recovery code</em></> : <>Your <em>code</em></>}
            body={step.recovery ? "Each recovery code works once. Enter one of the ten you saved when you set up the console." : "Open your authenticator app and enter the six digits it shows for the console."}
          />
          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
          >
            {step.recovery ? (
              <Input autoFocus aria-label="Recovery code" className="h-12 font-mono text-[17px] tracking-[0.08em]" placeholder="xxxx-xxxx" value={code} onChange={(e) => setCode(e.target.value)} />
            ) : (
              <OtpInput value={code} onChange={setCode} onComplete={(v) => void submitCode(v)} invalid={!!error} disabled={busy} autoFocus />
            )}
            {!step.recovery && <WindowClock />}
            <ErrorLine error={error} className="mt-4" />
            <Button type="submit" size="lg" loading={busy} className="mt-6 w-full" disabled={step.recovery ? code.trim().length < 8 : code.length !== 6}>
              Verify and enter
            </Button>
          </form>
          <button
            onClick={() => (setStep({ ...step, recovery: !step.recovery }), setCode(""), setError(null))}
            className="mt-4 text-[13px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {step.recovery ? "Use the authenticator app instead" : "Lost your phone? Use a recovery code"}
          </button>
        </>
      )}

      {step.kind === "enrol" && <Enrol step={step} code={code} setCode={setCode} busy={busy} error={error} submit={submitCode} email={email} />}

      {step.kind === "codes" && (
        <>
          <Heading
            eyebrow="Two-factor is on"
            icon={<ShieldCheck size={14} weight="duotone" />}
            title={<>Keep these <em>somewhere safe</em></>}
            body="If you lose your phone, one of these codes gets you in. They are shown once; we only keep a hash of each."
          />
          <div className="mt-6">
            <RecoveryCodesSheet codes={step.codes} email={email} onDone={() => void enter()} />
          </div>
        </>
      )}

      {isDev && step.kind !== "codes" && (
        <button
          type="button"
          onClick={() => void devFill()}
          className="mt-6 w-full rounded-md border border-dashed border-line-strong px-3 py-2 text-left text-[12.5px] text-ink-muted hover:border-ink-faint hover:text-ink"
          data-testid="dev-fill"
        >
          <span className="eyebrow mr-2 text-[10px] text-ochre">Dev</span>
          {step.kind === "password" ? (
            <>
              Fill <span className="font-mono">{DEV_EMAIL}</span>
            </>
          ) : DEV_TOTP || step.kind === "enrol" ? (
            "Fill the current code from the dev secret"
          ) : (
            "Set NEXT_PUBLIC_DEV_TOTP_SECRET to fill codes"
          )}
        </button>
      )}
    </div>
  );
}

function Enrol({
  step,
  code,
  setCode,
  busy,
  error,
  submit,
  email,
}: {
  step: Extract<Step, { kind: "enrol" }>;
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  error: string | null;
  submit: (v?: string) => Promise<void>;
  email: string;
}) {
  const [copied, setCopied] = useState(false);
  const meta = parseOtpauth(step.otpauthUri);
  return (
    <>
      <Heading
        eyebrow="Set up two-factor"
        icon={<ShieldCheck size={14} weight="duotone" />}
        title={<>Pair an <em>authenticator</em></>}
        body="The console needs a second factor for everyone. Scan this with Google Authenticator, 1Password, Authy or any TOTP app."
      />
      <div className="mt-6 flex flex-col items-center gap-5 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-start">
        <div className="rounded-md border border-line p-2">
          <QrCode value={step.otpauthUri} size={168} label={`QR code for ${meta.account ?? email}`} />
        </div>
        <div className="min-w-0 flex-1 text-[12.5px]">
          <p className="eyebrow text-[10px]">Can&rsquo;t scan?</p>
          <p className="mt-1 text-ink-muted">Type this key into the app instead.</p>
          <code className="mt-2 block break-all rounded-sm bg-surface-2 px-2 py-1.5 font-mono text-[13px] leading-relaxed tracking-[0.04em] text-ink" data-testid="totp-secret">
            {groupSecret(step.secret)}
          </code>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-adire hover:underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(step.secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard blocked */
              }
            }}
          >
            <Copy size={12} /> {copied ? "Copied" : "Copy key"}
          </button>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px] text-ink-muted">
            <dt>Issuer</dt>
            <dd className="truncate text-ink">{meta.issuer ?? "-"}</dd>
            <dt>Account</dt>
            <dd className="truncate text-ink">{meta.account ?? email}</dd>
          </dl>
        </div>
      </div>
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="mb-3 text-[13px] font-medium text-ink">Enter the code the app shows</p>
        <OtpInput value={code} onChange={setCode} onComplete={(v) => void submit(v)} invalid={!!error} disabled={busy} />
        <ErrorLine error={error} className="mt-4" />
        <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6} className="mt-6 w-full">
          Turn on two-factor
        </Button>
      </form>
    </>
  );
}

function Heading({ eyebrow, title, body, icon }: { eyebrow: string; title: React.ReactNode; body?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-4 flex items-center gap-2 text-brass-text">
        {icon ?? <ShieldCheck size={14} weight="duotone" />} {eyebrow}
      </p>
      <h1 className="display text-[40px] leading-[1.02] text-ink sm:text-[44px]">{title}</h1>
      {body && <div className="mt-3 text-[14px] leading-relaxed text-ink-muted">{body}</div>}
    </div>
  );
}

function Notice({ params }: { params: URLSearchParams }) {
  if (params.get("expired")) return <>Your session ended. Sign in again to carry on where you were.</>;
  if (params.get("signedOut")) return <>You are signed out. Sessions on other devices are unaffected.</>;
  return <>For Devstrike staff. You will need your authenticator app after your password.</>;
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
      <ArrowLeft size={14} /> Different account
    </button>
  );
}

function ErrorLine({ error, className }: { error: string | null; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={`flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--laterite)_30%,transparent)] bg-laterite-wash px-3 py-2.5 text-[13px] text-laterite ${className ?? ""}`}>
      <WarningOctagon size={16} weight="duotone" className="mt-px shrink-0" />
      {error}
    </p>
  );
}

/** A thin bar that empties as the current 30-second code window runs out. */
function WindowClock() {
  const [left, setLeft] = useState(30);
  useEffect(() => {
    const tick = () => setLeft(totpSecondsLeft());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mt-4 flex items-center gap-3" aria-hidden>
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-adire transition-[width] duration-1000 ease-linear" style={{ width: `${(left / 30) * 100}%`, opacity: left <= 5 ? 0.45 : 1 }} />
      </div>
      <span className="font-mono text-[11px] text-ink-faint">{left}s</span>
    </div>
  );
}

function signInError(err: unknown): string {
  if (isApiError(err)) {
    if (err.code === "ACCOUNT_LOCKED") {
      const until = typeof err.details?.lockedUntil === "string" ? new Date(err.details.lockedUntil) : null;
      return `Too many attempts. This account is locked${until ? ` until ${until.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}` : " for 15 minutes"}.`;
    }
    if (err.code === "MFA_TOKEN_INVALID") return "That sign-in took too long. Enter your password again.";
    if (err.code === "IP_NOT_ALLOWED") return "Your account can't sign in from this network. Ask a super admin to add it to your allowlist.";
    if (err.status === 401 && (err.code === "INVALID_CREDENTIALS" || err.code === "UNAUTHORIZED")) return "Those details don't match a console account.";
    if (err.code === "INVALID_MFA_CODE") {
      const left = err.details?.attemptsLeft;
      return `That code didn't match.${typeof left === "number" ? ` ${left} ${left === 1 ? "attempt" : "attempts"} left before the account locks.` : ""}`;
    }
  }
  return errorMessage(err);
}

function safeNext(n: string | null) {
  if (!n || !n.startsWith("/") || n.startsWith("//") || n.startsWith("/login")) return "/";
  return n;
}

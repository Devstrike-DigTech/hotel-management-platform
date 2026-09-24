"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, EnvelopeSimple, WarningOctagon } from "@phosphor-icons/react";
import { authApi } from "@/lib/api/endpoints";
import type { MfaChallenge } from "@/lib/api/types-m6";
import { errorMessage } from "@/lib/api/client";
import { PLATFORM_ROLES } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/primitives";
import { SignIn } from "./sign-in";

/** Accepting an invitation: choose a password, then pair an authenticator. */
export function InviteAccept({ token }: { token: string }) {
  const info = useQuery({ queryKey: ["invite", token], queryFn: () => authApi.invite(token), retry: false });
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);

  if (challenge && info.data) return <SignIn start={{ challenge, email: info.data.email }} />;
  if (info.isLoading) return <Skeleton className="h-72" />;
  if (info.isError || !info.data)
    return (
      <div>
        <p className="eyebrow mb-4 flex items-center gap-2 text-laterite">
          <WarningOctagon size={14} weight="duotone" /> Invitation
        </p>
        <h1 className="display text-[38px] leading-[1.04] text-ink">
          This link has <em>expired</em>.
        </h1>
        <p className="mt-3 text-[14px] text-ink-muted">Invitations work once, for seven days. Ask whoever invited you to send a new one.</p>
      </div>
    );
  const d = info.data;
  const ok = pw.length >= 10 && pw === again;
  return (
    <div>
      <p className="eyebrow mb-4 flex items-center gap-2 text-brass-text">
        <EnvelopeSimple size={14} weight="duotone" /> Invitation &middot; {PLATFORM_ROLES[d.role]?.label}
      </p>
      <h1 className="display text-[40px] leading-[1.02] text-ink">
        Welcome, <em>{(name || d.fullName).split(" ")[0]}</em>.
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
        Choose a password for <span className="text-ink">{d.email}</span>. Next you will pair an authenticator app. This link expires {formatDate(d.expiresAt)}.
      </p>
      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          setBusy(true);
          setError(null);
          try {
            setChallenge(await authApi.acceptInvite(token, pw, name.trim() || undefined));
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        <Field label="Your name" htmlFor="inv-n" optional>
          <Input id="inv-n" value={name} onChange={(e) => setName(e.target.value)} placeholder={d.fullName} />
        </Field>
        <Field label="Password" htmlFor="inv-p" hint="At least 10 characters.">
          <PasswordInput id="inv-p" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Password again" htmlFor="inv-a" error={again && again !== pw ? "The two don't match." : null}>
          <PasswordInput id="inv-a" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-[13px] text-laterite">{error}</p>}
        <Button type="submit" size="lg" disabled={!ok} loading={busy} className="mt-2 w-full">
          Continue <ArrowRight size={16} weight="bold" />
        </Button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy, DownloadSimple, Printer } from "@phosphor-icons/react";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";

/**
 * The ten recovery codes, shown once. Laid out like a tear-off sheet of
 * numbered stubs; copy, download as text and print are all offered, and the
 * person has to tick that they stored them before continuing.
 */
export function RecoveryCodesSheet({
  codes,
  email,
  onDone,
  doneLabel = "Continue to the console",
}: {
  codes: string[];
  email?: string | null;
  onDone?: () => void;
  doneLabel?: string;
}) {
  const [stored, setStored] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = [
    `${config.appName} Console recovery codes`,
    email ? `Account: ${email}` : null,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Each code works once. Keep them somewhere only you can reach.",
    "",
    ...codes.map((c, i) => `${String(i + 1).padStart(2, "0")}  ${c}`),
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the download still works */
    }
  };
  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `console-recovery-codes${email ? `-${email.split("@")[0]}` : ""}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-md border border-line bg-surface" data-testid="recovery-codes">
        <div className="flex items-center justify-between border-b border-dashed border-line-strong px-4 py-2.5">
          <span className="eyebrow text-[10px]">Recovery codes &middot; single use</span>
          <span className="font-mono text-[11px] text-ink-faint">{codes.length} codes</span>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2">
          {codes.map((c, i) => (
            <li
              key={c}
              className="flex items-center gap-3 border-b border-dashed border-line px-4 py-2.5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <span className="font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
              <code className="font-mono text-[15px] tracking-[0.06em] text-ink select-all">{c}</code>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 no-print">
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check size={14} weight="bold" className="text-palm" /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <DownloadSimple size={14} /> Download .txt
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </Button>
      </div>
      {onDone && (
        <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5 no-print">
          <Checkbox checked={stored} onChange={setStored} label="I have stored these codes somewhere safe" />
          <Button size="lg" disabled={!stored} onClick={onDone} className="w-full sm:w-auto">
            {doneLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

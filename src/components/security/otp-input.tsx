"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Six single-digit cells for an authenticator code. Typing moves forward,
 * Backspace moves back, a pasted code fills every cell, and `onComplete` fires
 * once all six are in (so a person can type and never reach for Enter).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
  autoFocus,
  length = 6,
  label = "Authenticator code",
  idPrefix = "otp",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  length?: number;
  label?: string;
  idPrefix?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  return (
    <div role="group" aria-label={label} className={cn("flex gap-2", invalid && "animate-[shake_320ms_ease-out]")}>
      {digits.map((d, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={cn("otp-cell", i === 2 && "mr-2")}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={d}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            let raw = e.target.value.replace(/\D/g, "");
            if (!raw) return;
            // typed over a filled cell without a selection: keep the new digit
            if (d && raw.length === 2 && raw.startsWith(d)) raw = raw.slice(1);
            if (raw.length > 1) {
              // pasted or autofilled: spread from this cell on
              const merged = (value.slice(0, i) + raw).slice(0, length);
              const clean = set(merged);
              refs.current[Math.min(clean.length, length - 1)]?.focus();
              return;
            }
            const arr = digits.slice();
            arr[i] = raw;
            const clean = set(arr.join(""));
            if (i < length - 1 && clean.length > i) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              const arr = digits.slice();
              if (arr[i]) {
                arr[i] = "";
                onChange(arr.join("").slice(0, i) + arr.slice(i + 1).join(""));
              } else if (i > 0) {
                arr[i - 1] = "";
                onChange(arr.slice(0, i - 1).join(""));
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft" && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowRight" && i < length - 1) {
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!text) return;
            e.preventDefault();
            const clean = set(text);
            refs.current[Math.min(clean.length, length - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}

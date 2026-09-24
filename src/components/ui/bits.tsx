"use client";

import { Star } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export function Stars({ value, size = 13, className, label }: { value: number; size?: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(5, Math.round(value * 2) / 2));
  return (
    <span className={cn("inline-flex items-center gap-[1px] text-brass", className)} role="img" aria-label={label ?? `${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = v >= i + 1 ? "full" : v >= i + 0.5 ? "half" : "none";
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} weight="regular" className="absolute inset-0 opacity-45" aria-hidden />
            {fill !== "none" && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: fill === "half" ? size / 2 : size }}>
                <Star size={size} weight="fill" aria-hidden />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function ChipRadio<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors disabled:opacity-40",
              on
                ? "border-ink bg-ink text-paper"
                : "border-line-strong bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

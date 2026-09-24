import { config } from "@/lib/config";
import { cn } from "@/lib/cn";

/**
 * The console mark: an adire-dyed tile with brass arcs drawn from one corner,
 * like the resist-dye "arcs" square, and a single brass point. It reads as a
 * dial, which is what the console is. Deliberately unlike the hotel admin's
 * laterite key fob so the two apps are never mistaken for each other.
 */
export function ConsoleMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={cn("shrink-0", className)}>
      <rect x="0.5" y="0.5" width="39" height="39" rx="7" fill="#1d2d52" stroke="#d6a94a" strokeOpacity="0.55" />
      <g fill="none" stroke="#d6a94a" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8 32 A24 24 0 0 1 32 8" strokeOpacity="0.45" />
        <path d="M8 32 A17 17 0 0 1 25 15" strokeOpacity="0.7" />
        <path d="M8 32 A10 10 0 0 1 18 22" />
      </g>
      <path d="M8 32 L27.5 12.5" stroke="#e6e3dc" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="32" r="2.6" fill="#d6a94a" />
      <circle cx="29.5" cy="29.5" r="1.4" fill="#93a8cf" />
    </svg>
  );
}

export function Wordmark({ className, tone = "ink", size = "md" }: { className?: string; tone?: "ink" | "night"; size?: "sm" | "md" | "lg" }) {
  const mark = size === "lg" ? 36 : size === "sm" ? 24 : 28;
  const text = size === "lg" ? "text-[24px]" : size === "sm" ? "text-[16px]" : "text-[18px]";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ConsoleMark size={mark} />
      <span className="flex flex-col leading-none">
        <span
          className={cn("display-sm tracking-tight", text, tone === "night" ? "text-night-ink" : "text-ink")}
          style={{ fontVariationSettings: '"opsz" 72, "SOFT" 0, "WONK" 0', fontWeight: 500 }}
        >
          {config.appName}
        </span>
        <span className={cn("mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em]", tone === "night" ? "text-night-brass" : "text-brass-text")}>
          Console
        </span>
      </span>
    </span>
  );
}

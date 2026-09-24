import { cn } from "@/lib/cn";

const ENV = (process.env.NEXT_PUBLIC_CONSOLE_ENV || (process.env.NODE_ENV === "production" ? "production" : "development")).toLowerCase();

/**
 * Which platform this console is pointed at, always visible. Production reads
 * "Live" in brass so nobody mistakes it for a rehearsal; everything else is ochre.
 */
export function EnvChip({ className }: { className?: string }) {
  const live = ENV === "production";
  const label = live ? "Live" : ENV === "staging" ? "Staging" : "Development";
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        live
          ? "border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash text-brass-text"
          : "border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash text-ochre",
        className,
      )}
      title={`This console is connected to the ${label.toLowerCase()} platform`}
    >
      <span className="live-dot" style={{ width: 6, height: 6 }} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{live ? "Live" : ENV.slice(0, 3)}</span>
    </span>
  );
}

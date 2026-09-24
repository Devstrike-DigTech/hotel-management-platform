import { Globe, Storefront } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/** Marketplace (brass, a shop front) or booking site (adire, a globe); glyph and name, never colour alone. */
export function ChannelBadge({ source, size = "md" }: { source: "MARKETPLACE" | "BOOKING_SITE"; size?: "sm" | "md" }) {
  const mkt = source === "MARKETPLACE";
  const I = mkt ? Storefront : Globe;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-xs border font-mono font-medium uppercase leading-none whitespace-nowrap",
        size === "sm" ? "h-[18px] px-1 text-[9.5px] tracking-[0.1em]" : "h-[22px] px-1.5 text-[10.5px] tracking-[0.12em]",
        mkt ? "border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-brass-wash text-brass-text" : "border-[color-mix(in_oklab,var(--adire)_35%,transparent)] bg-adire-wash text-adire",
      )}
    >
      <I size={size === "sm" ? 11 : 12} weight="bold" /> {mkt ? "Marketplace" : "Booking site"}
    </span>
  );
}

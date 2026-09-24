import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "paper", "surface", "surface-2", "ink", "ink-muted", "ink-faint", "line", "line-strong",
        "adire", "adire-hover", "adire-ink", "adire-wash", "adire-soft", "brass", "brass-text", "brass-wash",
        "laterite", "laterite-hover", "laterite-ink", "laterite-wash", "palm", "palm-wash", "ochre", "ochre-wash",
        "night", "night-2", "night-line", "night-ink", "night-muted", "night-brass", "night-adire",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

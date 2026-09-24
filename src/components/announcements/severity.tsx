import { CheckCircle, Info, Warning, WarningOctagon, Wrench, type Icon } from "@phosphor-icons/react";
import type { AnnouncementSeverity } from "@/lib/api/types-m6";

export const SEVERITY: Record<AnnouncementSeverity, { label: string; icon: Icon; tone: "adire" | "palm" | "ochre" | "danger" | "brass"; color: string; wash: string }> = {
  INFO: { label: "Information", icon: Info, tone: "adire", color: "var(--adire)", wash: "var(--adire-wash)" },
  SUCCESS: { label: "Good news", icon: CheckCircle, tone: "palm", color: "var(--palm)", wash: "var(--palm-wash)" },
  WARNING: { label: "Warning", icon: Warning, tone: "ochre", color: "var(--ochre)", wash: "var(--ochre-wash)" },
  CRITICAL: { label: "Critical", icon: WarningOctagon, tone: "danger", color: "var(--laterite)", wash: "var(--laterite-wash)" },
  MAINTENANCE: { label: "Maintenance", icon: Wrench, tone: "brass", color: "var(--brass-text)", wash: "var(--brass-wash)" },
};
export const SEVERITY_ORDER: AnnouncementSeverity[] = ["INFO", "SUCCESS", "WARNING", "CRITICAL", "MAINTENANCE"];

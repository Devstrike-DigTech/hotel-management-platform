import type { DbMode, DbStatus } from "@/lib/api/types-m6";
import { Badge } from "@/components/ui/primitives";

export const DB_STATUS_LABEL: Record<DbStatus | "ROLLED_BACK", string> = {
  PROVISIONING: "Provisioning",
  MIGRATING: "Migrating",
  COPYING: "Copying",
  CUTOVER: "Cutting over",
  ACTIVE: "Active",
  FAILED: "Failed",
  ROLLED_BACK: "Rolled back",
};

export function DbStatusBadge({ mode, status }: { mode: DbMode; status: DbStatus | "ROLLED_BACK" | null }) {
  if (!status) return <Badge tone="neutral">{mode === "DEDICATED" ? "Dedicated" : "Shared"}</Badge>;
  const tone = status === "ACTIVE" ? "palm" : status === "FAILED" ? "danger" : status === "ROLLED_BACK" ? "ochre" : "adire";
  return (
    <Badge tone={tone} dot>
      {DB_STATUS_LABEL[status]}
    </Badge>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, PuzzlePiece } from "@phosphor-icons/react";
import { tenantsApi } from "@/lib/api/endpoints";
import { qk, useFeatures, usePlans } from "@/lib/api/hooks";
import type { TenantDetailM6 } from "@/lib/api/types-m6";
import { FALLBACK_FEATURES, FEATURE_CATEGORIES, featureName, planName } from "@/lib/catalog";
import { toast } from "@/lib/store";
import { useCan } from "@/lib/session";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/ui/form";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";

export function FeaturesTab({ tenant }: { tenant: TenantDetailM6 }) {
  const qc = useQueryClient();
  const can = useCan();
  const plans = usePlans();
  const features = useFeatures();
  const feats = features.data?.length ? features.data : FALLBACK_FEATURES;
  const plan = plans.data?.find((p) => p.code === tenant.planCode);
  const planFeatures = new Set(plan?.features ?? tenant.entitlements?.features ?? []);
  const overrides = new Map(tenant.featureOverrides.map((o) => [o.featureCode, o]));
  const [local, setLocal] = useState<Map<string, boolean>>(new Map(tenant.featureOverrides.map((o) => [o.featureCode, o.enabled])));

  const setFeature = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      enabled ? tenantsApi.setFeature(tenant.id, code, true) : tenantsApi.removeFeature(tenant.id, code),
    onMutate: ({ code, enabled }) => setLocal((m) => new Map(m).set(code, enabled)),
    onError: (_e, { code }) =>
      setLocal((m) => {
        const n = new Map(m);
        const o = overrides.get(code);
        if (o) n.set(code, o.enabled);
        else n.delete(code);
        return n;
      }),
    onSuccess: (_d, { code, enabled }) => {
      toast.success(enabled ? "Add-on granted" : "Add-on removed", featureName(code, feats));
      void qc.invalidateQueries({ queryKey: qk.tenant(tenant.id) });
    },
    meta: { errorTitle: "Add-on not changed" },
  });
  const addOns = [...local.entries()].filter(([c, on]) => on && !planFeatures.has(c)).length;
  const editable = can("tenants.manage");

  return (
    <Panel>
      <PanelHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <PuzzlePiece size={13} weight="duotone" /> Entitlements
          </span>
        }
        title="Features and add-ons"
        description={`Everything on ${plan?.name ?? planName(tenant.planCode)} is included. Grant anything else individually.`}
        actions={addOns > 0 && <Badge tone="brass">{addOns} add-on{addOns === 1 ? "" : "s"}</Badge>}
      />
      {[...FEATURE_CATEGORIES, "Other"].map((cat) => {
        const list = feats.filter((f) => (cat === "Other" ? !FEATURE_CATEGORIES.includes(f.category) : f.category === cat));
        if (!list.length) return null;
        return (
          <section key={cat} className="border-b border-line last:border-b-0">
            <h3 className="eyebrow px-5 pb-1 pt-4 text-[10px]">{cat}</h3>
            <ul className="grid sm:grid-cols-2 xl:grid-cols-3">
              {list.map((f) => {
                const included = planFeatures.has(f.code);
                const on = included || !!local.get(f.code);
                const addOn = !included && !!local.get(f.code);
                const note = overrides.get(f.code)?.note;
                return (
                  <li key={f.code} className={cn("flex items-start gap-3 px-5 py-3", addOn && "bg-brass-wash/50")}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[13.5px] text-ink">
                        {f.name}
                        {addOn && <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-brass-text">add-on</span>}
                      </p>
                      <p className="text-[12px] leading-snug text-ink-faint">{note || f.description}</p>
                    </div>
                    {included ? (
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11.5px] text-palm" title="Included in the plan">
                        <Check size={13} weight="bold" /> Plan
                      </span>
                    ) : (
                      <Switch
                        ariaLabel={`Grant ${f.name} as an add-on`}
                        checked={on}
                        disabled={!editable || (setFeature.isPending && setFeature.variables?.code === f.code)}
                        onChange={(v) => setFeature.mutate({ code: f.code, enabled: v })}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </Panel>
  );
}

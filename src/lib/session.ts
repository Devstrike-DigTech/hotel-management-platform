"use client";

import { useQuery } from "@tanstack/react-query";
import { authApi, type PlatformMe } from "./api/endpoints";
import { ROLE_PERMISSIONS, type Permission } from "./catalog";

export const meKey = ["platform", "me"] as const;

export function useMe(enabled = true) {
  return useQuery({ queryKey: meKey, queryFn: authApi.me, enabled, staleTime: 60_000, retry: false });
}

/** Permissions for the signed-in person: what the API sent, else the role matrix. */
export function permissionsOf(me: PlatformMe | null | undefined): Set<string> {
  if (!me) return new Set();
  if (Array.isArray(me.permissions) && me.permissions.length) return new Set(me.permissions);
  return new Set(ROLE_PERMISSIONS[me.role] ?? []);
}

export function useCan() {
  const me = useMe();
  const perms = permissionsOf(me.data);
  return (p: Permission | Permission[] | undefined) => {
    if (!p) return true;
    const list = Array.isArray(p) ? p : [p];
    return list.some((x) => perms.has(x));
  };
}

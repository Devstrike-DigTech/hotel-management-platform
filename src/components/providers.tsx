"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useState } from "react";
import { isApiError, isStepUpError } from "@/lib/api/client";
import { toast } from "@/lib/store";
import { Toaster } from "@/components/ui/toaster";
import { StepUpHost } from "@/components/security/step-up";

export interface MutationMeta extends Record<string, unknown> {
  /** Title for the error toast; the message comes from the API. */
  errorTitle?: string;
  /** Suppress the global error toast (the component shows the error). */
  silent?: boolean;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _v, _c, mutation) => {
            const meta = mutation.meta as MutationMeta | undefined;
            if (meta?.silent) return;
            // A cancelled step-up is the person's choice, not a failure.
            if (isStepUpError(error)) {
              toast.warning("Not done", "That action needs your authenticator code.");
              return;
            }
            if (isApiError(error) && error.status === 401) return;
            toast.error(meta?.errorTitle ?? "That didn't go through", isApiError(error) ? error.message : error instanceof Error ? error.message : undefined);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            retry: (count, error) => {
              if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
              return count < 2;
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipPrimitive.Provider delayDuration={250}>
        {children}
        <StepUpHost />
        <Toaster />
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
}

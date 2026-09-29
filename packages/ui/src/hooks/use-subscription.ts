import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeInput, Subscription } from "@/components/crm/pro-subscription-manager/billing";

/** Backend adapter; wire each method to your billing API (Stripe, Chargebee, in-house...). */
export interface SubscriptionApi {
  getSubscription: (id: string) => Promise<Subscription>;
  changePlan: (id: string, input: ChangeInput) => Promise<Subscription>;
  updateSeats: (id: string, seats: number) => Promise<Subscription>;
  pause: (id: string, input: { resumesAt: string | null }) => Promise<Subscription>;
  resume: (id: string) => Promise<Subscription>;
  cancel: (
    id: string,
    input: { reason: string; feedback: string; atPeriodEnd: boolean },
  ) => Promise<Subscription>;
  acceptOffer: (id: string, offerId: string) => Promise<Subscription>;
  /** Undo a pending cancellation or scheduled downgrade. */
  reactivate: (id: string) => Promise<Subscription>;
}

export const subscriptionKey = (id: string) => ["kitbase-subscription", id] as const;

/**
 * TanStack Query wrapper: one cached subscription query plus mutations that write the server's
 * response straight into the cache (no refetch round-trip), with a shared pending flag.
 */
export function useSubscription(api: SubscriptionApi, id: string) {
  const qc = useQueryClient();
  const key = subscriptionKey(id);
  const query = useQuery({ queryKey: key, queryFn: () => api.getSubscription(id) });

  const mutation = useMutation({
    mutationFn: (run: (api: SubscriptionApi) => Promise<Subscription>) => run(api),
    onSuccess: (sub) => qc.setQueryData(key, sub),
  });

  const run = (fn: (api: SubscriptionApi) => Promise<Subscription>) => mutation.mutateAsync(fn);

  return {
    query,
    subscription: query.data,
    pending: mutation.isPending,
    mutationError: mutation.error as Error | null,
    resetError: mutation.reset,
    changePlan: (input: ChangeInput) => run((a) => a.changePlan(id, input)),
    updateSeats: (seats: number) => run((a) => a.updateSeats(id, seats)),
    pause: (resumesAt: string | null) => run((a) => a.pause(id, { resumesAt })),
    resume: () => run((a) => a.resume(id)),
    cancel: (input: { reason: string; feedback: string; atPeriodEnd: boolean }) =>
      run((a) => a.cancel(id, input)),
    acceptOffer: (offerId: string) => run((a) => a.acceptOffer(id, offerId)),
    reactivate: () => run((a) => a.reactivate(id)),
  };
}

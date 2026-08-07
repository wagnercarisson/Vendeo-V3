import { useCallback, useEffect, useState } from "react";
import type { OperationKey } from "@/lib/credit/types";

export type OperationCostsMap = Record<
  OperationKey,
  { costCredits: number; enabled: boolean }
>;

export type UseOperationCostsStatus = "loading" | "unavailable" | "loaded";

// Deduplicates concurrent in-flight requests across components, but does NOT
// keep a persistent cache between mounts. This ensures cost/enablement changes
// made in admin are reflected as soon as the consumer page mounts.
let inflight: Promise<OperationCostsMap> | null = null;

export function useOperationCosts(): {
  costs: OperationCostsMap | null;
  status: UseOperationCostsStatus;
  refetch: () => void;
} {
  const [costs, setCosts] = useState<OperationCostsMap | null>(null);
  const [status, setStatus] = useState<UseOperationCostsStatus>("loading");

  const load = useCallback(() => {
    setStatus("loading");
    if (!inflight) {
      inflight = fetch("/api/operation-costs", { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<OperationCostsMap>;
        })
        .then((data) => {
          inflight = null;
          return data;
        })
        .catch((err) => {
          inflight = null;
          throw err;
        });
    }

    inflight
      .then((data) => {
        setCosts(data);
        setStatus("loaded");
      })
      .catch(() => {
        setCosts(null);
        setStatus("unavailable");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refetch = useCallback(() => {
    load();
  }, [load]);

  return { costs, status, refetch };
}

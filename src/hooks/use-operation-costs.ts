import { useCallback, useEffect, useState } from "react";
import type { OperationKey } from "@/lib/credit/types";

export type OperationCostsMap = Record<
  OperationKey,
  { costCredits: number; enabled: boolean }
>;

export type UseOperationCostsStatus = "loading" | "unavailable" | "loaded";

let cache: OperationCostsMap | null = null;
let inflight: Promise<OperationCostsMap> | null = null;

export function useOperationCosts(): {
  costs: OperationCostsMap | null;
  status: UseOperationCostsStatus;
  refetch: () => void;
} {
  const [costs, setCosts] = useState<OperationCostsMap | null>(cache);
  const [status, setStatus] = useState<UseOperationCostsStatus>(
    cache ? "loaded" : "loading",
  );

  const load = useCallback(() => {
    setStatus("loading");
    if (!inflight) {
      inflight = fetch("/api/operation-costs", { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<OperationCostsMap>;
        })
        .then((data) => {
          cache = data;
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
    if (!cache) {
      load();
    }
  }, [load]);

  const refetch = useCallback(() => {
    cache = null;
    load();
  }, [load]);

  return { costs, status, refetch };
}

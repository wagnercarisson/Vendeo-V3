"use client";

import { useEffect } from "react";

const INITIAL_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * F60.7 C3 — polling read-only do status conjunto.
 *
 * - uma requisição por vez (sem sobreposição);
 * - backoff 5/10/20/30 s em falhas;
 * - cancelamento no unmount;
 * - para em terminal; quando um formato passa a delivered, chama `onDelivered`
 *   (o status não contém URL; o chamador renova props/URLs no servidor).
 */
export function useTwoFormatPolling(input: {
  readonly campaignId: string;
  readonly operationId: string | null;
  readonly enabled: boolean;
  readonly formatsSignature: string;
  readonly onDelivered: () => void;
  /** Injetável em testes. */
  readonly fetchFn?: typeof fetch;
  readonly intervalMs?: number;
}) {
  const {
    campaignId,
    operationId,
    enabled,
    formatsSignature,
    onDelivered,
    fetchFn,
    intervalMs = INITIAL_INTERVAL_MS,
  } = input;

  useEffect(() => {
    if (!enabled || !operationId) return;
    let cancelled = false;
    let inFlight = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const response = await (fetchFn ?? fetch)(
          "/api/campaign/generation-status",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId, operationId }),
            signal: controller.signal,
          },
        );
        if (cancelled) return;
        if (!response.ok) {
          failures += 1;
          schedule(
            Math.min(
              MAX_BACKOFF_MS,
              intervalMs * 2 ** (failures - 1),
            ),
          );
          return;
        }
        const data = (await response.json()) as {
          operation?: {
            formats?: Record<"1:1" | "9:16", { state?: string }>;
          };
        };
        if (cancelled) return;
        const formats = data.operation?.formats;
        if (formats) {
          const signature = JSON.stringify(formats);
          const anyDelivered =
            formats["1:1"]?.state === "delivered" ||
            formats["9:16"]?.state === "delivered";
          if (signature !== formatsSignature && anyDelivered) {
            onDelivered();
            return;
          }
        }
        failures = 0;
        schedule(intervalMs);
      } catch {
        if (!cancelled) {
          failures += 1;
          schedule(
            Math.min(
              MAX_BACKOFF_MS,
              intervalMs * 2 ** (failures - 1),
            ),
          );
        }
      } finally {
        inFlight = false;
      }
    };

    schedule(intervalMs);
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== null) clearTimeout(timer);
    };
  }, [
    campaignId,
    enabled,
    fetchFn,
    formatsSignature,
    intervalMs,
    onDelivered,
    operationId,
  ]);
}

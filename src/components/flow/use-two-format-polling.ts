"use client";

import { useEffect } from "react";

import {
  areBothTwoFormatStatesSettled,
  twoFormatStatesSignature,
} from "@/lib/product-two-format/format-signature";

const INITIAL_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 30_000;

type StatusFormats = Partial<
  Record<"1:1" | "9:16", { readonly state?: string } | string>
>;

/**
 * F60.7 C3 — polling READ-ONLY do status conjunto.
 *
 * - uma requisição por vez (`inFlight`/`AbortController`);
 * - comparação por assinatura CANÔNICA de estados (nunca objetos completos);
 * - backoff 5/10/20/30 s em falhas;
 * - cancelamento no unmount/troca;
 * - em QUALQUER mudança relevante de estados (delivered, refunded/absent,
 *   unknown) chama `onTransition` uma vez e CONTINUA o ciclo; o chamador faz
 *   `router.refresh()` para o servidor recomputar URLs assinadas;
 * - para quando os dois formatos estão estáveis.
 *
 * Nunca chama geração/continuação, nunca projeta campanha e nunca assina URL.
 */
export function useTwoFormatPolling(input: {
  readonly campaignId: string;
  readonly operationId: string | null;
  readonly enabled: boolean;
  readonly formatsSignature: string;
  readonly onTransition: () => void;
  /** Injetável em testes. */
  readonly fetchFn?: typeof fetch;
  readonly intervalMs?: number;
}) {
  const {
    campaignId,
    operationId,
    enabled,
    formatsSignature,
    onTransition,
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
    let lastSignature = formatsSignature;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(() => void tick(), ms);
    };

    const retryDelay = () =>
      Math.min(MAX_BACKOFF_MS, intervalMs * 2 ** Math.max(0, failures - 1));

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
          schedule(retryDelay());
          return;
        }

        const data = (await response.json()) as {
          operation?: { formats?: StatusFormats };
        };
        if (cancelled) return;
        const formats = data.operation?.formats;

        if (formats) {
          const signature = twoFormatStatesSignature(formats);
          const changed = signature !== lastSignature;
          if (changed) {
            lastSignature = signature;
            onTransition();
          }
          failures = 0;
          if (areBothTwoFormatStatesSettled(formats)) {
            return;
          }
          schedule(intervalMs);
          return;
        }

        failures = 0;
        schedule(intervalMs);
      } catch {
        if (!cancelled) {
          failures += 1;
          schedule(retryDelay());
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
    onTransition,
    operationId,
  ]);
}

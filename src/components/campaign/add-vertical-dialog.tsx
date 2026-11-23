"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CampaignDetailFormatAdditionMessages } from "@/lib/i18n/campaign-detail/messages";

type AdditionState =
  | "eligible"
  | "incompatible"
  | "processing"
  | "delivered"
  | "unknown"
  | "refunded"
  | "unavailable";

interface AdditionDto {
  readonly state: AdditionState;
  readonly sourceOrigin?: "new_flow_1_1" | "legacy_campaign" | null;
  readonly costCredits?: number;
  readonly reason?: string;
  readonly refunded?: boolean;
  readonly requestId?: string;
  readonly confirmationToken?: string;
  readonly expiresAt?: string;
}

export interface AddVerticalDialogProps {
  readonly campaignId: string;
  readonly messages: CampaignDetailFormatAdditionMessages;
  readonly locale: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDelivered: () => void;
}

function reasonMessage(
  dto: AdditionDto | null,
  messages: CampaignDetailFormatAdditionMessages,
): string | null {
  if (!dto?.reason) return null;
  const incompatible = messages.incompatible as unknown as Record<string, string>;
  const incompatibleKey: Record<string, string> = {
    unsupported_dimensions: "unsupportedDimensions",
    unsupported_mime: "unsupportedMime",
    artifact_invalid: "artifactInvalid",
    path_not_canonical: "pathNotCanonical",
    format_not_square: "formatNotSquare",
    campaign_not_ready: "campaignNotReady",
    source_origin_invalid: "sourceOriginInvalid",
  };
  const mappedReason = incompatibleKey[dto.reason] ?? dto.reason;
  if (dto.state === "incompatible" && incompatible[mappedReason]) {
    return incompatible[mappedReason];
  }
  const readUnavailable = messages.readUnavailable as unknown as Record<
    string,
    string
  >;
  const readKey: Record<string, string> = {
    artifact_absent: "artifactAbsent",
    artifact_indeterminate: "artifactIndeterminate",
    read_failed: "readFailed",
    identity_conflict: "identityConflict",
  };
  const mappedReadReason = readKey[dto.reason] ?? dto.reason;
  if (readUnavailable[mappedReadReason]) return readUnavailable[mappedReadReason];
  if (dto.reason === "failed_outcome" || dto.reason === "definitive_failure") {
    return messages.failed;
  }
  if (dto.reason === "addition_disabled") return messages.unavailable;
  return messages.unavailable;
}

/**
 * F62/62-05 — modal do detalhe. Confirma com 1 crédito, acompanha por polling
 * READ-ONLY e nunca cancela/estorna ao fechar. Nenhum dado financeiro/técnico é
 * aceito do cliente; o POST leva apenas formato + token server-issued.
 */
export function AddVerticalDialog({
  campaignId,
  messages,
  locale,
  open,
  onClose,
  onDelivered,
}: AddVerticalDialogProps) {
  const [dto, setDto] = useState<AdditionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  const deliveredRef = useRef(onDelivered);
  const titleId = `format-addition-title-${campaignId}`;
  const descriptionId = `format-addition-description-${campaignId}`;
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
    deliveredRef.current = onDelivered;
  }, [onClose, onDelivered]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const load = useCallback(
    async (options: { readonly silent?: boolean } = {}) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!options.silent) setLoading(true);
      try {
        const response = await fetch(
          `/api/campaign/${campaignId}/format-additions`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const json = (await response.json().catch(() => null)) as
          | AdditionDto
          | null;
        if (controller.signal.aborted) return;
        if (!response.ok || json === null) {
          setFailed(true);
          setDto({ state: "unavailable" });
          return;
        }
        setFailed(false);
        setDto(json);
        if (json.state === "delivered") {
          deliveredRef.current();
          closeRef.current();
        }
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setFailed(true);
        setDto({ state: "unavailable" });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [campaignId],
  );

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      clearTimer();
      setDto(null);
      setLoading(false);
      setSubmitting(false);
      setFailed(false);
      return;
    }
    void load();
    return () => {
      abortRef.current?.abort();
      clearTimer();
    };
  }, [open, load, clearTimer]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    clearTimer();
    if (!open) return;
    if (dto?.state !== "processing" && dto?.state !== "unknown") return;
    timerRef.current = setTimeout(() => {
      void load({ silent: true });
    }, 3000);
    return clearTimer;
  }, [open, dto?.state, load, clearTimer]);

  const submit = useCallback(async () => {
    if (!dto?.confirmationToken) return;
    setSubmitting(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/campaign/${campaignId}/format-additions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            format: "9:16",
            confirmationToken: dto.confirmationToken,
          }),
        },
      );
      const json = (await response.json().catch(() => null)) as
        | AdditionDto
        | { error?: { code?: string } }
        | null;
      if (!response.ok || json === null || !("state" in json)) {
        setFailed(true);
        setDto((prev) =>
          prev ? { ...prev, state: "unavailable", reason: "failed" } : prev,
        );
        return;
      }
      setDto(json as AdditionDto);
      if (json.state === "delivered") {
        deliveredRef.current();
        closeRef.current();
      } else if (json.state === "eligible") {
        void load({ silent: true });
      }
    } catch {
      setFailed(true);
      setDto((prev) =>
        prev ? { ...prev, state: "unavailable", reason: "failed" } : prev,
      );
    } finally {
      setSubmitting(false);
    }
  }, [campaignId, dto?.confirmationToken, load]);

  if (!open) return null;

  const reason = reasonMessage(dto, messages);
  const retryable =
    dto?.state === "refunded" &&
    typeof dto.confirmationToken === "string" &&
    dto.confirmationToken.length > 0 &&
    dto.reason !== "addition_disabled";
  const canConfirm =
    dto?.state === "eligible" &&
    typeof dto.confirmationToken === "string" &&
    dto.confirmationToken.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        lang={locale === "es-419" ? "es-419" : undefined}
        className="w-full max-w-md rounded-xl border border-border bg-bg-surface p-5 shadow-xl"
      >
        <h2
          id={titleId}
          className="font-heading text-lg font-semibold text-text-primary"
        >
          {messages.title}
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-sm font-body text-text-secondary"
        >
          {loading && !dto ? messages.processing : messages.description}
        </p>

        <div aria-live="polite" className="mt-3 text-sm font-body">
          {loading && !dto ? (
            <p>{messages.processing}</p>
          ) : dto?.state === "eligible" ? (
            <p className="font-semibold text-text-primary">{messages.cost}</p>
          ) : dto?.state === "processing" ? (
            <>
              <p>{messages.processing}</p>
              <p className="mt-1 text-text-muted">{messages.tracking}</p>
            </>
          ) : dto?.state === "unknown" ? (
            <>
              <p>{messages.unknown}</p>
              <p className="mt-1 text-text-muted">{messages.tracking}</p>
            </>
          ) : dto?.state === "refunded" ? (
            <p>
              {dto.reason === "addition_disabled"
                ? messages.unavailable
                : messages.refunded}
            </p>
          ) : dto?.state === "delivered" ? (
            <p>{messages.delivered}</p>
          ) : dto?.state === "incompatible" || dto?.state === "unavailable" ? (
            <p>{reason ?? (failed ? messages.failed : messages.unavailable)}</p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            {messages.cancel}
          </Button>
          {canConfirm ? (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? messages.processing : messages.confirm}
            </Button>
          ) : retryable ? (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? messages.processing : messages.retry}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

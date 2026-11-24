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
  readonly code?: string;
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
  failed: boolean,
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
  const conflict = messages.conflict as unknown as Record<string, string>;
  const conflictKey: Record<string, string> = {
    operation_exists: "operationExists",
    retry_not_allowed: "retryNotAllowed",
    source_changed: "sourceChanged",
    source_not_eligible: "sourceNotEligible",
    confirmation_expired: "confirmationExpired",
    invalid_confirmation: "invalidConfirmation",
    confirmation_failed: "confirmationFailed",
    insufficient_credits: "insufficientCredits",
    rate_limit_exceeded: "rateLimitExceeded",
    authorization_unavailable: "authorizationUnavailable",
    authorization_resolver_not_configured: "authorizationUnavailable",
    gate_read_failed: "authorizationUnavailable",
    legal_blocked: "legalBlocked",
    store_not_ready: "storeNotReady",
    engine_disabled: "engineDisabled",
  };
  const mappedConflict =
    conflictKey[dto.code ?? ""] ?? conflictKey[dto.reason];
  if (mappedConflict && conflict[mappedConflict]) return conflict[mappedConflict];
  if (dto.reason === "failed_outcome" || dto.reason === "definitive_failure") {
    return messages.failed;
  }
  if (dto.reason === "addition_disabled") return messages.unavailable;
  if (dto.state === "unavailable" && failed) {
    return messages.conflict.confirmationFailed;
  }
  return messages.unavailable;
}

const REJECTION_CODE_RE = /^[a-z0-9_]{1,64}$/;

function safeCode(value: unknown): string | null {
  return typeof value === "string" && REJECTION_CODE_RE.test(value)
    ? value
    : null;
}

/**
 * Preserva apenas CÓDIGOS técnicos seguros da rejeição — nunca a mensagem crua
 * do servidor. `code` identifica a classe; `reason` preserva o detalhe seguro.
 */
function rejectionDetails(json: unknown): {
  readonly code: string | null;
  readonly reason: string | null;
} {
  if (json === null || typeof json !== "object") {
    return { code: null, reason: null };
  }
  const record = json as Record<string, unknown>;
  const error = record.error;
  const errorCode =
    error !== null && typeof error === "object"
      ? (error as Record<string, unknown>).code
      : null;
  const code =
    safeCode(errorCode) ?? safeCode(record.code) ?? safeCode(record.reason);
  const reason = safeCode(record.reason) ?? code;
  return { code, reason };
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
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef<
    ((options?: { readonly silent?: boolean }) => Promise<void>) | null
  >(null);
  const sessionRef = useRef(0);
  const seqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const terminalRef = useRef(false);
  const notifiedRef = useRef(false);
  const postIdRef = useRef(0);
  const activePostRef = useRef<{
    readonly session: number;
    readonly id: number;
  } | null>(null);
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

  const schedulePoll = useCallback(() => {
    clearTimer();
    if (!open) return;
    const session = sessionRef.current;
    timerRef.current = setTimeout(() => {
      if (sessionRef.current !== session) return;
      void loadRef.current?.({ silent: true });
    }, 3000);
  }, [clearTimer, open]);

  const load = useCallback(
    async (options: { readonly silent?: boolean } = {}) => {
      const session = sessionRef.current;
      const seq = ++seqRef.current;
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
        if (controller.signal.aborted || session !== sessionRef.current) return;
        if (seq < appliedSeqRef.current) return;
        if (terminalRef.current && json?.state !== "delivered") return;
        appliedSeqRef.current = seq;
        if (!response.ok || json === null) {
          setFailed(true);
          setDto({ state: "unavailable" });
          clearTimer();
          return;
        }
        setFailed(false);
        setDto(json);
        if (json.state === "delivered") {
          terminalRef.current = true;
          clearTimer();
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            deliveredRef.current();
            closeRef.current();
          }
          return;
        }
        if (json.state === "processing" || json.state === "unknown") {
          schedulePoll();
        } else {
          clearTimer();
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          session !== sessionRef.current ||
          (error as { name?: string }).name === "AbortError"
        ) {
          return;
        }
        if (seq < appliedSeqRef.current || terminalRef.current) return;
        appliedSeqRef.current = seq;
        setFailed(true);
        setDto({ state: "unavailable" });
        clearTimer();
      } finally {
        if (!controller.signal.aborted && session === sessionRef.current) {
          setLoading(false);
        }
      }
    },
    [campaignId, clearTimer, schedulePoll],
  );

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    seqRef.current = 0;
    appliedSeqRef.current = 0;
    terminalRef.current = false;
    notifiedRef.current = false;
    activePostRef.current = null;
    if (!open) {
      abortRef.current?.abort();
      clearTimer();
      setDto(null);
      setLoading(false);
      setSubmitting(false);
      setFailed(false);
      return;
    }
    void loadRef.current?.();
    return () => {
      if (sessionRef.current === session) sessionRef.current += 1;
      abortRef.current?.abort();
      clearTimer();
    };
  }, [open, campaignId, clearTimer]);

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
    if (!open || !dto?.expiresAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, dto?.expiresAt]);

  const submit = useCallback(async () => {
    if (!dto?.confirmationToken) return;
    const session = sessionRef.current;
    const postId = ++postIdRef.current;
    activePostRef.current = { session, id: postId };
    const seq = ++seqRef.current;
    const controller = new AbortController();
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
          signal: controller.signal,
        },
      );
      const json = (await response.json().catch(() => null)) as
        | AdditionDto
        | { error?: { code?: string } }
        | null;
      if (controller.signal.aborted || session !== sessionRef.current) return;
      if (seq < appliedSeqRef.current) return;
      if (terminalRef.current && !(json && "state" in json && json.state === "delivered")) {
        return;
      }
      appliedSeqRef.current = seq;
      if (!response.ok || json === null || !("state" in json)) {
        const rejection = rejectionDetails(json);
        const code = rejection.code ?? "confirmation_failed";
        const reason = rejection.reason ?? code;
        setFailed(true);
        setDto((prev) =>
          prev ? { ...prev, state: "unavailable", code, reason } : prev,
        );
        return;
      }
      const next = json as AdditionDto;
      setDto(next);
      if (next.state === "delivered") {
        terminalRef.current = true;
        clearTimer();
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          deliveredRef.current();
          closeRef.current();
        }
      } else if (next.state === "processing" || next.state === "unknown") {
        schedulePoll();
      } else if (next.state === "eligible") {
        clearTimer();
        void load({ silent: true });
      } else {
        clearTimer();
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        session !== sessionRef.current ||
        (error as { name?: string }).name === "AbortError"
      ) {
        return;
      }
      if (seq < appliedSeqRef.current || terminalRef.current) return;
      appliedSeqRef.current = seq;
      setFailed(true);
      setDto((prev) =>
        prev
          ? {
              ...prev,
              state: "unavailable",
              code: "confirmation_failed",
              reason: "confirmation_failed",
            }
          : prev,
      );
      clearTimer();
    } finally {
      const active = activePostRef.current;
      if (
        active !== null &&
        active.session === session &&
        active.id === postId
      ) {
        activePostRef.current = null;
        setSubmitting(false);
      }
    }
  }, [
    campaignId,
    dto?.confirmationToken,
    load,
    schedulePoll,
    clearTimer,
  ]);

  if (!open) return null;

  const reason = reasonMessage(dto, messages, failed);
  const expiresAtMs = dto?.expiresAt ? Date.parse(dto.expiresAt) : null;
  const expired =
    dto?.state === "eligible" &&
    expiresAtMs !== null &&
    Number.isFinite(expiresAtMs) &&
    now >= expiresAtMs;
  const retryable =
    dto?.state === "refunded" &&
    typeof dto.confirmationToken === "string" &&
    dto.confirmationToken.length > 0 &&
    dto.reason !== "addition_disabled";
  const resumable =
    (dto?.state === "processing" || dto?.state === "unknown") &&
    typeof dto.confirmationToken === "string" &&
    dto.confirmationToken.length > 0;
  const canConfirm =
    dto?.state === "eligible" &&
    !expired &&
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
        data-state={dto?.state ?? undefined}
        data-code={dto?.code ?? undefined}
        data-reason={dto?.reason ?? undefined}
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
            expired ? (
              <p>{messages.conflict.confirmationExpired}</p>
            ) : (
              <p className="font-semibold text-text-primary">{messages.cost}</p>
            )
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
          ) : expired ? (
            <Button
              type="button"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? messages.processing : messages.retry}
            </Button>
          ) : retryable ? (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? messages.processing : messages.retry}
            </Button>
          ) : resumable ? (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? messages.processing : messages.continue}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

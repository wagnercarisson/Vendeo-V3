"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CampaignDetailSquareReleaseMessages } from "@/lib/i18n/campaign-detail/messages";

type ReleaseState =
  | "eligible"
  | "delivered"
  | "refunded"
  | "unknown"
  | "unavailable"
  | "incompatible";

interface ReleaseDto {
  readonly state: ReleaseState;
  readonly costCredits?: number;
  readonly refunded?: boolean;
  readonly reason?: string;
}

export interface ReleaseSquareDialogProps {
  readonly campaignId: string;
  readonly messages: CampaignDetailSquareReleaseMessages;
  readonly locale: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onReleased: () => void;
}

function Spinner({ label }: { readonly label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg
        aria-hidden="true"
        className="h-4 w-4 animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-25"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function stateMessage(
  dto: ReleaseDto,
  messages: CampaignDetailSquareReleaseMessages,
): string {
  switch (dto.state) {
    case "delivered":
      return messages.delivered;
    case "refunded":
      return messages.refunded;
    case "unknown":
      return messages.unknown;
    case "incompatible":
      return messages.incompatible;
    case "unavailable":
      return dto.reason === "insufficient_credits"
        ? messages.insufficientCredits
        : messages.unavailable;
    case "eligible":
      return messages.cost;
  }
}

/**
 * Quick 261124-pmo — liberação paga do quadrado 1:1 já armazenado.
 *
 * Consulta, confirmação e operação têm mensagens distintas. Não há geração de
 * IA: a operação apenas registra a dedução e libera o artefato existente.
 */
export function ReleaseSquareDialog({
  campaignId,
  messages,
  locale,
  open,
  onClose,
  onReleased,
}: ReleaseSquareDialogProps) {
  const [dto, setDto] = useState<ReleaseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(0);
  const busyRef = useRef(false);
  const releasedRef = useRef(onReleased);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `square-release-title-${campaignId}`;
  const descriptionId = `square-release-description-${campaignId}`;

  const requestClose = useCallback(() => {
    if (busyRef.current) return;
    onClose();
  }, [onClose]);

  useEffect(() => {
    releasedRef.current = onReleased;
  }, [onReleased]);

  const load = useCallback(async () => {
    const session = sessionRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/campaign/${campaignId}/square-release`,
        {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        },
      );
      const json = (await response.json().catch(() => null)) as
        | ReleaseDto
        | null;
      if (controller.signal.aborted || session !== sessionRef.current) return;
      if (!response.ok || json === null) {
        setFailed(true);
        setDto({ state: "unknown" });
        return;
      }
      setFailed(false);
      setDto(json);
    } catch (error) {
      if (
        controller.signal.aborted ||
        session !== sessionRef.current ||
        (error as { name?: string }).name === "AbortError"
      ) {
        return;
      }
      setFailed(true);
      setDto({ state: "unknown" });
    } finally {
      if (!controller.signal.aborted && session === sessionRef.current) {
        setLoading(false);
      }
    }
  }, [campaignId]);

  useEffect(() => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    if (!open) {
      abortRef.current?.abort();
      setDto(null);
      setLoading(false);
      setSubmitting(false);
      setFailed(false);
      return;
    }
    void load();
    return () => {
      if (sessionRef.current === session) sessionRef.current += 1;
      abortRef.current?.abort();
    };
  }, [open, campaignId, load]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const submit = useCallback(async () => {
    if (!dto || dto.state !== "eligible") return;
    const session = sessionRef.current;
    const controller = new AbortController();
    setSubmitting(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/campaign/${campaignId}/square-release`,
        {
          method: "POST",
          signal: controller.signal,
        },
      );
      const json = (await response.json().catch(() => null)) as
        | ReleaseDto
        | null;
      if (session !== sessionRef.current) return;
      if (!response.ok || json === null) {
        setFailed(true);
        setDto({ state: "unknown" });
        return;
      }
      setDto(json);
      if (json.state === "delivered") {
        releasedRef.current();
      }
    } catch (error) {
      if (session !== sessionRef.current) return;
      if ((error as { name?: string }).name === "AbortError") return;
      setFailed(true);
      setDto({ state: "unknown" });
    } finally {
      if (session === sessionRef.current) setSubmitting(false);
    }
  }, [campaignId, dto]);

  if (!open) return null;

  const checking = loading && dto === null;
  const busy = submitting;
  busyRef.current = busy;
  const canConfirm =
    dto?.state === "eligible" && dto.costCredits === 1 && !submitting;
  const canRetry =
    !submitting &&
    !loading &&
    (dto?.state === "unknown" || dto?.state === "unavailable");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        lang={locale === "es-419" ? "es-419" : undefined}
        data-state={dto?.state ?? undefined}
        data-submitting={submitting ? "true" : "false"}
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
          {messages.description}
        </p>

        <div aria-live="polite" className="mt-3 text-sm font-body">
          {checking ? (
            <div className="flex items-center gap-2">
              <Spinner label={messages.checking} />
              <p className="text-text-secondary">{messages.checking}</p>
            </div>
          ) : busy ? (
            <div className="flex items-start gap-2">
              <Spinner label={messages.processing} />
              <p className="font-semibold text-text-primary">
                {messages.processing}
              </p>
            </div>
          ) : dto ? (
            <p
              className={
                dto.state === "eligible"
                  ? "font-semibold text-text-primary"
                  : undefined
              }
            >
              {stateMessage(dto, messages)}
            </p>
          ) : failed ? (
            <p>{messages.unknown}</p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={requestClose}
            disabled={busy}
          >
            {messages.cancel}
          </Button>
          {canConfirm ? (
            <Button type="button" onClick={submit} disabled={submitting}>
              {messages.confirm}
            </Button>
          ) : canRetry ? (
            <Button type="button" onClick={() => void load()} disabled={loading}>
              {loading ? messages.checking : messages.retry}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

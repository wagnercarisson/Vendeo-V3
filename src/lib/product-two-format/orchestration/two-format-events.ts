import type { TwoFormatFormat } from "../types";

/**
 * Contrato NDJSON do caminho conjunto (C1).
 *
 * `responseTerminal` marca o encerramento da RESPOSTA; `operationTerminal`
 * marca o desfecho da OPERAÇÃO. Uma resposta `processing` pode encerrar a
 * invocação com a operação ainda não terminal — sem inventar `result`.
 */
export type TwoFormatFormatState =
  | "delivered"
  | "processing"
  | "absent"
  | "unknown"
  | "unavailable";

export type TwoFormatNextStep =
  | "base"
  | "expansion"
  | "square_delivery"
  | "delivery"
  | null;

export type TwoFormatPhase =
  | "square_base"
  | "square_delivery"
  | "vertical_preparation"
  | "vertical_expansion"
  | "vertical_delivery"
  | "projection";

export type TwoFormatPhaseStatus = "running" | "complete" | "failed" | "skipped";

export interface TwoFormatFormatStatus {
  readonly state: TwoFormatFormatState;
  readonly deliveryOperationId: string | null;
}

export interface TwoFormatStatusSnapshot {
  readonly campaignStatus: string;
  readonly formats: Readonly<Record<TwoFormatFormat, TwoFormatFormatStatus>>;
  readonly preferredFormat: TwoFormatFormat | null;
  readonly nextStep: TwoFormatNextStep;
  readonly canContinue: boolean;
  readonly operationTerminal: boolean;
}

export type TwoFormatEvent =
  | {
      readonly type: "phase";
      readonly campaignId: string;
      readonly operationId: string;
      readonly phase: TwoFormatPhase;
      readonly status: TwoFormatPhaseStatus;
      readonly message?: string;
    }
  | {
      readonly type: "processing";
      readonly campaignId: string;
      readonly operationId: string;
      readonly responseTerminal: true;
      readonly operationTerminal: false;
      readonly state: string;
      readonly nextStep: TwoFormatNextStep;
      readonly canContinue: boolean;
      readonly formats: Readonly<Record<TwoFormatFormat, TwoFormatFormatStatus>>;
      readonly preferredFormat: TwoFormatFormat | null;
    }
  | {
      readonly type: "result";
      readonly campaignId: string;
      readonly operationId: string;
      readonly responseTerminal: true;
      readonly operationTerminal: boolean;
      readonly campaignUrl: string;
      readonly formats: Readonly<Record<TwoFormatFormat, TwoFormatFormatStatus>>;
      readonly preferredFormat: TwoFormatFormat | null;
      readonly partial: boolean;
    }
  | {
      readonly type: "error";
      readonly campaignId: string;
      readonly operationId: string;
      readonly responseTerminal: true;
      readonly operationTerminal: boolean;
      readonly code: string;
      readonly message: string;
      readonly format?: TwoFormatFormat;
      readonly refunded?: boolean;
    }
  | {
      readonly type: "unknown";
      readonly campaignId: string;
      readonly operationId: string;
      readonly responseTerminal: true;
      readonly operationTerminal: false;
      readonly reference: string;
    };

export function isTwoFormatTerminal(event: TwoFormatEvent): boolean {
  return event.type !== "phase";
}

export function isTwoFormatResponseTerminal(
  event: TwoFormatEvent,
): event is Exclude<TwoFormatEvent, { type: "phase" }> {
  return event.type !== "phase";
}

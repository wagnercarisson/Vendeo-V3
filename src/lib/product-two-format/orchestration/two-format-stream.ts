import "server-only";

import type {
  TwoFormatEvent,
  TwoFormatPhase,
  TwoFormatPhaseStatus,
} from "./two-format-events";

export interface TwoFormatStream {
  readonly response: Response;
  readonly emitPhase: (
    phase: TwoFormatPhase,
    status: TwoFormatPhaseStatus,
    message?: string,
  ) => void;
  readonly emit: (event: TwoFormatEvent) => void;
  readonly emitTerminal: (event: TwoFormatEvent) => void;
  readonly terminalSent: () => boolean;
  readonly start: (work: () => Promise<void>) => void;
  readonly done: Promise<void>;
}

/**
 * Stream NDJSON do caminho conjunto. Mesmo contrato operacional do stream
 * 9:16: um único terminal, fases `running` fechadas no terminal e exceção não
 * tratada convertida em `unknown` seguro.
 */
export function createTwoFormatStream(input: {
  campaignId: string;
  operationId: string;
}): TwoFormatStream {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let terminal = false;
  let started = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const phases = new Map<TwoFormatPhase, TwoFormatPhaseStatus>();

  const write = (event: TwoFormatEvent): void => {
    if (closed || controllerRef === null) return;
    try {
      controllerRef.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      closed = true;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      closed = true;
      resolveDone();
    },
  });

  const emit = (event: TwoFormatEvent): void => {
    if (terminal) return;
    write(event);
  };

  const emitPhase: TwoFormatStream["emitPhase"] = (phase, status, message) => {
    if (terminal) return;
    phases.set(phase, status);
    write({
      type: "phase",
      campaignId: input.campaignId,
      operationId: input.operationId,
      phase,
      status,
      ...(message === undefined ? {} : { message }),
    });
  };

  const emitTerminal: TwoFormatStream["emitTerminal"] = (event) => {
    if (terminal) return;
    if (event.type === "phase") return;
    terminal = true;
    for (const [phase, status] of phases) {
      if (status === "running") {
        write({
          type: "phase",
          campaignId: input.campaignId,
          operationId: input.operationId,
          phase,
          status: event.type === "error" ? "failed" : "skipped",
        });
      }
    }
    write(event);
    closed = true;
    try {
      controllerRef?.close();
    } catch {
      // already closed
    }
    resolveDone();
  };

  const safeUnknown = (): TwoFormatEvent => ({
    type: "unknown",
    campaignId: input.campaignId,
    operationId: input.operationId,
    responseTerminal: true,
    operationTerminal: false,
    reference: input.operationId,
  });

  const start: TwoFormatStream["start"] = (work) => {
    if (started) return;
    started = true;
    void Promise.resolve()
      .then(work)
      .catch(() => {
        if (!terminal) emitTerminal(safeUnknown());
      })
      .finally(() => {
        if (!terminal) emitTerminal(safeUnknown());
        resolveDone();
      });
  };

  return {
    response: new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }),
    emitPhase,
    emit,
    emitTerminal,
    terminalSent: () => terminal,
    start,
    done,
  };
}

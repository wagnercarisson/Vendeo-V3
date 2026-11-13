import "server-only";

import type { NineSixteenEvent, NineSixteenPhase } from "./types";

export interface NineSixteenStream {
  readonly response: Response;
  readonly emitPhase: (
    phase: NineSixteenPhase,
    status: "running" | "complete" | "failed" | "skipped",
    message?: string,
  ) => void;
  readonly emit: (event: NineSixteenEvent) => void;
  readonly emitTerminal: (event: NineSixteenEvent) => void;
  readonly terminalSent: () => boolean;
  /**
   * Agenda o trabalho DEPOIS de a `Response` ser devolvida ao chamador, para
   * que as fases cheguem ao cliente enquanto a geracao acontece. Uma excecao
   * nao tratada produz exatamente um terminal seguro (`unknown`), nunca um
   * stream aberto.
   */
  readonly start: (work: () => Promise<void>) => void;
  /** Resolve quando o stream foi encerrado (terminal escrito e controller fechado). */
  readonly done: Promise<void>;
}

export function createNineSixteenStream(input: {
  campaignId: string;
  operationId: string;
}): NineSixteenStream {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let terminal = false;
  let started = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const phases = new Map<NineSixteenPhase, "running" | "complete" | "failed" | "skipped">();

  const write = (event: NineSixteenEvent): void => {
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

  const emit = (event: NineSixteenEvent): void => {
    if (terminal) return;
    write(event);
  };

  const emitPhase: NineSixteenStream["emitPhase"] = (phase, status, message) => {
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

  const emitTerminal = (event: NineSixteenEvent): void => {
    if (terminal) return;
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

  const safeUnknown = (): NineSixteenEvent => ({
    type: "unknown",
    campaignId: input.campaignId,
    operationId: input.operationId,
    reference: input.operationId,
  });

  const start: NineSixteenStream["start"] = (work) => {
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

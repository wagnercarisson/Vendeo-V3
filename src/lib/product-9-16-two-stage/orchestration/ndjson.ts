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
}

export function createNineSixteenStream(input: {
  campaignId: string;
  operationId: string;
}): NineSixteenStream {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let terminal = false;
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
  };
}

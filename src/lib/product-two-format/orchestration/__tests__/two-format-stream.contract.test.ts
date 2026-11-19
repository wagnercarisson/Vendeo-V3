import { describe, expect, it } from "vitest";

import { createTwoFormatStream } from "../two-format-stream";
import type { TwoFormatEvent } from "../two-format-events";

function parse(text: string): TwoFormatEvent[] {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TwoFormatEvent);
}

const CAMPAIGN = "11111111-1111-4111-8111-111111111111";
const OPERATION = "22222222-2222-4222-8222-222222222222";

describe("F60.7 C1 — stream/terminal", () => {
  it("processing encerra a resposta sem inventar resultado", async () => {
    const stream = createTwoFormatStream({
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    stream.start(async () => {
      stream.emitPhase("square_base", "running");
      stream.emitTerminal({
        type: "processing",
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        responseTerminal: true,
        operationTerminal: false,
        state: "between_steps",
        nextStep: "expansion",
        canContinue: true,
        formats: {
          "1:1": { state: "processing", deliveryOperationId: null },
          "9:16": { state: "processing", deliveryOperationId: null },
        },
        preferredFormat: null,
      });
    });
    const events = parse(await stream.response.text());
    expect(events.filter((event) => event.type !== "phase")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: "processing",
      responseTerminal: true,
      operationTerminal: false,
      nextStep: "expansion",
    });
    expect(events.some((event) => event.type === "result")).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "phase",
        phase: "square_base",
        status: "skipped",
      }),
    );
    expect(stream.terminalSent()).toBe(true);
  });

  it("exceção inesperada vira unknown único", async () => {
    const stream = createTwoFormatStream({
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    stream.start(async () => {
      stream.emitPhase("vertical_expansion", "running");
      throw new Error("boom");
    });
    const events = parse(await stream.response.text());
    const terminals = events.filter((event) => event.type !== "phase");
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toMatchObject({
      type: "unknown",
      responseTerminal: true,
      operationTerminal: false,
    });
  });
});

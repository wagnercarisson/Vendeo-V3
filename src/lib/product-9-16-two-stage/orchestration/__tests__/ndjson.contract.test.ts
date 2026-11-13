// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createNineSixteenStream } from "../ndjson";

function parseLines(text: string): Array<Record<string, unknown>> {
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function terminalLines(lines: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return lines.filter((event) =>
    ["result", "error", "unknown", "processing"].includes(String(event.type)),
  );
}

describe("ndjson", () => {
  it("emits exactly one terminal and includes identity", async () => {
    const stream = createNineSixteenStream({ campaignId: "c", operationId: "o" });
    stream.emitPhase("campaign_base", "running");
    stream.emitTerminal({
      type: "result",
      campaignId: "c",
      operationId: "o",
      campaignUrl: "/campanhas/c",
    });
    stream.emitTerminal({
      type: "unknown",
      campaignId: "c",
      operationId: "o",
      reference: "late",
    });
    const lines = parseLines(await stream.response.text());
    expect(terminalLines(lines)).toHaveLength(1);
    expect(lines.at(-1)).toMatchObject({ type: "result", campaignId: "c", operationId: "o" });
  });

  it("delivers progress before the work finishes", async () => {
    const stream = createNineSixteenStream({ campaignId: "c", operationId: "o" });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stream.start(async () => {
      stream.emitPhase("campaign_base", "running");
      await gate;
      stream.emitTerminal({
        type: "result",
        campaignId: "c",
        operationId: "o",
        campaignUrl: "/campanhas/c",
      });
    });

    const reader = stream.response.body?.getReader();
    if (!reader) throw new Error("missing body");
    const decoder = new TextDecoder();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(decoder.decode(first.value)).toContain('"phase":"campaign_base"');
    expect(stream.terminalSent()).toBe(false);

    release();
    let rest = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += decoder.decode(chunk.value);
    }
    expect(rest).toContain('"type":"result"');
    await stream.done;
  });

  it("turns an unhandled exception into a single safe terminal", async () => {
    const stream = createNineSixteenStream({ campaignId: "c", operationId: "o" });
    stream.start(async () => {
      stream.emitPhase("campaign_base", "running");
      throw new Error("boom");
    });
    const lines = parseLines(await stream.response.text());
    expect(terminalLines(lines)).toHaveLength(1);
    expect(terminalLines(lines)[0]).toMatchObject({ type: "unknown", operationId: "o" });
    await stream.done;
  });
});

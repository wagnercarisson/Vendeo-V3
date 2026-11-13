// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createNineSixteenStream } from "../ndjson";

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
    const text = await stream.response.text();
    const lines = text.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.filter((event) => ["result", "error", "unknown", "processing"].includes(event.type))).toHaveLength(1);
    expect(lines.at(-1)).toMatchObject({ type: "result", campaignId: "c", operationId: "o" });
  });
});

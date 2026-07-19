import { vi, describe, it, expect, beforeEach } from "vitest";
import { logPipelineEvent } from "../pipeline-logger";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("logPipelineEvent", () => {
  it("emits JSON with required fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const event = {
      event: "test_event",
      traceId: "abc-123",
      phase: "pre_stream",
      status: "running",
    };
    logPipelineEvent(event);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.event).toBe("test_event");
    expect(parsed.traceId).toBe("abc-123");
    expect(parsed.phase).toBe("pre_stream");
    expect(parsed.status).toBe("running");
  });

  it("redacts base64 strings in metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logPipelineEvent({
      event: "test",
      traceId: "abc",
      phase: "build",
      status: "complete",
      metadata: {
        image: "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL",
      },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.metadata.image).toBe("[REDACTED]");
  });

  it("redacts keys matching prompt (case insensitive)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logPipelineEvent({
      event: "test",
      traceId: "abc",
      phase: "build",
      status: "complete",
      metadata: {
        prompt: "this is a system prompt",
        Prompt: "another prompt",
        otherKey: "keep this",
      },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.metadata.prompt).toBe("[REDACTED]");
    expect(parsed.metadata.Prompt).toBe("[REDACTED]");
    expect(parsed.metadata.otherKey).toBe("keep this");
  });

  it("handles internal errors silently (fire-and-forget)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("mock console error");
    });
    expect(() => {
      logPipelineEvent({
        event: "test",
        traceId: "abc",
        phase: "build",
        status: "complete",
      });
    }).not.toThrow();
  });
});

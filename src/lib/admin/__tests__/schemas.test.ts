import { describe, expect, it } from "vitest";
import { AiModelSelectionResetSchema, AiModelSelectionUpdateSchema } from "../schemas";

const operationId = "00000000-0000-0000-0000-000000000001";
const primary = { provider: "openai" as const, model: "gpt-4o", protocol: "chat-completions" as const };

describe("AI model selection schemas", () => {
  it("accepts strict PUT with campaign_copy fallback", () => {
    expect(AiModelSelectionUpdateSchema.parse({
      capability: "campaign_copy",
      ...primary,
      fallback: { provider: "gemini", model: "gemini-3.1-flash-lite", protocol: "gemini" },
      reason: "troca operacional",
      operationId,
    }).operationId).toBe(operationId);
  });

  it("rejects fallback partial, unsupported and equal primary", () => {
    const base = { capability: "campaign_copy", ...primary, reason: "x", operationId };
    expect(AiModelSelectionUpdateSchema.safeParse({ ...base, fallback: { provider: "gemini" } }).success).toBe(false);
    expect(AiModelSelectionUpdateSchema.safeParse({ ...base, capability: "campaign_image", fallback: { provider: "gemini", model: "gemini-3.1-flash-lite", protocol: "gemini" } }).success).toBe(false);
    expect(AiModelSelectionUpdateSchema.safeParse({ ...base, fallback: primary }).success).toBe(false);
  });

  it("DELETE exige exatamente capability, reason e operationId UUID", () => {
    expect(AiModelSelectionResetSchema.safeParse({ capability: "campaign_copy", reason: "restaurar", operationId }).success).toBe(true);
    expect(AiModelSelectionResetSchema.safeParse({ capability: "campaign_copy", reason: "restaurar" }).success).toBe(false);
    expect(AiModelSelectionResetSchema.safeParse({ capability: "campaign_copy", reason: "restaurar", operationId, extra: true }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPAND_9_16_PROMPT,
  EXPAND_9_16_PROMPT_VERSION,
} from "../domain/expand-prompt";
import { BenchExpandRunInputSchema, parseBenchExpandRunInput } from "../domain/expand-schema";

/**
 * Contrato puro da operação de expansão (quick 261107-qvo):
 * prompt próprio, uma única referência e nenhuma dependência comercial.
 */

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const BASE = {
  operationId: "22222222-2222-4222-8222-222222222222",
  runId: RUN_ID,
  storeId: "33333333-3333-4333-8333-333333333333",
  presetId: "gpt-image-2.5-sunburst-medium",
  promptApproved: DEFAULT_EXPAND_9_16_PROMPT,
  references: [`bench/${RUN_ID}/inputs/0.jpg`],
  confirmed: true as const,
  promptVersion: EXPAND_9_16_PROMPT_VERSION,
};

describe("expand-prompt — baseline próprio", () => {
  it("tem versão estável e texto de expansão sem instruções comerciais", () => {
    expect(EXPAND_9_16_PROMPT_VERSION).toBe("261107-expand-9-16-v1");
    expect(DEFAULT_EXPAND_9_16_PROMPT).toContain("Amplie o quadro para 9:16");
    expect(DEFAULT_EXPAND_9_16_PROMPT).toContain("sem emendas visíveis");
    expect(DEFAULT_EXPAND_9_16_PROMPT.toLowerCase()).not.toContain("preço");
    expect(DEFAULT_EXPAND_9_16_PROMPT.toLowerCase()).not.toContain("selo");
  });
});

describe("expand-schema — exatamente uma imagem e prompt aprovado", () => {
  it("aceita o contrato canônico", () => {
    expect(parseBenchExpandRunInput(BASE)).toMatchObject({
      runId: RUN_ID,
      references: [`bench/${RUN_ID}/inputs/0.jpg`],
      promptApproved: DEFAULT_EXPAND_9_16_PROMPT,
    });
  });

  it("recusa zero ou duas referências", () => {
    expect(BenchExpandRunInputSchema.safeParse({ ...BASE, references: [] }).success).toBe(false);
    expect(
      BenchExpandRunInputSchema.safeParse({
        ...BASE,
        references: [`bench/${RUN_ID}/inputs/0.jpg`, `bench/${RUN_ID}/inputs/1.jpg`],
      }).success,
    ).toBe(false);
  });

  it("recusa path fora do próprio run ou com traversal", () => {
    for (const reference of [
      "bench/other/inputs/0.jpg",
      `bench/${RUN_ID}/inputs/../0.jpg`,
      `bench/${RUN_ID}/inputs/0.jpg?x=1`,
      "https://example.com/a.png",
    ]) {
      expect(
        BenchExpandRunInputSchema.safeParse({ ...BASE, references: [reference] }).success,
        reference,
      ).toBe(false);
    }
  });

  it("recusa promptApproved vazio e confirmação diferente de true", () => {
    expect(
      BenchExpandRunInputSchema.safeParse({ ...BASE, promptApproved: "" }).success,
    ).toBe(false);
    expect(
      BenchExpandRunInputSchema.safeParse({ ...BASE, confirmed: false }).success,
    ).toBe(false);
  });
});

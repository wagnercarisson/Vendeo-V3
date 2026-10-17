import { describe, it, expect, vi } from "vitest";
import { AiGateway } from "../gateway";
import type { AiModelResolver, AiModelTarget } from "../model-resolver";

/**
 * Quick gpt6-luna — pinning do alvo (aditivo). Garante que a invocação PREPARADA
 * usa o alvo resolvido no momento da preparação, MESMO se a seleção mudar antes
 * de executar (o admin trocar a seleção não altera uma chamada já preparada).
 */
function target(provider: string, model: string): AiModelTarget {
  return { provider, model, protocol: "chat-completions" } as AiModelTarget;
}

describe("AiGateway — invocação preparada (pinning)", () => {
  it("prepara com Luna, muda a seleção para GPT-4o e executa: usa Luna; a próxima usa GPT-4o", async () => {
    const seen: string[] = [];
    let currentModel = "gpt-6-luna";
    const resolver: AiModelResolver = {
      resolve: vi.fn(async () => ({ primary: target("openai", currentModel) } as never)),
    } as never;

    const adapter = {
      protocol: "chat-completions" as const,
      invoke: vi.fn(async (_req: unknown, t: AiModelTarget) => {
        seen.push(t.model);
        return { content: "ok", model: t.model } as never;
      }),
    };
    const adapters = { get: () => adapter } as never;
    const telemetry = { sink: { emit: vi.fn(async () => {}) }, attemptNumber: 1 } as never;

    const gateway = new AiGateway(resolver, adapters);

    const prepared = await gateway.prepare("campaign_copy", "primary");
    expect(prepared.model).toBe("gpt-6-luna");

    // Admin troca a seleção ANTES de executar a chamada preparada
    currentModel = "gpt-4o";
    await gateway.invokePrepared(prepared, {} as never, telemetry);
    expect(seen.at(-1)).toBe("gpt-6-luna"); // a chamada preparada continua Luna

    // A PRÓXIMA chamada usa a nova seleção
    await gateway.invoke("campaign_copy", {} as never, telemetry);
    expect(seen.at(-1)).toBe("gpt-4o");
  });
});

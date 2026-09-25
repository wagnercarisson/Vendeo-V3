// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createExperiment } from "../domain/experiment-service";
import { remainingUsd } from "../domain/program-service";
import { DIRECTOR_PROMPTS, buildCandidatePromptSnapshot } from "../domain/prompt-snapshot";
import {
  CreateLabExperimentInputSchema,
  UnsupportedChangedDimensionError,
  parseCreateLabExperimentInput,
} from "../domain/schemas";
import type { CampaignIntent, CreateLabExperimentInput } from "../domain/schemas";
import {
  computeExperimentOutcome,
  computeScenarioOutcome,
  isScenarioCritical,
  pickSimplerVariant,
} from "../domain/victory-rule";

/**
 * Contrato de otimização dos prompts do Diretor (F48.2.1, D4/D6/D9).
 *
 * Cobre: allowlist dos três prompts do Diretor, `campaignIntent`/`programId`
 * obrigatórios, prompt derivado do intent, recusa de intents mistos, rejeição de
 * dimensões `model`/`configuration` e o saldo restante do programa. Nenhuma rede,
 * nenhuma chamada paga e nenhuma imagem real.
 */

const ACTOR_ID = "99999999-9999-4999-8999-999999999999";
const SCENARIO_A = "11111111-1111-4111-8111-111111111111";
const SCENARIO_B = "22222222-2222-4222-8222-222222222222";
const PROGRAM_ID = "77777777-7777-4777-8777-777777777777";

const ACTIVE_TARGET = { provider: "openai", model: "gpt-5.5", protocol: "responses" } as const;

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Prompt enxuto vs atual",
    objective: "Reduzir redundância sem perder fidelidade",
    hypothesis: "Um prompt mais curto mantém a qualidade da arte",
    changedDimension: "prompt",
    campaignIntent: "offer",
    programId: PROGRAM_ID,
    modelTarget: { ...ACTIVE_TARGET },
    params: { size: "1024x1024", quality: "high", skipInputValidation: true },
    repetitions: 1,
    maxRuns: 6,
    scenarioVersionIds: [SCENARIO_A],
    baseline: { promptName: DIRECTOR_PROMPTS.offer },
    candidate: { promptName: DIRECTOR_PROMPTS.offer, promptContent: "# Candidata enxuta" },
    ...overrides,
  };
}

// ─── (1) Allowlist dos três prompts do Diretor ───────────────────────────────

describe("DIRECTOR_PROMPTS — allowlist dos três prompts do Diretor", () => {
  it("expõe exatamente offer/spotlight/exclusive", () => {
    expect(Object.keys(DIRECTOR_PROMPTS).sort()).toEqual(["exclusive", "offer", "spotlight"]);
    expect(DIRECTOR_PROMPTS.offer).toBe("campaign-image-director-offer");
    expect(DIRECTOR_PROMPTS.spotlight).toBe("campaign-image-director-spotlight");
    expect(DIRECTOR_PROMPTS.exclusive).toBe("campaign-image-director-exclusive");
  });

  it("aceita candidata para cada um dos três intents", () => {
    for (const intent of ["offer", "spotlight", "exclusive"] as const) {
      const snapshot = buildCandidatePromptSnapshot({
        campaignIntent: intent,
        promptName: DIRECTOR_PROMPTS[intent],
        promptContent: `# Candidata ${intent}`,
      });
      expect(snapshot.name).toBe(DIRECTOR_PROMPTS[intent]);
    }
  });

  it("recusa um quarto prompt/intent com unsupported_prompt_under_test", () => {
    expect(() =>
      buildCandidatePromptSnapshot({
        campaignIntent: "promo" as CampaignIntent,
        promptName: "campaign-image-director-promo",
        promptContent: "# Quarto prompt",
      }),
    ).toThrowError(/unsupported_prompt_under_test:campaign-image-director-promo/);
  });
});

// ─── (2) campaignIntent/programId obrigatórios ───────────────────────────────

describe("criação — campaignIntent e programId são obrigatórios", () => {
  it("aceita a entrada com intent e programa", () => {
    const parsed = parseCreateLabExperimentInput(validInput());
    expect(parsed.campaignIntent).toBe("offer");
    expect(parsed.programId).toBe(PROGRAM_ID);
  });

  it("rejeita payload sem campaignIntent", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).campaignIntent;

    expect(() => parseCreateLabExperimentInput(input)).toThrowError(/campaignIntent/);
  });

  it("rejeita payload sem programId", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).programId;

    expect(() => parseCreateLabExperimentInput(input)).toThrowError(/programId/);
  });
});

// ─── (3) Prompt derivado do intent ───────────────────────────────────────────

describe("prompt derivado do intent", () => {
  it("rejeita prompt divergente do intent com unsupported_prompt_under_test", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({
        campaignIntent: "offer",
        candidate: {
          promptName: DIRECTOR_PROMPTS.spotlight,
          promptContent: "# Candidata",
        },
      }),
    );

    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("unsupported_prompt_under_test");
  });

  it("aceita spotlight quando o intent é spotlight", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({
        campaignIntent: "spotlight",
        baseline: { promptName: DIRECTOR_PROMPTS.spotlight },
        candidate: { promptName: DIRECTOR_PROMPTS.spotlight, promptContent: "# Candidata" },
      }),
    );

    expect(result.success).toBe(true);
  });
});

// ─── (4) Intents mistos entre cenários ───────────────────────────────────────

interface IntentBuilder {
  select: (columns?: string) => IntentBuilder;
  eq: (column: string, value: unknown) => IntentBuilder;
  in: (column: string, values: readonly unknown[]) => IntentBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: <T>(onFulfilled: (value: { data: unknown; error: unknown }) => T) => Promise<T>;
}

class IntentFakeClient {
  readonly rpcCalls: string[] = [];

  constructor(private readonly scenarios: Array<{ id: string; content: Record<string, unknown> }>) {}

  from(table: string): IntentBuilder {
    const builder: IntentBuilder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      maybeSingle: async () => {
        if (table === "ai_model_catalog") {
          return {
            data: { id: "cat", capability: "campaign_image", ...ACTIVE_TARGET, status: "active" },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      then: (onFulfilled) => {
        if (table === "lab_scenario_versions") {
          return Promise.resolve({ data: this.scenarios, error: null }).then(onFulfilled);
        }
        return Promise.resolve({ data: [], error: null }).then(onFulfilled);
      },
    };
    return builder;
  }

  async rpc(name: string): Promise<{ data: unknown; error: unknown }> {
    this.rpcCalls.push(name);
    return { data: null, error: { message: "rpc_should_not_be_reached" } };
  }
}

function asClient(fake: IntentFakeClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

describe("intents mistos entre cenários", () => {
  it("recusa cenários com intents diferentes do experimento", async () => {
    const client = new IntentFakeClient([
      { id: SCENARIO_A, content: { intent: "offer" } },
      { id: SCENARIO_B, content: { intent: "spotlight" } },
    ]);

    await expect(
      createExperiment(
        validInput({ scenarioVersionIds: [SCENARIO_A, SCENARIO_B] }) as unknown as CreateLabExperimentInput,
        { actorId: ACTOR_ID, client: asClient(client) },
      ),
    ).rejects.toThrowError(/intent_mismatch/);

    expect(client.rpcCalls).not.toContain("lab_create_experiment");
  });

  it("aceita cenários que compartilham o intent (segue para a RPC)", async () => {
    const client = new IntentFakeClient([
      { id: SCENARIO_A, content: { intent: "offer" } },
      { id: SCENARIO_B, content: { intent: "offer" } },
    ]);

    await createExperiment(
      validInput({ scenarioVersionIds: [SCENARIO_A, SCENARIO_B] }) as unknown as CreateLabExperimentInput,
      { actorId: ACTOR_ID, client: asClient(client) },
    ).catch(() => undefined);

    expect(client.rpcCalls).toContain("lab_create_experiment");
  });
});

// ─── (5) Dimensões model/configuration seguem rejeitadas ─────────────────────

describe("changed_dimension model/configuration", () => {
  it("rejeita model com unsupported_changed_dimension", () => {
    let caught: unknown = null;
    try {
      parseCreateLabExperimentInput(validInput({ changedDimension: "model" }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(UnsupportedChangedDimensionError);
    expect((caught as UnsupportedChangedDimensionError).code).toBe("unsupported_changed_dimension");
  });

  it("rejeita configuration com unsupported_changed_dimension", () => {
    expect(() =>
      parseCreateLabExperimentInput(validInput({ changedDimension: "configuration" })),
    ).toThrowError(UnsupportedChangedDimensionError);
  });
});

// ─── (6) Saldo restante do programa ──────────────────────────────────────────

describe("remainingUsd — saldo restante do programa", () => {
  it("é budget_usd - budget_consumed_usd - budget_reserved_usd", () => {
    expect(
      remainingUsd({ budget_usd: 10, budget_consumed_usd: 3, budget_reserved_usd: 2 }),
    ).toBe(5);
  });

  it("devolve null quando o orçamento não foi autorizado", () => {
    expect(
      remainingUsd({ budget_usd: null, budget_consumed_usd: 0, budget_reserved_usd: 0 }),
    ).toBeNull();
  });

  it("não fica negativo quando reservado + consumido excedem o teto", () => {
    expect(
      remainingUsd({ budget_usd: 5, budget_consumed_usd: 4, budget_reserved_usd: 2 }),
    ).toBe(-1);
  });
});

// ─── (7) Regra de vitória determinística (D8) ────────────────────────────────

describe("computeScenarioOutcome — moda das repetições", () => {
  it("devolve a moda quando há maioria simples", () => {
    expect(computeScenarioOutcome(["candidate", "candidate"])).toBe("candidate");
    expect(computeScenarioOutcome(["baseline", "baseline"])).toBe("baseline");
    expect(computeScenarioOutcome(["tie", "candidate", "candidate"])).toBe("candidate");
  });

  it("devolve inconclusive quando não há maioria estrita", () => {
    expect(computeScenarioOutcome(["candidate", "tie"])).toBe("inconclusive");
    expect(computeScenarioOutcome(["baseline", "candidate"])).toBe("inconclusive");
    expect(computeScenarioOutcome([])).toBe("inconclusive");
  });

  it("devolve none quando a própria moda é none", () => {
    expect(computeScenarioOutcome(["none", "none"])).toBe("none");
    expect(computeScenarioOutcome(["none", "candidate", "none"])).toBe("none");
  });
});

describe("isScenarioCritical — qualquer none torna o item crítico", () => {
  it("marca crítico quando qualquer repetição é none", () => {
    expect(isScenarioCritical(["candidate", "none"])).toBe(true);
    expect(isScenarioCritical(["none"])).toBe(true);
  });

  it("não marca crítico sem nenhum none", () => {
    expect(isScenarioCritical(["candidate", "candidate"])).toBe(false);
    expect(isScenarioCritical(["tie", "baseline"])).toBe(false);
    expect(isScenarioCritical([])).toBe(false);
  });
});

describe("computeExperimentOutcome — recomendação sem regressão", () => {
  it("recomenda quando todos os cenários terminam em candidate/tie com ao menos um candidate", () => {
    expect(computeExperimentOutcome(["candidate", "tie", "candidate"])).toBe("recommended");
    expect(computeExperimentOutcome(["candidate", "candidate"])).toBe("recommended");
  });

  it("não recomenda quando só há tie (sem nenhum candidate)", () => {
    expect(computeExperimentOutcome(["tie", "tie"])).toBe("not_recommended");
  });

  it("não recomenda com regressão baseline/none", () => {
    expect(computeExperimentOutcome(["candidate", "baseline"])).toBe("not_recommended");
    expect(computeExperimentOutcome(["candidate", "none"])).toBe("not_recommended");
  });

  it("não recomenda com cenário inconclusive", () => {
    expect(computeExperimentOutcome(["candidate", "inconclusive"])).toBe("not_recommended");
  });

  it("devolve inconclusive quando nenhum cenário tem maioria e não há regressão", () => {
    expect(computeExperimentOutcome(["inconclusive", "inconclusive"])).toBe("inconclusive");
    expect(computeExperimentOutcome([])).toBe("inconclusive");
  });
});

describe("pickSimplerVariant — desempate pela variante mais curta", () => {
  it("vence a candidata quando ela é mais curta em empate de qualidade", () => {
    const pick = pickSimplerVariant({
      baselineSize: 2400,
      candidateSize: 2000,
      qualityEqual: true,
    });
    expect(pick.winner).toBe("candidate");
    expect(pick.sizeDelta).toBe(-400);
    expect(pick.justification).toMatch(/candidata/);
  });

  it("vence o baseline quando ele é mais curto em empate de qualidade", () => {
    const pick = pickSimplerVariant({
      baselineSize: 1800,
      candidateSize: 2100,
      qualityEqual: true,
    });
    expect(pick.winner).toBe("baseline");
    expect(pick.sizeDelta).toBe(300);
  });

  it("mantém o baseline quando os tamanhos são iguais", () => {
    const pick = pickSimplerVariant({
      baselineSize: 2000,
      candidateSize: 2000,
      qualityEqual: true,
    });
    expect(pick.winner).toBe("baseline");
    expect(pick.sizeDelta).toBe(0);
  });

  it("não desempata quando a qualidade difere", () => {
    const pick = pickSimplerVariant({
      baselineSize: 2400,
      candidateSize: 1200,
      qualityEqual: false,
    });
    expect(pick.winner).toBeNull();
    expect(pick.sizeDelta).toBe(-1200);
  });
});

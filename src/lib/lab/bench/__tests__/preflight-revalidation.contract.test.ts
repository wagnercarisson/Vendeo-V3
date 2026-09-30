// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

// `buildBenchInvocationRequest` importa o runtime da bancada → registry padrão, que
// pode exigir env na importação. Nenhuma chamada de rede é feita.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import type { AiAdapter, AiInvocationRequest, AiInvocationResult } from "@/lib/ai/types";
import type { AiModelTarget } from "@/lib/ai/model-resolver";
import { createRecordingClient } from "@/lib/lab/__tests__/recording-supabase-client";
import { buildBenchCampaignSnapshot } from "../domain/campaign-snapshot";
import { buildBenchExperimentalBriefing } from "../domain/experimental-briefing";
import { buildBenchInvocationRequest } from "../gateway/runtime";
import { resolveBenchPreset } from "../domain/preset-registry";
import { resolveBenchPromptPolicies } from "../domain/policies/resolve-bench-prompt-policies";
import {
  BenchPreflightRevalidationError,
  assertPreflightCompositionMatches,
  assertPreflightEvidenceMatches,
  recomposeBenchPrompt,
  resolveServerResolvedEvidence,
  type BenchPreflightEvidenceView,
} from "../domain/preflight-revalidation";
import { setBenchRunInput } from "../persistence/bench-run-service";
import type { BenchBrandingContract } from "../domain/branding-service";
import type { BenchIdentityReference } from "../domain/resolve-bench-identity";
import type { BenchConfig, BenchOffer, BenchProduct } from "../domain/schemas";

/**
 * Contrato da **revalidação server-side do preflight** (F48.2.4, D11; spec
 * `lab-bench-prompt-preflight`).
 *
 * Prova, sem nenhuma chamada de rede/IA:
 *  - recomposição determinística (mesma entrada ⇒ mesma saída);
 *  - composição idêntica prossegue; divergente ⇒ `approval_invalidated`;
 *  - **divergência de QUALQUER campo da evidência** (`presetId`, config com
 *    modelo/qualidade/dimensões, `policyVersions`, `promptBaseVersion`,
 *    `composerVersion`, `identityReference`) ⇒ `approval_invalidated`, sem hash
 *    persistido — incluindo troca de asset de logo mantendo `kind=logo`;
 *  - a persistência usa os valores **resolvidos no servidor** (nunca os do cliente);
 *  - `prompt_sent` é **byte a byte** o prompt aprovado (via `RecordingAdapter`).
 */

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";

const CONFIG: BenchConfig = {
  pipeline: "manual-direto",
  formato: "1:1",
  modelo: "gpt-image-2",
  qualidade: "low",
  intencao: "oferta",
  tipoConteudo: "produto",
  estrutura: "peca-unica",
  tema: "nenhum",
};

const LOGO_REF: BenchIdentityReference = {
  kind: "logo",
  variantType: "normalized",
  storagePath: "store-1/logo-normalized.png",
};

const PROMPT_BASE = "Crie uma arte comercial clara e legível.";

function makeBranding(overrides: Partial<BenchBrandingContract> = {}): BenchBrandingContract {
  return {
    storeId: STORE_ID,
    storeName: "Loja Exemplo",
    segment: "moda-calcados-acessorios",
    subsegment: null,
    toneOfVoice: null,
    positioning: null,
    shortDescription: null,
    slogan: null,
    typographyDirection: "Poppins para títulos; Open Sans para textos",
    safeColorTokens: {},
    brandColorsChosen: ["#22C55E"],
    inferredPrimaryColor: null,
    storeBrandColor: null,
    brandColor: "#22C55E",
    logoColorsDetected: [],
    visualStyle: "Minimalista",
    visualTone: "Comercial",
    brandPersonality: "Próxima e confiável",
    campaignGuidelines: "Sempre destacar o preço",
    campaignBrief: "Campanha focada em oferta de moda",
    profileSource: "full",
    profileStatus: "synced",
    logoUrl: null,
    signatureUrl: null,
    identityState: "logo",
    identityReference: null,
    identityReason: "logo:normalized",
    assets: [],
    ...overrides,
  };
}

function makeProduct(overrides: Partial<BenchProduct> = {}): BenchProduct {
  return {
    name: "Camiseta básica",
    description: "100% algodão",
    priceCents: 4990,
    originalPriceCents: 9990,
    mandatoryArtworkText: "Válido para retirada na loja",
    preserveImageContext: false,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<BenchOffer> = {}): BenchOffer {
  return { badge: "50% OFF", validity: "até 31/12/2026", showIllustrativeNotice: true, ...overrides };
}

function makeBriefing() {
  const snapshot = buildBenchCampaignSnapshot({
    product: makeProduct(),
    offer: makeOffer(),
    config: CONFIG,
  });
  return buildBenchExperimentalBriefing({ branding: makeBranding(), snapshot, config: CONFIG });
}

function recompose(config: BenchConfig = CONFIG, identityReference = LOGO_REF) {
  return recomposeBenchPrompt({
    briefing: makeBriefing(),
    promptBase: PROMPT_BASE,
    references: [`bench/${RUN_ID}/inputs/0.png`],
    config,
    identityReference,
  });
}

// ─── Recomposição determinística ─────────────────────────────────────────────

describe("recomposeBenchPrompt — determinismo", () => {
  it("mesma entrada ⇒ mesma saída", () => {
    const first = recompose();
    const second = recompose();
    expect(typeof first.text).toBe("string");
    expect(first.text.length).toBeGreaterThan(0);
    expect(first.text).toBe(second.text);
    expect(first.policyVersions).toEqual(second.policyVersions);
    expect(first.composerVersion).toBe(second.composerVersion);
  });
});

// ─── Composição: idêntica prossegue; divergente ⇒ approval_invalidated ───────

describe("assertPreflightCompositionMatches", () => {
  it("composição idêntica prossegue", () => {
    const { text } = recompose();
    expect(() =>
      assertPreflightCompositionMatches({ recomposed: text, promptCompiled: text }),
    ).not.toThrow();
  });

  it("composição divergente ⇒ approval_invalidated antes da chamada paga", () => {
    const { text } = recompose();
    expect(() =>
      assertPreflightCompositionMatches({ recomposed: text, promptCompiled: `${text} (alterado)` }),
    ).toThrow(BenchPreflightRevalidationError);
    try {
      assertPreflightCompositionMatches({ recomposed: text, promptCompiled: `${text}!` });
    } catch (error) {
      expect((error as BenchPreflightRevalidationError).code).toBe("approval_invalidated");
    }
  });
});

// ─── Evidência: campo a campo, sem hash persistido ───────────────────────────

describe("assertPreflightEvidenceMatches — campo a campo", () => {
  function serverEvidence(): BenchPreflightEvidenceView {
    return resolveServerResolvedEvidence({
      recomposition: recompose(),
      presetId: "gpt-image-2-low",
      config: CONFIG,
      promptBaseVersion: "48.2.4-oferta-1-1-v1",
      identityReference: LOGO_REF,
    });
  }

  it("evidência idêntica prossegue", () => {
    const current = serverEvidence();
    expect(() =>
      assertPreflightEvidenceMatches({ approved: { ...current }, current }),
    ).not.toThrow();
  });

  it("divergência de presetId ⇒ approval_invalidated", () => {
    const current = serverEvidence();
    expect(() =>
      assertPreflightEvidenceMatches({
        approved: { ...current, presetId: "gpt-image-2-medium" },
        current,
      }),
    ).toThrow(BenchPreflightRevalidationError);
  });

  it("divergência de modelo/qualidade (sem alterar o texto) ⇒ approval_invalidated", () => {
    const current = serverEvidence();
    expect(() =>
      assertPreflightEvidenceMatches({
        approved: { ...current, config: { ...CONFIG, modelo: "gpt-image-2.5-flare" } },
        current,
      }),
    ).toThrow(BenchPreflightRevalidationError);
    expect(() =>
      assertPreflightEvidenceMatches({
        approved: { ...current, config: { ...CONFIG, qualidade: "high" } },
        current,
      }),
    ).toThrow(BenchPreflightRevalidationError);
  });

  it("divergência de policyVersions/promptBaseVersion/composerVersion ⇒ approval_invalidated", () => {
    const current = serverEvidence();
    expect(() =>
      assertPreflightEvidenceMatches({
        approved: { ...current, policyVersions: { ...current.policyVersions, intencao: "outra" } },
        current,
      }),
    ).toThrow(BenchPreflightRevalidationError);
    expect(() =>
      assertPreflightEvidenceMatches({
        approved: { ...current, promptBaseVersion: "outra-versao" },
        current,
      }),
    ).toThrow(BenchPreflightRevalidationError);
    expect(() =>
      assertPreflightEvidenceMatches({
        approved: { ...current, composerVersion: "outra-versao" },
        current,
      }),
    ).toThrow(BenchPreflightRevalidationError);
  });

  it("troca do asset de logo mantendo kind=logo ⇒ approval_invalidated", () => {
    const current = serverEvidence();
    expect(() =>
      assertPreflightEvidenceMatches({
        approved: {
          ...current,
          identityReference: { kind: "logo", variantType: "normalized", storagePath: "store-1/logo-OUTRO.png" },
        },
        current,
      }),
    ).toThrow(BenchPreflightRevalidationError);
  });

  it("a comparação é campo a campo, sem hash persistido (fonte)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/preflight-revalidation.ts"),
      "utf8",
    );
    expect(source).not.toContain("createHash");
    expect(source).not.toContain("crypto");
    expect(source).not.toContain("sha256");
  });
});

// ─── Persistência: valores resolvidos no servidor ────────────────────────────

describe("server-resolved-persisted", () => {
  it("a evidência persistida usa as versões resolvidas no servidor, não as do cliente", () => {
    const recomposition = recompose();
    const serverVersions = resolveBenchPromptPolicies(CONFIG).versions;

    // A recomposição carrega as versões resolvidas no servidor.
    expect(recomposition.policyVersions).toEqual(serverVersions);

    const server = resolveServerResolvedEvidence({
      recomposition,
      presetId: "gpt-image-2-low",
      config: CONFIG,
      promptBaseVersion: "48.2.4-oferta-1-1-v1",
      identityReference: LOGO_REF,
    });

    // Evidência do cliente obsoleta (política antiga) ⇒ recusada.
    const staleClient: BenchPreflightEvidenceView = {
      ...server,
      policyVersions: { ...server.policyVersions, intencao: "48.2.3-antiga" },
    };
    expect(() => assertPreflightEvidenceMatches({ approved: staleClient, current: server })).toThrow(
      BenchPreflightRevalidationError,
    );

    // A evidência do servidor corresponde aos valores resolvidos (não aos do cliente).
    expect(server.policyVersions).toEqual(serverVersions);
  });
});

// ─── prompt_sent byte a byte (RecordingAdapter) ──────────────────────────────

class RecordingAdapter implements AiAdapter {
  readonly protocol = "images" as const;
  readonly calls: Array<{ request: AiInvocationRequest; target: AiModelTarget }> = [];
  result: AiInvocationResult = {
    imageBase64: "ZmFrZS1pbWFnZQ==",
    mimeType: "image/png",
    model: "gpt-image-2",
  };
  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    this.calls.push({ request, target });
    return this.result;
  }
}

describe("prompt_sent byte a byte", () => {
  it("o adapter recebe exatamente o texto aprovado, sem transformação", async () => {
    const preset = resolveBenchPreset("gpt-image-2-low");
    const recorder = new RecordingAdapter();
    const approvedPrompt = recompose().text;

    const request = buildBenchInvocationRequest({ preset, prompt: approvedPrompt });
    await recorder.invoke(request, { provider: "openai", model: "gpt-image-2", protocol: "images" });

    expect(recorder.calls).toHaveLength(1);
    const sent = recorder.calls[0].request.prompt;
    expect(sent).toBe(approvedPrompt);
    expect(Buffer.from(sent, "utf8").equals(Buffer.from(approvedPrompt, "utf8"))).toBe(true);
  });

  it("a persistência grava prompt_sent idêntico ao prompt aprovado (byte a byte)", async () => {
    const { client, state } = createRecordingClient({
      lab_bench_runs: [{ id: RUN_ID, operation_id: "op", status: "draft", created_by: "actor" }],
    });
    const approvedPrompt = recompose().text;

    await setBenchRunInput({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      campaignSnapshot: { product: { name: "Produto" } },
      promptBase: PROMPT_BASE,
      promptCompiled: approvedPrompt,
      promptApproved: approvedPrompt,
    });

    const row = (state.tables.lab_bench_runs ?? [])[0];
    expect(row.prompt_sent).toBe(approvedPrompt);
    expect(row.prompt_approved).toBe(approvedPrompt);
    expect(Buffer.from(String(row.prompt_sent), "utf8").equals(Buffer.from(approvedPrompt, "utf8"))).toBe(true);
  });
});

// ─── Pureza (sem IA/rede) ────────────────────────────────────────────────────

describe("módulo puro e sem IA (fonte)", () => {
  it("sem env, rede, provider ou supabase", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/preflight-revalidation.ts"),
      "utf8",
    );
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("generation_events");
    expect(source).toContain("approval_invalidated");
  });
});

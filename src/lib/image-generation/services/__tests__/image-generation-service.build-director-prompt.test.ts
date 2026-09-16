import { describe, it, expect, vi } from "vitest";

// O serviço importa os serviços de visão, que importam `@/lib/ai` (gateway
// default) → sink padrão → tracker → supabase/server. Sem env, lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import { ImageGenerationService } from "../image-generation-service";
import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import {
  createNoopImageProvider,
  LAB_NOOP_IMAGE_PROVIDER_INVOKED,
} from "@/lib/lab/gateway/noop-image-provider";

/**
 * F48.1 (D7/DV-4) — seam aditivo `buildDirectorPrompt`.
 *
 * Prova que o laboratório monta o prompt do diretor pelo caminho REAL
 * (`buildPromptVariables` + `assemblePrompt`) sem duplicar lógica, sem rede e
 * sem invocar o provider de imagem (stub que lança se chamado).
 */

const STORE_ID = "44444444-4444-4444-8444-444444444444";

function createBrief(overrides?: Partial<GenerateImageRequest>): CampaignBrief {
  return buildCampaignBriefFromFlat(
    {
      storeId: STORE_ID,
      productName: "Produto Teste",
      discountedPriceCents: 1990,
      badgeText: "Oferta",
      campaignIntent: "offer",
      productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
      ...overrides,
    } as GenerateImageRequest,
    STORE_ID
  );
}

function createContext(overrides?: Partial<ResolvedCampaignContext>): ResolvedCampaignContext {
  return {
    campaignInput: {
      productName: "Produto Teste",
      discountedPriceCents: 1990,
      productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
      badgeText: "Oferta",
      campaignIntent: "offer",
    },
    store: {
      name: "Loja Teste",
      segment: "outros",
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      brandColor: "#22C55E",
    },
    brandProfile: null,
    identity: { state: "text_only", imageUrl: null, directive: "" },
    ...overrides,
  };
}

function buildLabService(): ImageGenerationService {
  // Provider stub: lança se invocado — prova que a montagem do prompt nunca o usa.
  return new ImageGenerationService(createNoopImageProvider(), new PromptLoader());
}

describe("ImageGenerationService.buildDirectorPrompt (F48.1, D7)", () => {
  it("retorna o prompt do diretor (offer) não vazio, servido pelo loader real", () => {
    const prompt = buildLabService().buildDirectorPrompt(createBrief(), createContext());

    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
    // Conteúdo do template oficial `campaign-image-director-offer.md`.
    expect(prompt).toContain("Diretor de Arte");
    // Placeholders interpolados (nenhum `{{...}}` remanescente das chaves conhecidas).
    expect(prompt).toContain("Loja Teste");
    expect(prompt).not.toContain("{{storeName}}");
    expect(prompt).not.toContain("{{productName}}");
  });

  it("usa effectiveProductName das options quando fornecido", () => {
    const prompt = buildLabService().buildDirectorPrompt(createBrief(), createContext(), {
      effectiveProductName: "Produto Customizado",
    });

    expect(prompt).toContain("Produto Customizado");
  });

  it("usa brief.product.name quando effectiveProductName está ausente", () => {
    const prompt = buildLabService().buildDirectorPrompt(createBrief(), createContext());

    expect(prompt).toContain("Produto Teste");
  });

  it("aceita normalizedInstruction e inclui o bloco de não conformidade (v2)", () => {
    const prompt = buildLabService().buildDirectorPrompt(createBrief(), createContext(), {
      normalizedInstruction: "Eliminar o excesso de texto sobre o preço.",
    });

    expect(prompt).toContain("Ajuste de Não Conformidade (v2)");
    expect(prompt).toContain("Eliminar o excesso de texto sobre o preço.");
    expect(prompt).toContain("<<<INSTRUÇÃO_DE_CORREÇÃO>>>");
  });

  it("sem normalizedInstruction não compõe o bloco de não conformidade", () => {
    const prompt = buildLabService().buildDirectorPrompt(createBrief(), createContext());

    expect(prompt).not.toContain("Ajuste de Não Conformidade (v2)");
  });

  it("repassa inferredCategory para creativeDirectionSection", () => {
    const service = buildLabService();
    const brief = createBrief();
    const context = createContext();

    const semCategoria = service.buildDirectorPrompt(brief, context);
    const comCategoria = service.buildDirectorPrompt(brief, context, { inferredCategory: "moda" });

    expect(comCategoria).not.toBe(semCategoria);
    expect(comCategoria).toContain("moda");
  });

  it("instancia com o provider stub sem invocá-lo (nenhuma chamada de rede)", async () => {
    const provider = createNoopImageProvider();
    const spy = vi.spyOn(provider, "generateImage");

    const service = new ImageGenerationService(provider, new PromptLoader());
    const prompt = service.buildDirectorPrompt(createBrief(), createContext());

    expect(prompt.length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("o provider stub lança lab_noop_image_provider_invoked se for invocado", () => {
    const provider = createNoopImageProvider();

    expect(provider.name).toBe("lab-noop-image-provider");
    expect(() => provider.generateImage({ prompt: "x" })).toThrow(LAB_NOOP_IMAGE_PROVIDER_INVOKED);
  });
});

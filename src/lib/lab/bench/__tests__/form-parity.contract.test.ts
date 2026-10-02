// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// O hook produtivo é importado APENAS para provar paridade dos helpers puros
// (não é editado). `next/navigation` e a preservação de input são mockados para
// permitir o import do módulo cliente em ambiente de teste.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: vi.fn(),
    restoreFormState: vi.fn(),
    clearFormState: vi.fn(),
  }),
}));

import {
  buildValidityDisplayText as prodBuildValidityDisplayText,
  buildMandatoryArtworkText as prodBuildMandatoryArtworkText,
  inferIntent as prodInferIntent,
} from "@/components/flow/use-campaign-form";
import { parseCurrencyBRL } from "@/lib/formatters";
import {
  availableIntents as authoritativeAvailableIntents,
  inferIntent as authoritativeInferIntent,
} from "../domain/intent-options";

import {
  MAX_ADDITIONAL_IMAGES,
  MAX_PRODUCT_IMAGES,
  PRODUCT_IMAGE_MAX_BYTES,
  availableIntents,
  buildMandatoryArtworkText,
  buildValidityDisplayText,
  cleanBadgeForIntent,
  inferIntent,
  isPreserveImageContextAvailable,
  normalizePriceCents,
  resolvePreserveImageContext,
  validateBadge,
  validateImage,
  validateImagesCount,
  validateMandatoryArtworkText,
  validateOriginalPrice,
  validateProductDescription,
  validateProductName,
  type BenchValidityMode,
} from "../domain/form-rules";
import { buildBenchCampaignSnapshot } from "../domain/campaign-snapshot";
import type { BenchConfig, BenchOffer, BenchProduct } from "../domain/schemas";

/**
 * Testes explícitos de paridade do formulário da bancada (F48.2.3, D13/D14).
 *
 * A base OpenSpec `lab-bench-form-parity` exige que a bancada reproduza os
 * campos/comportamentos do formulário produtivo e que a equivalência seja
 * comprovada por testes explícitos. Aqui comparamos os helpers puros replicados
 * em `form-rules.ts` contra os helpers produtivos exportados pelo hook e contra
 * a normalização monetária de `formatters`.
 */

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

// ─── Intenção derivada ───────────────────────────────────────────────────────

describe("paridade — intenção derivada dos preços", () => {
  const MATRIX: Array<[number, number | undefined]> = [
    [0, 0],
    [0, undefined],
    [0, 1000],
    [1000, 0],
    [1000, undefined],
    [1000, 500],
    [1000, 1000],
    [19990, 12990],
    [12990, 12990],
    [500, 1000],
  ];

  it.each(MATRIX)("inferIntent(%s, %s) é idêntico ao produtivo", (original, sale) => {
    expect(inferIntent(original, sale)).toBe(prodInferIntent(original, sale));
  });

  it("opções disponíveis seguem o estado dos preços (espelho do produtivo)", () => {
    expect(availableIntents(1000, 500)).toEqual(["offer"]);
    expect(availableIntents(0, 500)).toEqual(["offer", "spotlight"]);
    expect(availableIntents(0, 0)).toEqual(["spotlight", "exclusive"]);
  });

  it("form-rules delega à autoridade pura sem alterar a paridade produtiva", () => {
    for (const [original, sale] of MATRIX) {
      expect(inferIntent(original, sale)).toBe(authoritativeInferIntent(original, sale));
      expect(availableIntents(original, sale)).toEqual(authoritativeAvailableIntents(original, sale));
      expect(inferIntent(original, sale)).toBe(prodInferIntent(original, sale));
    }
  });
});

// ─── Normalização monetária por dígitos→centavos ─────────────────────────────

describe("paridade — normalização monetária", () => {
  const SAMPLES = [
    "",
    "   ",
    "1",
    "12",
    "1234",
    "1.234",
    "12,34",
    "1.234,56",
    "R$ 1.234,56",
    "1.234,5",
    "10.5",
    "0,99",
    "R$ 0,05",
  ];

  it.each(SAMPLES)("normalizePriceCents(%j) é idêntico ao produtivo", (sample) => {
    expect(normalizePriceCents(sample)).toBe(parseCurrencyBRL(sample));
  });

  it('normaliza a entrada por dígitos "1234" para 123400 centavos', () => {
    expect(normalizePriceCents("1234")).toBe(123400);
  });
});

// ─── Selo por intenção ───────────────────────────────────────────────────────

describe("paridade — selo por intenção", () => {
  it("exige selo quando a intenção é oferta", () => {
    expect(validateBadge("", "offer")).not.toBeNull();
  });

  it("aceita selo válido da oferta", () => {
    expect(validateBadge("Promoção", "offer")).toBeNull();
  });

  it("recusa selo fora das opções da intenção", () => {
    expect(validateBadge("Promoção", "spotlight")).not.toBeNull();
  });

  it("não exige selo fora da oferta", () => {
    expect(validateBadge("", "spotlight")).toBeNull();
  });

  it("limpa o selo inválido ao mudar de intenção", () => {
    expect(cleanBadgeForIntent("Promoção", "spotlight")).toBe("");
    expect(cleanBadgeForIntent("Novidade", "spotlight")).toBe("Novidade");
    expect(cleanBadgeForIntent("", "offer")).toBe("");
  });
});

// ─── preserveImageContext ────────────────────────────────────────────────────

describe("paridade — preserveImageContext", () => {
  it("só está disponível fora da oferta (Destaque/Exclusivo)", () => {
    expect(isPreserveImageContextAvailable("offer")).toBe(false);
    expect(isPreserveImageContextAvailable("spotlight")).toBe(true);
    expect(isPreserveImageContextAvailable("exclusive")).toBe(true);
  });

  it("tem valor padrão false", () => {
    expect(resolvePreserveImageContext("spotlight", undefined)).toBe(false);
    expect(resolvePreserveImageContext("exclusive", undefined)).toBe(false);
  });

  it("é forçado false ao mudar para Oferta", () => {
    expect(resolvePreserveImageContext("offer", true)).toBe(false);
  });

  it("preserva o valor marcado em Destaque/Exclusivo", () => {
    expect(resolvePreserveImageContext("spotlight", true)).toBe(true);
  });

  it("é enviado no snapshot quando aplicável (Destaque)", () => {
    const product: BenchProduct = {
      name: "Cafeteira Aurora",
      priceCents: 12990,
      preserveImageContext: true,
    };
    const offer: BenchOffer = { campaignIntent: "spotlight" };

    const snapshot = buildBenchCampaignSnapshot({ product, offer, config: CONFIG });

    expect(snapshot.preserveImageContext).toBe(true);
    expect(snapshot.briefSnapshot.creativeContext.preserveImageContext).toBe(true);
  });

  it("é forçado false no snapshot quando a intenção é Oferta", () => {
    const product: BenchProduct = {
      name: "Cafeteira Aurora",
      priceCents: 12990,
      preserveImageContext: true,
    };
    const offer: BenchOffer = { campaignIntent: "offer" };

    const snapshot = buildBenchCampaignSnapshot({ product, offer, config: CONFIG });

    expect(snapshot.preserveImageContext).toBe(false);
    expect(snapshot.briefSnapshot.creativeContext.preserveImageContext).toBe(false);
  });
});

// ─── Validade ────────────────────────────────────────────────────────────────

describe("paridade — texto de validade", () => {
  const CASES: Array<{
    validityMode: BenchValidityMode;
    validityStartDate: string;
    validityEndDate: string;
    validityCustomText: string;
  }> = [
    { validityMode: "", validityStartDate: "", validityEndDate: "", validityCustomText: "" },
    {
      validityMode: "until-date",
      validityStartDate: "",
      validityEndDate: "2026-10-01",
      validityCustomText: "",
    },
    {
      validityMode: "range",
      validityStartDate: "2026-10-01",
      validityEndDate: "2026-10-31",
      validityCustomText: "",
    },
    { validityMode: "today", validityStartDate: "", validityEndDate: "", validityCustomText: "" },
    { validityMode: "stock", validityStartDate: "", validityEndDate: "", validityCustomText: "" },
    {
      validityMode: "custom",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "Oferta válida: só hoje",
    },
  ];

  it.each(CASES)("modo %j é idêntico ao produtivo", (fields) => {
    expect(buildValidityDisplayText(fields)).toBe(prodBuildValidityDisplayText(fields));
  });
});

// ─── Avisos e informações obrigatórias ───────────────────────────────────────

describe("paridade — aviso ilustrativo e informações obrigatórias", () => {
  const COMBOS: Array<[boolean, string]> = [
    [true, ""],
    [false, ""],
    [true, "Intensidade 8"],
    [false, "Intensidade 8"],
    [true, "   "],
    [false, "   "],
    [true, "Intensidade 8\nTorra clássica"],
  ];

  it.each(COMBOS)(
    "buildMandatoryArtworkText(%s, %j) é idêntico ao produtivo",
    (showNotice, freeText) => {
      expect(buildMandatoryArtworkText(showNotice, freeText)).toBe(
        prodBuildMandatoryArtworkText(showNotice, freeText),
      );
    },
  );
});

// ─── Limites de texto ────────────────────────────────────────────────────────

describe("paridade — limites de texto", () => {
  it("nome: 60 aceito, 61 rejeitado, vazio rejeitado", () => {
    expect(validateProductName("a".repeat(60))).toBeNull();
    expect(validateProductName("a".repeat(61))).not.toBeNull();
    expect(validateProductName("   ")).not.toBeNull();
  });

  it("descrição: 120 aceita, 121 rejeitada", () => {
    expect(validateProductDescription("a".repeat(120))).toBeNull();
    expect(validateProductDescription("a".repeat(121))).not.toBeNull();
  });

  it("informações obrigatórias: 200 aceitas, 201 rejeitadas", () => {
    expect(validateMandatoryArtworkText("a".repeat(200))).toBeNull();
    expect(validateMandatoryArtworkText("a".repeat(201))).not.toBeNull();
  });

  it('preço "de/por": venda deve ser menor que o original', () => {
    expect(validateOriginalPrice(1000, 500)).toBeNull();
    expect(validateOriginalPrice(500, 1000)).not.toBeNull();
    expect(validateOriginalPrice(1000, 1000)).not.toBeNull();
  });
});

// ─── Papéis e limites de imagem ──────────────────────────────────────────────

describe("paridade — papéis e limites de imagem", () => {
  it("imagem principal é obrigatória", () => {
    expect(validateImage(null)).not.toBeNull();
    expect(validateImagesCount(0)).not.toBeNull();
  });

  it("aceita tipos produtivos (PNG/JPEG/WEBP/HEIC/HEIF)", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]) {
      expect(validateImage({ type, size: 1024 })).toBeNull();
    }
  });

  it("rejeita tipo fora dos produtivos", () => {
    expect(validateImage({ type: "image/gif", size: 1024 })).not.toBeNull();
  });

  it("rejeita imagem acima de 5MB", () => {
    expect(validateImage({ type: "image/png", size: PRODUCT_IMAGE_MAX_BYTES })).toBeNull();
    expect(
      validateImage({ type: "image/png", size: PRODUCT_IMAGE_MAX_BYTES + 1 }),
    ).not.toBeNull();
  });

  it("aceita até 4 imagens (1 principal + 3 adicionais)", () => {
    expect(MAX_PRODUCT_IMAGES).toBe(4);
    expect(MAX_ADDITIONAL_IMAGES).toBe(3);
    expect(validateImagesCount(1)).toBeNull();
    expect(validateImagesCount(4)).toBeNull();
    expect(validateImagesCount(5)).not.toBeNull();
  });
});

// ─── Ausência de efeitos produtivos ──────────────────────────────────────────

describe("sem efeitos produtivos", () => {
  const MODULES = [
    "src/lib/lab/bench/domain/form-rules.ts",
    "src/lib/lab/bench/domain/campaign-snapshot.ts",
  ];

  it.each(MODULES)("%s não acessa Supabase nem serviços produtivos", (relative) => {
    const source = readFileSync(path.resolve(process.cwd(), relative), "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import"))
      .join("\n");

    expect(importLines).not.toMatch(/@\/lib\/supabase/);
    expect(importLines).not.toMatch(/credit|billing|generation[-_]events|admin_audit/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/generateImage|consumeCredit|createCampaign|insertCampaign/);
  });

  it("montar o snapshot não produz campos de efeito produtivo", () => {
    const product: BenchProduct = { name: "Cafeteira Aurora", priceCents: 12990 };
    const offer: BenchOffer = {};

    const snapshot = buildBenchCampaignSnapshot({ product, offer, config: CONFIG });
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toMatch(/credit|campaign_id|generation_event|billing/i);
  });
});

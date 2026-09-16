// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  LabScenarioContentSchema,
  SCENARIO_FORMATS,
  SCENARIO_INTENTS,
  SCENARIO_LOCALES,
  SCENARIO_MEDIA_KINDS,
  SUPPORTED_SCENARIO_MODES,
  UnsupportedScenarioModeError,
  parseLabScenarioContent,
} from "../schema";

/**
 * Schema `LabScenarioContent` (F48.1, D4).
 *
 * Trava o contrato dos cenários controlados: modalidade suportada nesta fase
 * (`offer`/`1:1`/`pt-BR`), rejeição determinística de modalidade futura
 * (`unsupported_scenario_mode`), exatamente 1 imagem `primary`, trava
 * `fictitious: true` e rejeição de chaves extras (`.strict()`).
 */

/** Cenário válido mínimo — ponto de partida das variações de cada teste. */
function validScenario(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "produto-oferta-preco",
    name: "Oferta com preço",
    description: "Cenário fictício de teste.",
    intent: "offer",
    format: "1:1",
    locale: "pt-BR",
    mediaKinds: ["image"],
    brief: {
      product: { name: "Cesta de Café da Manhã Aurora" },
      offer: { originalPriceCents: 12990, discountedPriceCents: 9990 },
    },
    store: { name: "Empório Aurora", segment: "mercados-mercearias", brandColor: "#16A34A" },
    identity: { state: "text_only" },
    images: [{ id: "produto", role: "primary", path: "images/produto.jpg" }],
    fictitious: true,
    ...overrides,
  };
}

describe("LabScenarioContentSchema — cenário suportado", () => {
  it("aceita cenário offer/1:1/pt-BR completo", () => {
    const parsed = parseLabScenarioContent(validScenario());

    expect(parsed.slug).toBe("produto-oferta-preco");
    expect(parsed.intent).toBe("offer");
    expect(parsed.format).toBe("1:1");
    expect(parsed.locale).toBe("pt-BR");
    expect(parsed.mediaKinds).toEqual(["image"]);
    expect(parsed.fictitious).toBe(true);
    expect(parsed.brief.product.name).toBe("Cesta de Café da Manhã Aurora");
    expect(parsed.store.brandColor).toBe("#16A34A");
    expect(parsed.identity).toEqual({ state: "text_only" });
  });

  it("aceita identidade com logo controlado e bloco legalNotice", () => {
    const parsed = parseLabScenarioContent(
      validScenario({
        identity: { state: "logo", logoPath: "images/logo.png" },
        brief: {
          product: { name: "Luminária de Mesa" },
          offer: { originalPriceCents: 15990, discountedPriceCents: 11990 },
          legalNotice: { mandatoryText: "Imagem ilustrativa", illustrativeNoticeEnabled: true },
        },
      }),
    );

    expect(parsed.identity).toEqual({ state: "logo", logoPath: "images/logo.png" });
    expect(parsed.brief.legalNotice?.illustrativeNoticeEnabled).toBe(true);
  });

  it("expõe uniões extensíveis com modalidades futuras previstas", () => {
    expect(SCENARIO_INTENTS).toContain("service");
    expect(SCENARIO_INTENTS).toContain("informative");
    expect(SCENARIO_FORMATS).toContain("9:16");
    expect(SCENARIO_FORMATS).toContain("carousel");
    expect(SCENARIO_LOCALES).toContain("en-US");
    expect(SCENARIO_MEDIA_KINDS).toEqual(["image"]);
  });

  it("SUPPORTED_SCENARIO_MODES trava offer/1:1/pt-BR nesta fase", () => {
    expect(SUPPORTED_SCENARIO_MODES).toEqual({
      intents: ["offer"],
      formats: ["1:1"],
      locales: ["pt-BR"],
    });
  });
});

describe("LabScenarioContentSchema — modalidade não suportada", () => {
  it("rejeita intent 'spotlight' com unsupported_scenario_mode em 'intent'", () => {
    const error = (() => {
      try {
        parseLabScenarioContent(validScenario({ intent: "spotlight" }));
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(UnsupportedScenarioModeError);
    const typed = error as UnsupportedScenarioModeError;
    expect(typed.code).toBe("unsupported_scenario_mode");
    expect(typed.field).toBe("intent");
    expect(typed.value).toBe("spotlight");
  });

  it("rejeita format '9:16' com unsupported_scenario_mode em 'format'", () => {
    const error = (() => {
      try {
        parseLabScenarioContent(validScenario({ format: "9:16" }));
        return null;
      } catch (caught) {
        return caught;
      }
    })() as UnsupportedScenarioModeError;

    expect(error).toBeInstanceOf(UnsupportedScenarioModeError);
    expect(error.code).toBe("unsupported_scenario_mode");
    expect(error.field).toBe("format");
  });

  it("rejeita locale 'en-US' com unsupported_scenario_mode em 'locale'", () => {
    const error = (() => {
      try {
        parseLabScenarioContent(validScenario({ locale: "en-US" }));
        return null;
      } catch (caught) {
        return caught;
      }
    })() as UnsupportedScenarioModeError;

    expect(error).toBeInstanceOf(UnsupportedScenarioModeError);
    expect(error.code).toBe("unsupported_scenario_mode");
    expect(error.field).toBe("locale");
  });

  it("rejeita intent 'service' (modalidade futura prevista, não suportada)", () => {
    const error = (() => {
      try {
        parseLabScenarioContent(validScenario({ intent: "service" }));
        return null;
      } catch (caught) {
        return caught;
      }
    })() as UnsupportedScenarioModeError;

    expect(error).toBeInstanceOf(UnsupportedScenarioModeError);
    expect(error.field).toBe("intent");
  });
});

describe("LabScenarioContentSchema — valor de modalidade desconhecido (pré-detecção)", () => {
  function captureError(overrides: Record<string, unknown>): unknown {
    try {
      parseLabScenarioContent(validScenario(overrides));
      return null;
    } catch (caught) {
      return caught;
    }
  }

  it("intent 'unknown' (fora da união) → unsupported_scenario_mode em 'intent'", () => {
    const error = captureError({ intent: "unknown" }) as UnsupportedScenarioModeError;

    expect(error).toBeInstanceOf(UnsupportedScenarioModeError);
    expect(error.code).toBe("unsupported_scenario_mode");
    expect(error.field).toBe("intent");
    expect(error.value).toBe("unknown");
  });

  it("format '4:5' (fora da união) → unsupported_scenario_mode em 'format'", () => {
    const error = captureError({ format: "4:5" }) as UnsupportedScenarioModeError;

    expect(error).toBeInstanceOf(UnsupportedScenarioModeError);
    expect(error.code).toBe("unsupported_scenario_mode");
    expect(error.field).toBe("format");
    expect(error.value).toBe("4:5");
  });

  it("locale 'fr-FR' (fora da união) → unsupported_scenario_mode em 'locale'", () => {
    const error = captureError({ locale: "fr-FR" }) as UnsupportedScenarioModeError;

    expect(error).toBeInstanceOf(UnsupportedScenarioModeError);
    expect(error.code).toBe("unsupported_scenario_mode");
    expect(error.field).toBe("locale");
    expect(error.value).toBe("fr-FR");
  });

  it("campo intent ausente → erro genérico (não UnsupportedScenarioModeError)", () => {
    const input = validScenario();
    delete input.intent;
    const error = (() => {
      try {
        parseLabScenarioContent(input);
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnsupportedScenarioModeError);
    expect((error as Error).message).toContain("Cenário de laboratório inválido");
  });

  it("intent de tipo inválido (número) → erro genérico (não UnsupportedScenarioModeError)", () => {
    const error = captureError({ intent: 123 });

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnsupportedScenarioModeError);
  });

  it("format de tipo inválido (objeto) → erro genérico (não UnsupportedScenarioModeError)", () => {
    const error = captureError({ format: { ratio: "1:1" } });

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnsupportedScenarioModeError);
  });
});

describe("LabScenarioContentSchema — slug e imagens", () => {
  it("rejeita slug com path traversal", () => {
    const result = LabScenarioContentSchema.safeParse(validScenario({ slug: "../../etc" }));
    expect(result.success).toBe(false);
  });

  it("rejeita slug com maiúsculas ou underscore", () => {
    expect(LabScenarioContentSchema.safeParse(validScenario({ slug: "Slug" })).success).toBe(false);
    expect(LabScenarioContentSchema.safeParse(validScenario({ slug: "slug_um" })).success).toBe(
      false,
    );
  });

  it("rejeita duas imagens primary (exactly_one_primary_image)", () => {
    const result = LabScenarioContentSchema.safeParse(
      validScenario({
        images: [
          { id: "a", role: "primary", path: "images/produto.jpg" },
          { id: "b", role: "primary", path: "images/produto-auxiliar.jpg" },
        ],
      }),
    );

    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("exactly_one_primary_image");
  });

  it("rejeita zero imagens", () => {
    const result = LabScenarioContentSchema.safeParse(validScenario({ images: [] }));
    expect(result.success).toBe(false);
  });

  it("rejeita lista de imagens sem nenhuma primary", () => {
    const result = LabScenarioContentSchema.safeParse(
      validScenario({
        images: [{ id: "a", role: "reference", path: "images/produto.jpg" }],
      }),
    );

    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("exactly_one_primary_image");
  });
});

describe("LabScenarioContentSchema — travas e strict", () => {
  it("rejeita fictitious: false", () => {
    const result = LabScenarioContentSchema.safeParse(validScenario({ fictitious: false }));
    expect(result.success).toBe(false);
  });

  it("rejeita identity logo sem logoPath", () => {
    const result = LabScenarioContentSchema.safeParse(
      validScenario({ identity: { state: "logo" } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita identity visual_signature (fora da F48.1)", () => {
    const result = LabScenarioContentSchema.safeParse(
      validScenario({ identity: { state: "visual_signature" } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita chave extra no root (.strict())", () => {
    const result = LabScenarioContentSchema.safeParse(
      validScenario({ caminhoReal: "https://loja-real.example.com" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita chave extra em bloco aninhado (.strict())", () => {
    const result = LabScenarioContentSchema.safeParse(
      validScenario({
        store: {
          name: "Empório Aurora",
          segment: "mercados-mercearias",
          brandColor: "#16A34A",
          cnpjReal: "00.000.000/0000-00",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita brandColor fora do formato hexadecimal de 6 dígitos", () => {
    const result = LabScenarioContentSchema.safeParse(
      validScenario({
        store: { name: "Empório Aurora", segment: "mercados-mercearias", brandColor: "verde" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("mensagem de erro genérico não vaza conteúdo bruto de imagem", () => {
    const error = (() => {
      try {
        parseLabScenarioContent(validScenario({ name: "" }));
        return null;
      } catch (caught) {
        return caught as Error;
      }
    })();

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain("Cenário de laboratório inválido");
    expect(error?.message).not.toContain("base64");
  });
});

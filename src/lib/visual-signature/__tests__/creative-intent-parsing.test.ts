// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import { parseCreativeIntent } from "../identity-art-director";

describe("F47.1 — parsing e fallback da intenção criativa", () => {
  it("JSON válido → parsed_json/model, preservando direção, content_used e paleta", () => {
    const result = parseCreativeIntent(
      JSON.stringify({
        visual_direction: "Minimalista",
        content_used: { store_name: true, city: true, state: false, slogan: false },
        visual_elements: ["nome", "ícone"],
        intended_palette: {
          primary: "#112233",
          accent: "#445566",
          background: "#ffffff",
          support: ["#778899"],
        },
      }),
    );

    expect(result.metadata).toEqual({
      creative_intent_parse_status: "parsed_json",
      creative_intent_fallback_applied: false,
      creative_intent_fallback_reason: null,
      creative_intent_source: "model",
      creative_intent_schema_version: "vs-intent-v1",
      intended_palette_status: "present_normalized",
      content_used_present: true,
    });
    expect(result.output.visual_direction).toBe("Minimalista");
    expect(result.output.content_used).toEqual({
      store_name: true,
      city: true,
      state: false,
      slogan: false,
    });
    expect(result.output.intended_palette?.primary).toBe("#112233");
  });

  it("JSON ausente → no_json + fallback explícito (não é direção do modelo)", () => {
    const result = parseCreativeIntent("texto sem json");
    expect(result.metadata).toMatchObject({
      creative_intent_parse_status: "no_json",
      creative_intent_fallback_applied: true,
      creative_intent_fallback_reason: "missing_json",
      creative_intent_source: "fallback",
      content_used_present: false,
    });
    expect(result.output.visual_direction).toBe("Personalizada");
  });

  it("mensagem vazia/undefined → no_json", () => {
    expect(parseCreativeIntent(undefined).metadata.creative_intent_parse_status).toBe("no_json");
    expect(parseCreativeIntent("   ").metadata.creative_intent_parse_status).toBe("no_json");
  });

  it("JSON inválido → invalid_json", () => {
    const result = parseCreativeIntent('{"visual_direction": "x", "content_used": }');
    expect(result.metadata).toMatchObject({
      creative_intent_parse_status: "invalid_json",
      creative_intent_fallback_reason: "invalid_json",
      creative_intent_source: "fallback",
    });
  });

  it("JSON incompleto sem visual_direction → incomplete_json/missing_visual_direction", () => {
    const result = parseCreativeIntent(
      JSON.stringify({ content_used: { store_name: true } }),
    );
    expect(result.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "missing_visual_direction",
      creative_intent_source: "fallback",
      content_used_present: true,
    });
  });

  it("JSON incompleto sem content_used → incomplete_json/missing_content_used", () => {
    const result = parseCreativeIntent(JSON.stringify({ visual_direction: "x" }));
    expect(result.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "missing_content_used",
      content_used_present: false,
    });
  });

  it("paleta ausente → absent; paleta inválida → invalid", () => {
    const absent = parseCreativeIntent(
      JSON.stringify({ visual_direction: "x", content_used: { store_name: true } }),
    );
    expect(absent.metadata.intended_palette_status).toBe("absent");

    const invalid = parseCreativeIntent(
      JSON.stringify({
        visual_direction: "x",
        content_used: { store_name: true },
        intended_palette: { primary: 123 },
      }),
    );
    expect(invalid.metadata.intended_palette_status).toBe("invalid");
    expect(invalid.output.intended_palette).toBeUndefined();
  });

  it("content_used array → incomplete_json/invalid_content_used (não aceita array)", () => {
    const result = parseCreativeIntent(
      JSON.stringify({
        visual_direction: "Minimalista",
        content_used: [{ store_name: true }],
      }),
    );
    expect(result.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "invalid_content_used",
      creative_intent_source: "fallback",
      content_used_present: false,
    });
    expect(result.output.visual_direction).toBe("Personalizada");
  });

  it("indicador fornecido não booleano → invalid_content_used", () => {
    const result = parseCreativeIntent(
      JSON.stringify({
        visual_direction: "Minimalista",
        content_used: { store_name: "sim", city: true },
      }),
    );
    expect(result.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "invalid_content_used",
      creative_intent_source: "fallback",
      content_used_present: true,
    });
    expect(result.output.visual_direction).toBe("Personalizada");
  });

  it("direção vazia ou só whitespace não é direção válida", () => {
    const empty = parseCreativeIntent(
      JSON.stringify({ visual_direction: "   ", content_used: { store_name: true } }),
    );
    expect(empty.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "missing_visual_direction",
      creative_intent_source: "fallback",
    });
  });

  it("direção válida é normalizada com trim", () => {
    const result = parseCreativeIntent(
      JSON.stringify({
        visual_direction: "  Minimalista  ",
        content_used: { store_name: true },
      }),
    );
    expect(result.metadata.creative_intent_parse_status).toBe("parsed_json");
    expect(result.output.visual_direction).toBe("Minimalista");
  });

  it("extrai JSON cercado por texto do modelo", () => {
    const result = parseCreativeIntent(
      'segue {"visual_direction":"x","content_used":{"store_name":true}} fim',
    );
    expect(result.metadata.creative_intent_parse_status).toBe("parsed_json");
    expect(result.output.visual_direction).toBe("x");
  });
});

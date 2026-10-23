import { describe, it, expect } from "vitest";
import { toPublicStoreDTO, toPublicStoreList } from "../store-public-dto";

const SENSITIVE_REGEX = /cnpj_root_hash|"cnpj_normalized"/;

const rawStore = {
  id: "store-1",
  user_id: "user-1",
  name: "Minha Loja",
  segment: "moda-calcados-acessorios",
  city: "São Paulo",
  state: "SP",
  brand_color: "#22C55E",
  logo_url: null,
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  logo_status: null,
  identity_state: "text_only",
  text_only_origin: "manual",
  manual_color_override: false,
  visual_signature_attempts: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  razao_social: "MINHA LOJA LTDA",
  nome_fantasia: "Minha Loja",
  cnpj_validation_score: { name_match: true, score: 1 },
  verification_status: "approved",
  verification_reasons: null,
  is_test_store: false,
  cnpj_normalized: "12345678000195",
  cnpj_root_hash: "root_hash_secreto",
  cnpj_lookup_hash: "lookup_hash_secreto",
  cnpj_official_data: { razao_social: "MINHA LOJA LTDA", cnpj_normalized: "12345678000195" },
  verification_data: { signals: {}, score: 100 },
  previous_identity_snapshot: { secret: true },
  campo_desconhecido: "nao_deve_sair",
};

describe("toPublicStoreDTO — allowlist", () => {
  it("(a) remove identificadores internos e campos desconhecidos, preservando campos públicos e cnpjRegistered", () => {
    const result = toPublicStoreDTO(rawStore);
    const serialized = JSON.stringify(result);

    expect(result.id).toBe("store-1");
    expect(result.name).toBe("Minha Loja");
    expect(result.cnpjRegistered).toBe(true);
    expect(serialized).not.toContain("cnpj_normalized");
    expect(serialized).not.toContain("cnpj_root_hash");
    expect(serialized).not.toContain("cnpj_lookup_hash");
    expect(serialized).not.toContain("root_hash_secreto");
    expect(serialized).not.toContain("lookup_hash_secreto");
    expect(serialized).not.toContain("campo_desconhecido");
    expect("previous_identity_snapshot" in result).toBe(false);
    expect("verification_data" in result).toBe(false);
    expect("cnpj_official_data" in result).toBe(false);
  });

  it("(b) cnpj_normalized nulo → cnpjRegistered false", () => {
    const result = toPublicStoreDTO({ ...rawStore, cnpj_normalized: null });
    expect(result.cnpjRegistered).toBe(false);
  });

  it("(c) não inventa id quando o raw não possui id", () => {
    const { id: _omit, ...withoutId } = rawStore;
    const result = toPublicStoreDTO(withoutId as Record<string, unknown>);
    expect("id" in result).toBe(false);
  });

  it("(d) toPublicStoreList aceita array, objeto único e o envelope { store } dos RPCs", () => {
    const single = toPublicStoreDTO(rawStore);

    expect(toPublicStoreList([rawStore, { ...rawStore, id: "store-2" }])).toHaveLength(2);
    expect(toPublicStoreList(rawStore)).toEqual([single]);
    expect(toPublicStoreList({ store: [rawStore] })).toEqual([single]);
    expect(toPublicStoreList({ store: rawStore })).toEqual([single]);
    expect(toPublicStoreList(null)).toEqual([]);
  });

  it("(e) JSON serializado nunca casa com identificadores internos", () => {
    expect(JSON.stringify(toPublicStoreDTO(rawStore))).not.toMatch(SENSITIVE_REGEX);
    expect(JSON.stringify(toPublicStoreList([rawStore]))).not.toMatch(SENSITIVE_REGEX);
  });

  it("(f) dados sensíveis aninhados em verification_data/cnpj_official_data não vazam em nenhum nível", () => {
    const nested = toPublicStoreDTO({
      ...rawStore,
      verification_data: {
        nested: {
          cnpj_normalized: "12345678000195",
          cnpj_root_hash: "root_hash_secreto",
        },
      },
      cnpj_official_data: {
        nested: {
          cnpj_normalized: "12345678000195",
          cnpj_root_hash: "root_hash_secreto",
        },
      },
    });

    const serialized = JSON.stringify(nested);
    expect(serialized).not.toContain("cnpj_normalized");
    expect(serialized).not.toContain("cnpj_root_hash");
    expect("verification_data" in nested).toBe(false);
  });

  it("(g) preserva identity, assinatura visual e contadores sem vazar CNPJ", () => {
    const result = toPublicStoreDTO({
      ...rawStore,
      identity: {
        storeName: "Minha Loja",
        storeSegment: "moda-calcados-acessorios",
        brandColor: "#22C55E",
        identityState: "visual_signature",
        signature: { url: "https://example.com/signature.png", type: "visual_signature" },
        storeInitials: "ML",
        brandProfile: {
          brand_colors_chosen: ["#22C55E"],
          safe_color_tokens: { primary: "#22C55E" },
          visual_style: "clean",
          visual_tone: "amigavel",
          brand_personality: "acolhedora",
          campaign_guidelines: null,
          campaign_brief: null,
          cnpj_normalized: "12345678000195",
        },
        toneOfVoice: null,
        subsegment: null,
        positioning: null,
        shortDescription: null,
        slogan: null,
        cnpj_root_hash: "root_hash_secreto",
      },
      visual_signature_url: "https://example.com/signature.png",
      has_archived_signatures: true,
      visual_signature_attempts: 3,
    });

    expect(result.identity?.storeName).toBe("Minha Loja");
    expect(result.identity?.signature).toEqual({
      url: "https://example.com/signature.png",
      type: "visual_signature",
    });
    expect(result.visual_signature_url).toBe("https://example.com/signature.png");
    expect(result.has_archived_signatures).toBe(true);
    expect(result.visual_signature_attempts).toBe(3);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("cnpj_normalized");
    expect(serialized).not.toContain("cnpj_root_hash");
  });
});

import { describe, it, expect } from "vitest";
import { getLabel } from "@/lib/labels";
import {
  AUDIT_ACTION_LABELS,
  TARGET_TYPE_LABELS,
  BENEFIT_TYPE_LABELS,
  VERIFICATION_REASON_LABELS,
  DOCUMENT_TYPE_LABELS,
  CAMPAIGN_STATUS_LABELS,
} from "@/lib/admin/labels";

describe("AUDIT_ACTION_LABELS", () => {
  const knownActions = [
    "credit_grant",
    "credit_adjustment",
    "store_create_invite",
    "manual_refund",
    "approve_verification",
    "reject_verification",
    "create_test_store",
    "admin_exception",
    "reveal_cnpj",
  ];

  it.each(knownActions)("cobre ação: %s", (action) => {
    expect(AUDIT_ACTION_LABELS).toHaveProperty(action);
    expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
  });

  it("getLabel retorna label conhecido", () => {
    expect(getLabel(AUDIT_ACTION_LABELS, "credit_grant")).toBe("Concessão de Créditos");
    expect(getLabel(AUDIT_ACTION_LABELS, "reveal_cnpj")).toBe("Revelar CNPJ");
  });

  it("getLabel retorna fallback para ação desconhecida", () => {
    expect(getLabel(AUDIT_ACTION_LABELS, "unknown_action")).toBe("Unknown Action");
  });
});

describe("TARGET_TYPE_LABELS", () => {
  it.each(["store", "user", "campaign"])("cobre alvo: %s", (type) => {
    expect(TARGET_TYPE_LABELS).toHaveProperty(type);
  });

  it("getLabel retorna label conhecido", () => {
    expect(getLabel(TARGET_TYPE_LABELS, "store")).toBe("Loja");
  });
});

describe("BENEFIT_TYPE_LABELS", () => {
  it.each(["onboarding", "monthly", "admin_exception"])("cobre benefício: %s", (type) => {
    expect(BENEFIT_TYPE_LABELS).toHaveProperty(type);
  });

  it("getLabel retorna label conhecido", () => {
    expect(getLabel(BENEFIT_TYPE_LABELS, "onboarding")).toBe("Onboarding");
  });
});

describe("VERIFICATION_REASON_LABELS", () => {
  const knownReasons = [
    "nome_divergente",
    "cidade_divergente",
    "uf_divergente",
    "situacao_suspensa",
    "api_unavailable",
    "cnpj_baixada",
    "cnpj_nula",
    "root_already_used",
    "situacao_nao_ativa",
    "localizacao_oficial_indisponivel",
    "segmento_cnae_divergente",
    "dados_oficiais_incompletos",
  ];

  it.each(knownReasons)("cobre motivo: %s", (reason) => {
    expect(VERIFICATION_REASON_LABELS).toHaveProperty(reason);
  });

  it("mantém situacao_suspensa como legado histórico", () => {
    expect(VERIFICATION_REASON_LABELS.situacao_suspensa).toBe("Situação suspensa");
  });

  it("exibe labels corretos para os novos motivos F42", () => {
    expect(getLabel(VERIFICATION_REASON_LABELS, "situacao_nao_ativa")).toBe("Situação cadastral não ativa");
    expect(getLabel(VERIFICATION_REASON_LABELS, "localizacao_oficial_indisponivel")).toBe("Localização oficial indisponível");
    expect(getLabel(VERIFICATION_REASON_LABELS, "segmento_cnae_divergente")).toBe("Segmento incompatível com CNAE");
    expect(getLabel(VERIFICATION_REASON_LABELS, "dados_oficiais_incompletos")).toBe("Dados oficiais incompletos");
  });
});

describe("DOCUMENT_TYPE_LABELS", () => {
  it.each(["terms_of_service", "acceptable_use", "privacy_policy"])("cobre documento: %s", (type) => {
    expect(DOCUMENT_TYPE_LABELS).toHaveProperty(type);
  });
});

describe("CAMPAIGN_STATUS_LABELS", () => {
  it.each(["generating", "ready", "error"])("cobre status: %s", (status) => {
    expect(CAMPAIGN_STATUS_LABELS).toHaveProperty(status);
    expect(CAMPAIGN_STATUS_LABELS[status]).toBeTruthy();
  });

  it("getLabel retorna label em PT-BR", () => {
    expect(getLabel(CAMPAIGN_STATUS_LABELS, "ready")).toBe("Pronto");
    expect(getLabel(CAMPAIGN_STATUS_LABELS, "error")).toBe("Erro");
    expect(getLabel(CAMPAIGN_STATUS_LABELS, "generating")).toBe("Gerando");
  });
});
